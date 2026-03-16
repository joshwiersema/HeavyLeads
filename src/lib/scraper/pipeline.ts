import type { ScraperAdapter, RawLeadData } from "./adapters/base-adapter";
import { rawLeadSchema } from "./adapters/base-adapter";
import type { PipelineResult, PipelineRunResult } from "./types";
import { deduplicateNewLeads } from "./dedup";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { geocodeAddress } from "@/lib/geocoding";
import { eq, and, sql } from "drizzle-orm";

/** Default delay between geocoding requests to avoid rate limiting (ms) */
const GEOCODE_THROTTLE_MS = 25;

/**
 * Run the scraping pipeline across all provided adapters.
 *
 * Each adapter is executed with error isolation: if one adapter fails,
 * the error is captured and the pipeline continues with remaining adapters.
 *
 * Records are validated with Zod, geocoded (if lat/lng not present),
 * and upserted into the leads table. Lead source entries are created
 * in the lead_sources junction table for multi-source tracking.
 */
export async function runPipeline(
  adapters: ScraperAdapter[]
): Promise<PipelineRunResult> {
  const startedAt = new Date();
  const results: PipelineResult[] = [];

  for (const adapter of adapters) {
    const result = await runAdapter(adapter);
    results.push(result);
  }

  // Collect all new lead IDs from all adapters for cross-source dedup
  const allNewLeadIds = results.flatMap((r) => r.newLeadIds ?? []);

  // Run cross-source deduplication as a post-pipeline step
  let dedup: { merged: number; kept: number } | undefined;
  if (allNewLeadIds.length > 0) {
    dedup = await deduplicateNewLeads(allNewLeadIds);
    console.log(
      `[pipeline] Dedup complete: ${dedup.merged} merged, ${dedup.kept} kept`
    );
  }

  const completedAt = new Date();
  return { results, startedAt, completedAt, dedup };
}

/**
 * Run a single adapter with error isolation.
 * Returns a PipelineResult regardless of success or failure.
 */
