import { z } from "zod";

/**
 * Zod schema for validating raw permit data scraped from jurisdiction sources.
 * Each adapter's scrape() output is validated against this before DB insertion.
 */
export const rawPermitSchema = z.object({
  permitNumber: z.string(),
  description: z.string().optional(),
  address: z.string(),
  projectType: z.string().optional(),
  estimatedValue: z.number().optional(),
  applicantName: z.string().optional(),
  permitDate: z.coerce.date().optional(),
  sourceUrl: z.string().optional(),
});

/** Validated permit data type inferred from the Zod schema */
export type RawPermitData = z.infer<typeof rawPermitSchema>;

/**
 * Interface that all jurisdiction-specific scrapers must implement.
 *
 * Each adapter targets a single data source (e.g., "austin-tx-permits")
 * and returns an array of raw permit records. The pipeline orchestrator
 * handles validation, geocoding, and storage.
 */
export interface ScraperAdapter {
  /** Unique identifier for this data source (e.g. "austin-tx-permits") */
  readonly sourceId: string;
  /** Human-readable name (e.g. "City of Austin Building Permits") */
  readonly sourceName: string;
  /** Jurisdiction string (e.g. "Austin, TX") */
  readonly jurisdiction: string;
  /** Scrape the data source and return raw permit records */
  scrape(): Promise<RawPermitData[]>;
}
