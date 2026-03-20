/**
 * ArcGIS Hub Discovery Service
 *
 * Queries the ArcGIS Hub Search API (hub.arcgis.com/api/v3/datasets) to find
 * permit and code violation Feature Service datasets. For each discovered
 * dataset, extracts field names from metadata, uses inferFieldMapping to
 * auto-map columns, and computes a confidence score.
 *
 * Results are structured as ArcGISDiscoveryResult[] ready for upsert into
 * the data_portals table by the weekly discovery cron.
 */

import { inferFieldMapping, type FieldMapping } from "../field-mapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArcGISDiscoveryResult {
  domain: string;
  datasetId: string;
  name: string;
  datasetType: "permit" | "violation";
  city: string | null;
  state: string | null;
  jurisdiction: string | null;
  fieldMapping: FieldMapping;
  confidence: number;
  unmappedColumns: string[];
  applicableIndustries: string[];
  portalType: "arcgis";
  discoveredBy: "arcgis-discovery";
  featureServiceUrl: string | null;
}

/** Shape of a single ArcGIS Hub Search result */
interface ArcGISHubResult {
  id: string;
  type: string;
  attributes: {
    name: string;
    slug: string;
    url: string;
    source: string;
    description: string;
    type: string;
    tags: string[];
    extent?: { coordinates: number[][] };
    fields?: Array<{ name: string; type: string }>;
  };
}

