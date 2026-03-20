import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getEpaQueue } from "../api-rate-limiter";
import { toTitleCase } from "./utils";

/**
 * EPA Brownfields / ACRES contaminated site adapter.
 *
 * Fetches contaminated site cleanup data from the EPA Envirofacts REST API,
 * including coordinates and cleanup status. No authentication required.
 *
 * The ACRES (Assessment, Cleanup, and Redevelopment Exchange System) database
 * tracks brownfield sites nationwide -- abandoned or underutilized properties
 * where redevelopment is complicated by environmental contamination.
 *
 * These sites represent opportunities for environmental remediation,
 * demolition, site preparation, and construction services.
 *
 * API docs: https://www.epa.gov/enviro/envirofacts-data-service-api
 */

/** Shape of an EPA ACRES site record (fields may vary by table version) */
interface AcresSiteRecord {
  SITE_ID?: string;
  HANDLER_ID?: string;
  SITE_NAME?: string;
  NAME?: string;
  CITY?: string;
  SITE_CITY?: string;
  STATE?: string;
  SITE_STATE?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
  CLEANUP_STATUS?: string;
  STATUS?: string;
  ASSESSMENT_TYPE?: string;
  ACRES?: string;
  ACREAGE?: string;
  [key: string]: string | undefined;
}

/**
 * Table names to try in order. EPA Envirofacts table naming can change
 * without notice; we attempt multiple known variants.
 */
const TABLE_NAMES = [
  "ACRES_SITE_INFORMATION",
  "ACRES_SITES",
  "sems.ACRES_SITE_INFORMATION",
] as const;

export class EpaBrownfieldsAdapter implements ScraperAdapter {
  readonly sourceId = "epa-brownfields";
  readonly sourceName = "EPA Brownfields Site Inventory";
  readonly sourceType = "brownfield" as const;

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getEpaQueue();

      let records: AcresSiteRecord[] | null = null;
      let usedTable = "";

      // Try each table name variant until one succeeds
      for (const tableName of TABLE_NAMES) {
        try {
          const data = await queue.add(async () => {
            const url = `https://data.epa.gov/efservice/${tableName}/JSON/rows/0:100`;
            const response = await fetch(url);

            if (!response.ok) {
              return null;
            }

            const json = await response.json();
            // Envirofacts returns an array directly
            if (Array.isArray(json) && json.length > 0) {
              return json as AcresSiteRecord[];
            }
            return null;
          });

          if (data) {
            records = data;
            usedTable = tableName;
            console.log(`[epa-brownfields] Successfully fetched from table: ${tableName}`);
            break;
          }
        } catch {
          // Try next table name
          continue;
        }
      }

      if (!records || records.length === 0) {
        console.warn(
          "[epa-brownfields] EPA Brownfields tables may have been renamed. Check Envirofacts API viewer."
        );
        return [];
      }

      console.log(
        `[epa-brownfields] Fetched ${records.length} records from ${usedTable}`
      );

      const results: RawLeadData[] = [];

      for (let i = 0; i < records.length; i++) {
        const item = records[i];

        const siteId = item.SITE_ID || item.HANDLER_ID || String(i);
        const siteName = item.SITE_NAME || item.NAME || "Unknown";
        const city = item.CITY || item.SITE_CITY;
        const state = item.STATE || item.SITE_STATE;
        const status = item.CLEANUP_STATUS || item.STATUS || "Unknown";
        const acres = item.ACRES || item.ACREAGE;

        // Parse coordinates if present and valid
        const rawLat = item.LATITUDE ? parseFloat(item.LATITUDE) : NaN;
        const rawLng = item.LONGITUDE ? parseFloat(item.LONGITUDE) : NaN;
        const lat = !isNaN(rawLat) && rawLat !== 0 ? rawLat : undefined;
        const lng = !isNaN(rawLng) && rawLng !== 0 ? rawLng : undefined;

        // Build descriptive text from available fields
        const descParts: string[] = [
          `EPA Brownfield site "${toTitleCase(siteName)}"`,
          `Status: ${status}`,
        ];
        if (item.ASSESSMENT_TYPE) {
          descParts.push(`Assessment: ${item.ASSESSMENT_TYPE}`);
        }
        if (acres) {
          descParts.push(`${acres} acres`);
        }
        if (city && state) {
          descParts.push(`in ${toTitleCase(city)}, ${state}`);
        }
        const description = descParts.join(". ") + ".";

        const lead: RawLeadData = {
          externalId: `epa-bf-${siteId}`,
          title: `Brownfield Site: ${toTitleCase(siteName)}`,
          description,
          city: city ? toTitleCase(city) : undefined,
          state: state || undefined,
          lat,
          lng,
          sourceUrl: `https://enviro.epa.gov/enviro/acres_frs_query.html?fac_search=site_epa_id&fac_value=${siteId}`,
          postedDate: new Date(),
          sourceType: "brownfield",
        };

        results.push(lead);
      }

      return results;
    } catch (error) {
      console.warn(
        "[epa-brownfields] Fetch failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
}
