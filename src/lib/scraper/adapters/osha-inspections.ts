import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getOshaQueue } from "../api-rate-limiter";
import { toTitleCase } from "./utils";

/**
 * OSHA inspection record shape from the DOL enforcement API.
 */
interface OshaInspectionRecord {
  activity_nr?: number;
  inspection_nr?: number;
  estab_name?: string;
  establishment_name?: string;
  site_city?: string;
  site_state?: string;
  open_date?: string;
  insp_type?: string;
  inspection_type?: string;
  sic_code?: string;
}

/**
 * OSHA Construction Site Inspections adapter.
 *
 * Fetches construction site inspection records from the DOL enforcement
 * data API, filtering by SIC codes for construction industries:
 * - 15xx: General Building Contractors
 * - 16xx: Heavy Construction (except Building)
 * - 17xx: Special Trade Contractors
 *
 * DOL OSHA API was restructured circa 2025-2026. This adapter tries the
 * enforcedata.dol.gov endpoint first. If it fails (301 redirect or error),
 * it logs a warning and returns [] gracefully. The endpoint may need
 * updating when DOL stabilizes their new API.
 *
 * No authentication required -- public DOL data.
 */
export class OshaInspectionsAdapter implements ScraperAdapter {
  readonly sourceId = "osha-inspections";
  readonly sourceName = "OSHA Construction Site Inspections";
  readonly sourceType = "inspection" as const;

  /**
   * Primary DOL enforcement data API endpoint.
   * May redirect or fail due to DOL API restructuring.
   */
  private readonly primaryEndpoint =
    "https://enforcedata.dol.gov/api/enforcement/osha_inspection";

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getOshaQueue();
      const allResults: RawLeadData[] = [];

      // SIC code prefixes for construction industries
      const sicPrefixes = ["15", "16", "17"];

      for (const sicPrefix of sicPrefixes) {
        try {
          const records = await queue.add(() =>
            this.fetchBySicPrefix(sicPrefix)
          );
          if (records) {
            allResults.push(...records);
          }
        } catch (error) {
          console.warn(
            `[OshaInspectionsAdapter] Error fetching SIC ${sicPrefix}xx:`,
            error instanceof Error ? error.message : error
          );
          // Continue with other SIC prefixes
        }
      }

      return allResults;
    } catch (error) {
      console.warn(
        "[OshaInspectionsAdapter] Scrape failed. DOL API may have been restructured:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Fetch inspections for a given SIC code prefix.
   * Returns [] if API is unavailable or returns an error.
   */
  private async fetchBySicPrefix(
    sicPrefix: string
  ): Promise<RawLeadData[]> {
    const url = new URL(this.primaryEndpoint);
    url.searchParams.set("sic", `${sicPrefix}*`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", "0");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      redirect: "manual", // Detect redirects explicitly
    });

    // Handle redirect -- DOL API was restructured
    if (response.status === 301 || response.status === 302) {
      console.warn(
        `[OshaInspectionsAdapter] DOL API returned ${response.status} redirect for SIC ${sicPrefix}xx. ` +
          "DOL OSHA API was restructured circa 2025-2026. This endpoint may need updating when DOL stabilizes their new API."
      );
      return [];
    }

    if (!response.ok) {
      console.warn(
        `[OshaInspectionsAdapter] DOL API error for SIC ${sicPrefix}xx: ${response.status} ${response.statusText}`
      );
      return [];
    }

    let data: OshaInspectionRecord[];
    try {
      const responseBody = await response.json();
      // API may return array directly or wrap in an object
      data = Array.isArray(responseBody)
        ? responseBody
        : responseBody?.results ?? responseBody?.data ?? [];
    } catch {
      console.warn(
        `[OshaInspectionsAdapter] Failed to parse response for SIC ${sicPrefix}xx`
      );
      return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const results: RawLeadData[] = [];

    for (const record of data) {
      const activityNr = record.activity_nr ?? record.inspection_nr;
      const establishmentName =
        record.estab_name ?? record.establishment_name ?? "Unknown";
      const inspectionType =
        record.insp_type ?? record.inspection_type ?? "Unknown";
      const city = record.site_city ?? undefined;
      const state = record.site_state ?? undefined;

      if (!activityNr) continue;

      results.push({
        externalId: String(activityNr),
        title: `OSHA Inspection: ${toTitleCase(establishmentName)}`,
        description: `${inspectionType} inspection at ${toTitleCase(establishmentName)}${city ? `, ${toTitleCase(city)}` : ""}${state ? `, ${state}` : ""}`,
        city: city ? toTitleCase(city) : undefined,
        state: state ?? undefined,
        postedDate: record.open_date
          ? new Date(record.open_date)
          : undefined,
        sourceUrl: `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${activityNr}`,
        sourceType: "inspection" as const,
      });
    }

    return results;
  }
}
