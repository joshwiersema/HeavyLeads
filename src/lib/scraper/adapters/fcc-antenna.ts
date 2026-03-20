import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getFccQueue } from "../api-rate-limiter";
import { toTitleCase } from "./utils";

/**
 * FCC Antenna Structure Registration record shape from Socrata.
 * Field names vary across dataset versions -- handle both formats.
 */
interface FccAsrRecord {
  // Registration identifiers
  reg_num?: string;
  asr_num?: string;
  unique_si?: string;

  // Owner/entity info
  entity_name?: string;
  owner_name?: string;

  // Location -- city/state
  city_name?: string;
  city?: string;
  state_code?: string;
  state?: string;

  // Coordinates -- DMS format
  lat_deg?: string;
  lat_min?: string;
  lat_sec?: string;
  long_deg?: string;
  long_min?: string;
  long_sec?: string;

  // Coordinates -- decimal format (alternate datasets)
  latitude?: string;
  longitude?: string;

  // Structure info
  struc_hgt?: string;
  overall_hg?: string;
  struc_typ?: string;

  // Dates
  reg_dat?: string;
  grant_date?: string;
}

/**
 * FCC Antenna Structure Registrations adapter.
 *
 * Fetches recent antenna structure registrations from the FCC Open Data
 * portal (Socrata-powered). Tower construction creates opportunities
 * for heavy equipment operators and electrical contractors.
 *
 * No authentication required -- FCC Open Data is public. Socrata
 * throttles anonymous requests to ~1000/hr which is sufficient.
 *
 * Data source: https://opendata.fcc.gov/
 */
export class FccAntennaAdapter implements ScraperAdapter {
  readonly sourceId = "fcc-antenna";
  readonly sourceName = "FCC Antenna Structure Registrations";
  readonly sourceType = "telecom" as const;

  /** Primary Socrata dataset ID for ASR registrations */
  private readonly primaryEndpoint =
    "https://opendata.fcc.gov/resource/2fwp-vbpn.json";

  /** Alternate dataset ID (fallback if primary 404s) */
  private readonly alternateEndpoint =
    "https://opendata.fcc.gov/resource/i3wh-hgsf.json";

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getFccQueue();

      // Try primary dataset first
      let records = await queue.add(() =>
        this.fetchRegistrations(this.primaryEndpoint)
      );

      // Fallback to alternate dataset ID if primary returns nothing
      if (!records || records.length === 0) {
        records = await queue.add(() =>
          this.fetchRegistrations(this.alternateEndpoint)
        );
      }

      if (!records || records.length === 0) {
        return [];
      }

      const results: RawLeadData[] = [];

      for (const item of records) {
        const regNum = item.reg_num || item.asr_num || item.unique_si;
        if (!regNum) continue;

        const entityName =
          item.entity_name || item.owner_name || "Unknown";
        const city = item.city_name || item.city || "";
        const state = item.state_code || item.state || "";
        const height = item.struc_hgt || item.overall_hg || "N/A";
        const structureType = item.struc_typ || "N/A";

        // Parse coordinates
        const coords = this.parseCoordinates(item);

        const title = `Antenna Structure Registration: ${toTitleCase(entityName)} - ${toTitleCase(city)}${city && state ? ", " : ""}${state}`;

        results.push({
          externalId: `fcc-asr-${regNum}`,
          title: title.slice(0, 200),
          description:
            `FCC antenna structure registration. Height: ${height} ft. Type: ${structureType}.`.slice(
              0,
              500
            ),
          lat: coords.lat,
          lng: coords.lng,
          city: city ? toTitleCase(city) : undefined,
          state: state || undefined,
          postedDate: item.reg_dat
            ? new Date(item.reg_dat)
            : item.grant_date
              ? new Date(item.grant_date)
              : undefined,
          sourceUrl: `https://wireless2.fcc.gov/UlsApp/AsrSearch/asrRegistration.jsp?regKey=${regNum}`,
          sourceType: "telecom" as const,
        });
      }

      return results;
    } catch (error) {
      console.warn(
        "[FccAntennaAdapter] Scrape failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Fetch antenna registrations from a Socrata endpoint using SODA query.
   * Filters for registrations from the last 90 days.
   */
  private async fetchRegistrations(
    baseUrl: string
  ): Promise<FccAsrRecord[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

    const url = new URL(baseUrl);
    url.searchParams.set("$where", `reg_dat > '${dateStr}'`);
    url.searchParams.set("$limit", "200");
    url.searchParams.set("$order", "reg_dat DESC");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      console.warn(
        `[FccAntennaAdapter] Dataset not found at ${baseUrl} (404)`
      );
      return [];
    }

    if (!response.ok) {
      console.warn(
        `[FccAntennaAdapter] FCC API returned ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      console.warn("[FccAntennaAdapter] Unexpected response format");
      return [];
    }

    return data as FccAsrRecord[];
  }

  /**
   * Parse coordinates from FCC ASR record.
   * Handles both DMS (degrees/minutes/seconds) and decimal formats.
   */
  private parseCoordinates(
    item: FccAsrRecord
  ): { lat?: number; lng?: number } {
    // Try decimal format first (simpler, more reliable)
    if (item.latitude && item.longitude) {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }

    // Try DMS format: degrees + minutes/60 + seconds/3600
    if (item.lat_deg && item.long_deg) {
      const latDeg = parseFloat(item.lat_deg);
      const latMin = parseFloat(item.lat_min || "0");
      const latSec = parseFloat(item.lat_sec || "0");
      const longDeg = parseFloat(item.long_deg);
      const longMin = parseFloat(item.long_min || "0");
      const longSec = parseFloat(item.long_sec || "0");

      if (!isNaN(latDeg) && !isNaN(longDeg)) {
        const lat = latDeg + latMin / 60 + latSec / 3600;
        // Longitude is negative for Western hemisphere (US)
        const lng = -(longDeg + longMin / 60 + longSec / 3600);
        return { lat, lng };
      }
    }

    return {};
  }
}