async function runAdapter(adapter: ScraperAdapter): Promise<PipelineResult> {
  try {
    const rawRecords = await adapter.scrape();
    const { valid, invalidCount } = validateRecords(rawRecords);

    const { storedCount, newLeadIds } = await processRecords(
      adapter.sourceId,
      adapter.jurisdiction,
      valid
    );

    const errors: string[] = [];
    if (invalidCount > 0) {
      errors.push(`${invalidCount} record(s) failed validation`);
    }

    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.sourceName,
      recordsScraped: rawRecords.length,
      recordsStored: storedCount,
      errors,
      newLeadIds,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[pipeline] Adapter ${adapter.sourceId} failed: ${message}`
    );
    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.sourceName,
      recordsScraped: 0,
      recordsStored: 0,
      errors: [message],
    };
  }
}

/**
 * Validate raw records against the generalized Zod schema.
 * Invalid records are logged and skipped.
 */
function validateRecords(records: unknown[]): {
  valid: RawLeadData[];
  invalidCount: number;
} {
  const valid: RawLeadData[] = [];
  let invalidCount = 0;

  for (const record of records) {
    const result = rawLeadSchema.safeParse(record);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalidCount++;
      console.warn("[pipeline] Invalid record skipped:", result.error.issues);
    }
  }

  return { valid, invalidCount };
}

/**
 * Process validated records: geocode addresses, then upsert into leads table.
 * After lead insertion, creates lead_sources entries for source tracking.
 */
async function processRecords(
  sourceId: string,
  jurisdiction: string | undefined,
  records: RawLeadData[]
): Promise<{ storedCount: number; newLeadIds: string[] }> {
  if (records.length === 0) return { storedCount: 0, newLeadIds: [] };

  const geocoded = await geocodeBatch(records, GEOCODE_THROTTLE_MS);
  const scrapedAt = new Date();
  const newLeadIds: string[] = [];

  for (const record of geocoded) {
    // Build the address: use explicit address, or construct from city+state
    const address =
      record.address ||
      (record.city && record.state
        ? `${record.city}, ${record.state}`
        : null);

    const values = {
      permitNumber: record.permitNumber ?? null,
      title: record.title ?? null,
      description: record.description ?? null,
      address: address ?? null,
      formattedAddress: record.formattedAddress ?? null,
      lat: record.lat ?? null,
      lng: record.lng ?? null,
      city: record.city ?? null,
      state: record.state ?? null,
      projectType: record.projectType ?? null,
      estimatedValue: record.estimatedValue ?? null,
      applicantName: record.applicantName ?? null,
      contractorName: record.contractorName ?? null,
      agencyName: record.agencyName ?? null,
      permitDate: record.permitDate ?? null,
      postedDate: record.postedDate ?? null,
      deadlineDate: record.deadlineDate ?? null,
      sourceType: record.sourceType,
      sourceId,
      sourceJurisdiction: jurisdiction ?? null,
      sourceUrl: record.sourceUrl ?? null,
      scrapedAt,
    };

    let leadId: string;

    if (record.sourceType === "permit" && record.permitNumber) {
      // Permit records: upsert on sourceId + permitNumber
      const result = await db
        .insert(leads)
        .values(values)
        .onConflictDoUpdate({
          target: [leads.sourceId, leads.permitNumber],
          set: {
            description: sql`excluded.description`,
            title: sql`excluded.title`,
            projectType: sql`excluded.project_type`,
            estimatedValue: sql`excluded.estimated_value`,
            applicantName: sql`excluded.applicant_name`,
            contractorName: sql`excluded.contractor_name`,
            agencyName: sql`excluded.agency_name`,
            permitDate: sql`excluded.permit_date`,
            postedDate: sql`excluded.posted_date`,
            deadlineDate: sql`excluded.deadline_date`,
            scrapedAt: sql`excluded.scraped_at`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            formattedAddress: sql`excluded.formatted_address`,
            sourceUrl: sql`excluded.source_url`,
            city: sql`excluded.city`,
            state: sql`excluded.state`,
          },
        })
        .returning({ id: leads.id });

      leadId = result[0].id;
    } else {
      // Non-permit records: dedup by sourceUrl when available
      if (record.sourceUrl) {
        // Use the partial unique index for dedup
        const result = await db
          .insert(leads)
          .values(values)
          .onConflictDoNothing({
            target: [leads.sourceId, leads.sourceUrl],
          })
          .returning({ id: leads.id });

        if (result.length === 0) {
          // Conflict: lead already exists, find existing ID for lead_sources tracking
          const existing = await db
            .select({ id: leads.id })
            .from(leads)
            .where(
              and(
                eq(leads.sourceId, sourceId),
                eq(leads.sourceUrl, record.sourceUrl)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            leadId = existing[0].id;
          } else {
            // Edge case: should not happen (conflict implies row exists)
            continue;
          }
        } else {
          leadId = result[0].id;
        }
      } else {
        // Fallback for records without sourceUrl: existing title-based check
        const externalId = record.externalId || record.title;
        const existing = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.sourceId, sourceId),
              eq(leads.title, externalId ?? "")
            )
          )
          .limit(1);

        if (existing.length > 0) {
          leadId = existing[0].id;
        } else {
          const result = await db
            .insert(leads)
            .values(values)
            .returning({ id: leads.id });

          leadId = result[0].id;
        }
      }
    }

    newLeadIds.push(leadId);

    // Insert lead_sources entry for source tracking
    await db
      .insert(leadSources)
      .values({
        leadId,
        sourceId,
        sourceType: record.sourceType,
        externalId: record.externalId || record.permitNumber || null,
        sourceUrl: record.sourceUrl ?? null,
        title: record.title ?? null,
      })
      .onConflictDoNothing();
  }

  return { storedCount: geocoded.length, newLeadIds };
}

/** Record with geocoding results attached */
interface GeocodedRecord extends RawLeadData {
  formattedAddress?: string;
}

/**
 * Geocode addresses for records that don't already have coordinates.
 * Applies throttling between requests to avoid rate limiting.
 * For records without an address, attempts to geocode from city+state.
 */
async function geocodeBatch(
  records: RawLeadData[],
  delayMs: number
): Promise<GeocodedRecord[]> {
  const results: GeocodedRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Skip geocoding if adapter already provides coordinates (e.g., Austin, Atlanta)
    if (record.lat != null && record.lng != null) {
      results.push({ ...record });
      continue;
    }

    // Determine what to geocode: prefer address, fall back to city+state
    const geocodeTarget =
      record.address ||
      (record.city && record.state
        ? `${record.city}, ${record.state}`
        : null);

    if (!geocodeTarget) {
      // No address or city/state available -- store without coordinates
      results.push({ ...record });
      continue;
    }

    try {
      const geo = await geocodeAddress(geocodeTarget);
      results.push({
        ...record,
        lat: geo.lat ?? undefined,
        lng: geo.lng ?? undefined,
        formattedAddress: geo.formattedAddress,
      });
    } catch (error) {
      console.warn(
        `[pipeline] Geocoding failed for "${geocodeTarget}":`,
        error instanceof Error ? error.message : error
      );
      // Store record without coordinates if geocoding fails
      results.push({ ...record });
    }

    // Throttle between geocoding requests (skip after last record)
    if (delayMs > 0 && i < records.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