/** Shape of the ArcGIS Hub Search API response */
interface ArcGISHubResponse {
  data: ArcGISHubResult[];
  meta: { total: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARCGIS_HUB_API = "https://hub.arcgis.com/api/v3/datasets";

const DISCOVERY_QUERIES = [
  { q: "building permits", datasetType: "permit" as const },
  { q: "construction permits", datasetType: "permit" as const },
  { q: "code violations", datasetType: "violation" as const },
  { q: "code enforcement", datasetType: "violation" as const },
];

/** Minimum confidence to include a dataset (at least 3/9 canonical fields) */
const MIN_CONFIDENCE = 0.33;

/** Maximum pages per query (3 pages * 100 per page = 300 results) */
const MAX_PAGES_PER_QUERY = 3;
const PAGE_SIZE = 100;

/** Delay between page fetches (ms) to be respectful */
const PAGE_DELAY_MS = 500;

/** Industries that benefit from permit data */
const PERMIT_INDUSTRIES = [
  "heavy_equipment",
  "hvac",
  "roofing",
  "solar",
  "electrical",
];

/** Industries that respond to code violations */
const VIOLATION_INDUSTRIES = ["hvac", "roofing", "electrical"];

/** US state abbreviations for validation */
const STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse city and state from a dataset name or source string.
 *
 * Common patterns:
 *   - "City of Austin Building Permits" -> city=Austin
 *   - "Houston, TX - Code Violations"   -> city=Houston, state=TX
 *   - "Miami-Dade County Permits"       -> city=Miami-Dade
 *   - "Building Permits - City of Denver" -> city=Denver
 */
export function parseCityStateFromName(
  name: string
): { city: string | null; state: string | null } {
  if (!name) return { city: null, state: null };

  // Pattern 1: "City, ST" (e.g., "Houston, TX - Code Violations")
  const commaStatePattern = /([A-Z][a-zA-Z\s.-]+?),\s*([A-Z]{2})\b/;
  const commaMatch = name.match(commaStatePattern);
  if (commaMatch && STATE_ABBREVIATIONS.has(commaMatch[2])) {
    return { city: commaMatch[1].trim(), state: commaMatch[2] };
  }

  // Pattern 2: "City of {Name}" (e.g., "City of Austin Building Permits")
  const cityOfPattern = /City\s+of\s+([A-Z][a-zA-Z\s.-]+?)(?:\s+(?:Building|Construction|Code|Permit|Violation|Inspection|Department|Gov|Data)|$)/i;
  const cityOfMatch = name.match(cityOfPattern);
  if (cityOfMatch) {
    return { city: cityOfMatch[1].trim(), state: null };
  }

  // Pattern 3: "{Name} County" (e.g., "Miami-Dade County Permits")
  const countyPattern = /([A-Z][a-zA-Z\s.-]+?)\s+County\b/i;
  const countyMatch = name.match(countyPattern);
  if (countyMatch) {
    return { city: countyMatch[1].trim(), state: null };
  }

  return { city: null, state: null };
}

/**
 * Extract the domain from an ArcGIS Feature Service URL or source string.
 *
 * Examples:
 *   - "https://services.arcgis.com/abc123/..." -> "services.arcgis.com"
 *   - "https://gis.atlantaga.gov/..." -> "gis.atlantaga.gov"
 */
function extractDomain(url: string | undefined, source: string | undefined): string {
  if (url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      // Fall through
    }
  }
  if (source) {
    // Source may be a domain or org name
    if (source.includes(".")) {
      return source;
    }
  }
  return "hub.arcgis.com";
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

/**
 * Discover ArcGIS datasets by querying the Hub Search API with permit and
 * violation search terms. Pages through results, extracts field names from
 * dataset metadata, auto-maps via inferFieldMapping, and returns structured
 * results ready for data_portals upsert.
 */
export async function discoverArcGISDatasets(): Promise<
  ArcGISDiscoveryResult[]
> {
  const allResults = new Map<string, ArcGISDiscoveryResult>();

  for (const query of DISCOVERY_QUERIES) {
    let page = 1;

    while (page <= MAX_PAGES_PER_QUERY) {
      const url = `${ARCGIS_HUB_API}?q=${encodeURIComponent(
        query.q
      )}&filter[type]=Feature+Service&page[size]=${PAGE_SIZE}&page[number]=${page}`;

      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        console.warn(
          `[arcgis-discovery] Failed to fetch page ${page} for "${query.q}"`
        );
        break;
      }

      if (!response.ok) {
        console.warn(
          `[arcgis-discovery] HTTP ${response.status} at page ${page} for "${query.q}"`
        );
        break;
      }

      const data: ArcGISHubResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        break;
      }

      for (const result of data.data) {
        const datasetId = result.id;
        if (!datasetId) continue;

        const attrs = result.attributes;
        if (!attrs) continue;

        // Extract domain
        const domain = extractDomain(attrs.url, attrs.source);

        // Dedup key
        const key = `${domain}::${datasetId}`;
        if (allResults.has(key)) continue;

        // Extract field names from metadata
        const fields = attrs.fields ?? [];
        const fieldNames = fields.map((f) => f.name);

        if (fieldNames.length === 0) continue;

        // Run field mapping
        const { mapping, confidence, unmapped } = inferFieldMapping(fieldNames);

        // Skip low-confidence datasets
        if (confidence < MIN_CONFIDENCE) continue;

        // Parse city/state from dataset name or source
        const nameResult = parseCityStateFromName(attrs.name ?? "");
        const sourceResult = parseCityStateFromName(attrs.source ?? "");
        const city = nameResult.city ?? sourceResult.city;
        const state = nameResult.state ?? sourceResult.state;
        const jurisdiction =
          city && state ? `${city}, ${state}` : city || null;

        // Determine applicable industries
        const applicableIndustries =
          query.datasetType === "permit"
            ? PERMIT_INDUSTRIES
            : VIOLATION_INDUSTRIES;

        // Capture Feature Service URL
        const featureServiceUrl = attrs.url || null;

        allResults.set(key, {
          domain,
          datasetId,
          name: attrs.name ?? "Unknown Dataset",
          datasetType: query.datasetType,
          city,
          state,
          jurisdiction,
          fieldMapping: mapping,
          confidence,
          unmappedColumns: unmapped,
          applicableIndustries,
          portalType: "arcgis",
          discoveredBy: "arcgis-discovery",
          featureServiceUrl,
        });
      }

      // Stop if we've received fewer results than a full page
      if (data.data.length < PAGE_SIZE) {
        break;
      }

      page++;

      // Rate-limit: wait between page fetches
      if (page <= MAX_PAGES_PER_QUERY) {
        await delay(PAGE_DELAY_MS);
      }
    }

    // Small delay between queries too
    await delay(PAGE_DELAY_MS);
  }

  // Sort by confidence descending
  const results = Array.from(allResults.values()).sort(
    (a, b) => b.confidence - a.confidence
  );

  console.log(
    `[arcgis-discovery] Found ${results.length} datasets`
  );

  return results;
}
