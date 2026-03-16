import { z } from "zod";

/**
 * Source types supported by the scraper infrastructure.
 * - permit: Building/construction permits from city/county databases
 * - bid: Government and private bid board postings (RFPs, contract awards)
 * - news: Construction news and press releases
 * - deep-web: Google dorking and deep web search results
 */
export const sourceTypes = ["permit", "bid", "news", "deep-web", "storm", "disaster"] as const;
export type SourceType = (typeof sourceTypes)[number];

/**
 * Generalized Zod schema for validating raw lead data from any source type.
 *
 * This replaces the previous permit-specific rawPermitSchema with a source-agnostic
 * schema that supports permits, bids, news, and deep-web records.
 *
 * Identity constraint: At least one of permitNumber, title, or externalId must be
 * present to enable deduplication.
 */
export const rawLeadSchema = z
  .object({
    // Identity fields (at least one required for dedup)
    permitNumber: z.string().optional(),
    title: z.string().optional(),
    externalId: z.string().optional(),

    // Core fields
    description: z.string().optional(),
    address: z.string().optional(),
    projectType: z.string().optional(),
    estimatedValue: z.number().optional(),

    // Contacts
    applicantName: z.string().optional(),
    contractorName: z.string().optional(),
    agencyName: z.string().optional(),

    // Dates
    permitDate: z.coerce.date().optional(),
    postedDate: z.coerce.date().optional(),
    deadlineDate: z.coerce.date().optional(),

    // Location
    lat: z.number().optional(),
    lng: z.number().optional(),
    city: z.string().optional(),
    state: z.string().optional(),

    // Source tracking
    sourceUrl: z.string().optional(),
    sourceType: z.enum(sourceTypes),
  })
  .refine(
    (data) => data.permitNumber || data.title || data.externalId,
    {
      message:
        "At least one identity field is required: permitNumber, title, or externalId",
    }
  );

/** Validated lead data type inferred from the generalized Zod schema */
export type RawLeadData = z.infer<typeof rawLeadSchema>;

/**
 * Backward-compatible alias for rawLeadSchema.
 * Existing code importing rawPermitSchema will continue to work.
 */
export const rawPermitSchema = rawLeadSchema;

/**
 * Backward-compatible type alias.
 * Existing code importing RawPermitData will continue to work.
 */
export type RawPermitData = RawLeadData;

/**
 * Interface that all source-specific scrapers must implement.
 *
 * Each adapter targets a single data source (e.g., "austin-tx-permits", "sam-gov-bids")
 * and returns an array of raw lead records. The pipeline orchestrator
 * handles validation, geocoding, and storage.
 */
export interface ScraperAdapter {
  /** Unique identifier for this data source (e.g. "austin-tx-permits") */
  readonly sourceId: string;
  /** Human-readable name (e.g. "City of Austin Building Permits") */
  readonly sourceName: string;
  /** Source type classification */
  readonly sourceType: SourceType;
  /** Jurisdiction string (e.g. "Austin, TX") -- optional for non-permit sources */
  readonly jurisdiction?: string;
  /** Scrape the data source and return raw lead records */
  scrape(): Promise<RawLeadData[]>;
}
