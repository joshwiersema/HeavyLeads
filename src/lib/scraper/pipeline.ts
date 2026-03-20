import type { ScraperAdapter, RawLeadData } from "./adapters/base-adapter";
import { rawLeadSchema } from "./adapters/base-adapter";
import type { PipelineResult, PipelineRunResult } from "./types";
import { deduplicateNewLeads } from "./dedup";
import { computeContentHash } from "./content-hash";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { scraperRuns } from "@/lib/db/schema/scraper-runs";
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
 *
 * When pipelineRunId is provided, per-adapter scraper_runs rows are
 * inserted/updated with execution status and record counts.
 */
export async function runPipeline(
  adapters: ScraperAdapter[],
  options?: { pipelineRunId?: string; industry?: string }
): Promise<PipelineRunResult> {
  const startedAt = new Date();
  const results: PipelineResult[] = [];

  for (const adapter of adapters) {
    const result = await runAdapter(
      adapter,
      options?.pipelineRunId,
      options?.industry
    );
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
  return {
    results,
    startedAt,
    completedAt,
    dedup,
    industry: options?.industry,
  };
}

/**
 * Run a single adapter with error isolation.
 * Returns a PipelineResult regardless of success or failure.
 *
 * When pipelineRunId is provided, inserts/updates a scraper_runs row
 * to track per-adapter execution status, record counts, and errors.
 */
async function runAdapter(
  adapter: ScraperAdapter,
  pipelineRunId?: string,
  industry?: string
): Promise<PipelineResult> {
  // Insert scraper_runs row if tracking is enabled
  let scraperRunId: string | undefined;
  if (pipelineRunId) {
    try {
      const [run] = await db
        .insert(scraperRuns)
        .values({
          pipelineRunId,
          adapterId: adapter.sourceId,
          adapterName: adapter.sourceName,
          industry: industry ?? null,
          status: "running",
        })
        .returning({ id: scraperRuns.id });
      scraperRunId = run.id;
    } catch (err) {
      console.warn(
        `[pipeline] Failed to insert scraper_runs row for ${adapter.sourceId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  try {
    const rawRecords = await adapter.scrape();

    // Warn when an adapter returns no results (may indicate missing API keys or config issues)
    if (rawRecords.length === 0) {
      console.warn(
        `[pipeline] ${adapter.sourceId} (${adapter.sourceName}) returned 0 results — check configuration and API keys`
      );
    }

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

    // Update scraper_runs with success
    if (scraperRunId) {
      try {
        await db
          .update(scraperRuns)
          .set({
            status: "completed",
            recordsFound: rawRecords.length,
            recordsStored: storedCount,
            recordsSkipped: invalidCount,
            completedAt: new Date(),
          })
          .where(eq(scraperRuns.id, scraperRunId));
      } catch (err) {
        console.warn(
          `[pipeline] Failed to update scraper_runs for ${adapter.sourceId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.sourceName,
      recordsScraped: rawRecords.length,
      recordsStored: storedCount,
      errors,
      newLeadIds,
      industry,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[pipeline] Adapter ${adapter.sourceId} failed: ${message}`
    );

    // Update scraper_runs with failure
    if (scraperRunId) {
      try {
        await db
          .update(scraperRuns)
          .set({
            status: "failed",
            errorMessage: message,
            completedAt: new Date(),
          })
          .where(eq(scraperRuns.id, scraperRunId));
      } catch (err) {
        console.warn(
          `[pipeline] Failed to update scraper_runs for ${adapter.sourceId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.sourceName,
      recordsScraped: 0,
      recordsStored: 0,
      errors: [message],
      industry,
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
 *
 * Content hash is computed for each record and stored alongside the lead.
 * The content_hash unique index (WHERE content_hash IS NOT NULL) catches
 * exact duplicates via ON CONFLICT DO NOTHING.
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

    // Compute content hash for dedup
    const contentHash = computeContentHash({
      sourceType: record.sourceType,
      sourceId,
      permitNumber: record.permitNumber,
      externalId: record.externalId,
      title: record.title,
      sourceUrl: record.sourceUrl,
    });

    const values = {
      permitNumber: record.permitNumber ?? null,
      title: record.title ?? null,
      description: record.description ?? null,
      address: address ?? null,
      formattedAddress: record.formattedAddress ?? null,
      lat: record.lat ?? null,
      lng: record.lng ?? null,
      location:
        record.lat != null && record.lng != null
          ? sql`ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)`
          : null,
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
      contentHash,
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
            location: sql`ST_SetSRID(ST_MakePoint(excluded.lng, excluded.lat), 4326)`,
            formattedAddress: sql`excluded.formatted_address`,
            sourceUrl: sql`excluded.source_url`,
            city: sql`excluded.city`,
            state: sql`excluded.state`,
            contentHash: sql`excluded.content_hash`,
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

/**
 * One-time backfill: populate location column for all existing leads
 * that have lat/lng but null location. Safe to run multiple times.
 */
export async function backfillLeadLocations(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE leads
    SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND location IS NULL
  `);
  return Number(result.rowCount ?? 0);
}
