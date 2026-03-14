import type { ScraperAdapter, RawPermitData } from "./adapters/base-adapter";
import { rawPermitSchema } from "./adapters/base-adapter";
import type { PipelineResult, PipelineRunResult } from "./types";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { geocodeAddress } from "@/lib/geocoding";

/** Default delay between geocoding requests to avoid rate limiting (ms) */
const GEOCODE_THROTTLE_MS = 25;

/**
 * Run the scraping pipeline across all provided adapters.
 *
 * Each adapter is executed with error isolation: if one adapter fails,
 * the error is captured and the pipeline continues with remaining adapters.
 *
 * Records are validated with Zod, geocoded (if lat/lng not present),
 * and upserted into the leads table using sourceId+permitNumber for dedup.
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

  const completedAt = new Date();
  return { results, startedAt, completedAt };
}

/**
 * Run a single adapter with error isolation.
 * Returns a PipelineResult regardless of success or failure.
 */
async function runAdapter(adapter: ScraperAdapter): Promise<PipelineResult> {
  try {
    const rawRecords = await adapter.scrape();
    const { valid, invalidCount } = validateRecords(rawRecords);

    const storedCount = await processRecords(
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
 * Validate raw records against the Zod schema.
 * Invalid records are logged and skipped.
 */
function validateRecords(records: unknown[]): {
  valid: RawPermitData[];
  invalidCount: number;
} {
  const valid: RawPermitData[] = [];
  let invalidCount = 0;

  for (const record of records) {
    const result = rawPermitSchema.safeParse(record);
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
 */
async function processRecords(
  sourceId: string,
  jurisdiction: string,
  records: RawPermitData[]
): Promise<number> {
  if (records.length === 0) return 0;

  const geocoded = await geocodeBatch(records, GEOCODE_THROTTLE_MS);
  const scrapedAt = new Date();

  const values = geocoded.map((record) => ({
    permitNumber: record.permitNumber,
    description: record.description ?? null,
    address: record.address,
    formattedAddress: record.formattedAddress ?? null,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    projectType: record.projectType ?? null,
    estimatedValue: record.estimatedValue ?? null,
    applicantName: record.applicantName ?? null,
    permitDate: record.permitDate ?? null,
    sourceId,
    sourceJurisdiction: jurisdiction,
    sourceUrl: record.sourceUrl ?? null,
    scrapedAt,
  }));

  await db
    .insert(leads)
    .values(values)
    .onConflictDoUpdate({
      target: [leads.sourceId, leads.permitNumber],
      set: {
        description: leads.description,
        projectType: leads.projectType,
        estimatedValue: leads.estimatedValue,
        applicantName: leads.applicantName,
        permitDate: leads.permitDate,
        scrapedAt: leads.scrapedAt,
        lat: leads.lat,
        lng: leads.lng,
        formattedAddress: leads.formattedAddress,
        sourceUrl: leads.sourceUrl,
      },
    });

  return values.length;
}

/** Record with geocoding results attached */
interface GeocodedRecord extends RawPermitData {
  formattedAddress?: string;
}

/**
 * Geocode addresses for records that don't already have coordinates.
 * Applies throttling between requests to avoid rate limiting.
 */
async function geocodeBatch(
  records: RawPermitData[],
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

    try {
      const geo = await geocodeAddress(record.address);
      results.push({
        ...record,
        lat: geo.lat,
        lng: geo.lng,
        formattedAddress: geo.formattedAddress,
      });
    } catch (error) {
      console.warn(
        `[pipeline] Geocoding failed for "${record.address}":`,
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
