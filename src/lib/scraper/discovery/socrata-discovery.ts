/**
 * Socrata Discovery Service
 *
 * Queries the Socrata Discovery API (api.us.socrata.com/api/catalog/v1) to find
 * permit and code violation datasets across hundreds of U.S. cities. For each
 * discovered dataset, uses inferFieldMapping to auto-map column names and
 * compute a confidence score.
 *
 * Results are structured as SocrataDiscoveryResult[] ready for upsert into
 * the data_portals table by the weekly discovery cron.
 */

import { inferFieldMapping, type FieldMapping } from "../field-mapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocrataDiscoveryResult {
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
  portalType: "socrata";
  discoveredBy: "socrata-discovery";
}

/** Shape of a single Socrata Discovery API catalog result */
interface SocrataCatalogResult {
  resource: {
    name: string;
    id: string;
    columns_name: string[];
    columns_field_name: string[];
    columns_datatype: string[];
    description: string;
    type: string;
  };
  metadata: {
    domain: string;
  };
  classification: {
    categories: string[];
    tags: string[];
  };
  permalink: string;
}

/** Shape of the Socrata Discovery API response */
interface SocrataCatalogResponse {
  results: SocrataCatalogResult[];
  resultSetSize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCRATA_DISCOVERY_API =
  "https://api.us.socrata.com/api/catalog/v1";

const DISCOVERY_QUERIES = [
  { q: "building permits", datasetType: "permit" as const },
  { q: "construction permits", datasetType: "permit" as const },
  { q: "code violations", datasetType: "violation" as const },
  { q: "code enforcement", datasetType: "violation" as const },
];

/** Minimum confidence to include a dataset (at least 3/9 canonical fields) */
const MIN_CONFIDENCE = 0.33;

/** Maximum results per query (5 pages * 100 per page) */
const MAX_RESULTS_PER_QUERY = 500;
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

// ---------------------------------------------------------------------------
// Well-known domain -> city/state mappings
// ---------------------------------------------------------------------------

const KNOWN_DOMAINS: Record<string, { city: string; state: string }> = {
  "data.austintexas.gov": { city: "Austin", state: "TX" },
  "www.dallasopendata.com": { city: "Dallas", state: "TX" },
  "data.cityofchicago.org": { city: "Chicago", state: "IL" },
  "data.sfgov.org": { city: "San Francisco", state: "CA" },
  "data.lacity.org": { city: "Los Angeles", state: "CA" },
  "data.cityofnewyork.us": { city: "New York", state: "NY" },
  "data.seattle.gov": { city: "Seattle", state: "WA" },
  "data.boston.gov": { city: "Boston", state: "MA" },
  "data.detroitmi.gov": { city: "Detroit", state: "MI" },
  "data.nashville.gov": { city: "Nashville", state: "TN" },
  "data.colorado.gov": { city: "Denver", state: "CO" },
  "data.miamigov.com": { city: "Miami", state: "FL" },
  "data.phila.gov": { city: "Philadelphia", state: "PA" },
  "data.montgomerycountymd.gov": { city: "Montgomery County", state: "MD" },
  "data.kcmo.org": { city: "Kansas City", state: "MO" },
  "data.nola.gov": { city: "New Orleans", state: "LA" },
  "data.sanjoseca.gov": { city: "San Jose", state: "CA" },
  "data.honolulu.gov": { city: "Honolulu", state: "HI" },
  "data.louisvilleky.gov": { city: "Louisville", state: "KY" },
  "data.memphistn.gov": { city: "Memphis", state: "TN" },
  "data.fortworthtexas.gov": { city: "Fort Worth", state: "TX" },
  "data.sanantonio.gov": { city: "San Antonio", state: "TX" },
  "data.raleighnc.gov": { city: "Raleigh", state: "NC" },
  "data.atlantaga.gov": { city: "Atlanta", state: "GA" },
  "data.chattanooga.gov": { city: "Chattanooga", state: "TN" },
  "data.cincinnati-oh.gov": { city: "Cincinnati", state: "OH" },
  "data.providenceri.gov": { city: "Providence", state: "RI" },
  "data.buffalony.gov": { city: "Buffalo", state: "NY" },
  "data.hartford.gov": { city: "Hartford", state: "CT" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse city and state from a Socrata portal domain name.
 *
 * Common patterns:
 *   - data.{cityname}.gov          -> city={cityname}
 *   - data.{city}{state}.gov       -> city, state from well-known map
 *   - {city}.data.socrata.com      -> city={city}
 *   - datahub.{city}.gov           -> city={city}
 */
export function parseCityStateFromDomain(
  domain: string
): { city: string | null; state: string | null } {
  // Check well-known domains first
  const known = KNOWN_DOMAINS[domain];
  if (known) {
    return { city: known.city, state: known.state };
  }

  const lowerDomain = domain.toLowerCase();

  // Pattern: data.{cityname}.gov or data.{cityname}.org
  const dataPattern = /^data\.([a-z]+(?:[a-z]+)?)\.(?:gov|org|com)$/;
  const dataMatch = lowerDomain.match(dataPattern);
  if (dataMatch) {
    return { city: toTitleCase(dataMatch[1]), state: null };
  }

  // Pattern: datahub.{cityname}.gov
  const datahubPattern = /^datahub\.([a-z]+)\.gov$/;
  const datahubMatch = lowerDomain.match(datahubPattern);
  if (datahubMatch) {
    return { city: toTitleCase(datahubMatch[1]), state: null };
  }

  // Pattern: {city}.data.socrata.com
  const socrataPattern = /^([a-z]+)\.data\.socrata\.com$/;
  const socrataMatch = lowerDomain.match(socrataPattern);
  if (socrataMatch) {
    return { city: toTitleCase(socrataMatch[1]), state: null };
  }

  // Pattern: data.{city}{stateabbr}.gov (e.g., data.austintexas.gov)
  // Already covered by KNOWN_DOMAINS above for common ones
  // For unknowns, can't reliably parse without state abbreviation lookup

  return { city: null, state: null };
}

/** Simple title-case utility for city names */
function toTitleCase(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

/**
 * Discover Socrata datasets by querying the catalog API with permit and
 * violation search terms. Pages through results, auto-maps columns via
 * inferFieldMapping, filters by confidence, and returns structured results.
 */
export async function discoverSocrataDatasets(): Promise<
  SocrataDiscoveryResult[]
> {
  const allResults = new Map<string, SocrataDiscoveryResult>();

  for (const query of DISCOVERY_QUERIES) {
    let offset = 0;

    while (offset < MAX_RESULTS_PER_QUERY) {
      const url = `${SOCRATA_DISCOVERY_API}?q=${encodeURIComponent(
        query.q
      )}&only=datasets&limit=${PAGE_SIZE}&offset=${offset}`;

      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        console.warn(
          `[socrata-discovery] Failed to fetch page at offset ${offset} for "${query.q}"`
        );
        break;
      }

      if (!response.ok) {
        console.warn(
          `[socrata-discovery] HTTP ${response.status} at offset ${offset} for "${query.q}"`
        );
        break;
      }

      const data: SocrataCatalogResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        break;
      }

      for (const result of data.results) {
        const domain = result.metadata?.domain;
        const datasetId = result.resource?.id;
        if (!domain || !datasetId) continue;

        // Dedup key
        const key = `${domain}::${datasetId}`;
        if (allResults.has(key)) continue;

        // Extract columns and run field mapping
        const columns = result.resource.columns_field_name ?? [];
        if (columns.length === 0) continue;

        const { mapping, confidence, unmapped } = inferFieldMapping(columns);

        // Skip low-confidence datasets
        if (confidence < MIN_CONFIDENCE) continue;

        // Parse city/state
        const { city, state } = parseCityStateFromDomain(domain);
        const jurisdiction =
          city && state ? `${city}, ${state}` : city || null;

        // Determine applicable industries
        const applicableIndustries =
          query.datasetType === "permit"
            ? PERMIT_INDUSTRIES
            : VIOLATION_INDUSTRIES;

        allResults.set(key, {
          domain,
          datasetId,
          name: result.resource.name ?? "Unknown Dataset",
          datasetType: query.datasetType,
          city,
          state,
          jurisdiction,
          fieldMapping: mapping,
          confidence,
          unmappedColumns: unmapped,
          applicableIndustries,
          portalType: "socrata",
          discoveredBy: "socrata-discovery",
        });
      }

      // Stop if we've received fewer results than a full page
      if (data.results.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;

      // Rate-limit: wait between page fetches
      if (offset < MAX_RESULTS_PER_QUERY) {
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

  // Collect unique domains for summary
  const uniqueDomains = new Set(results.map((r) => r.domain));

  console.log(
    `[socrata-discovery] Found ${results.length} datasets across ${uniqueDomains.size} domains`
  );

  return results;
}
