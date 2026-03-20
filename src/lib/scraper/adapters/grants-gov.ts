import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getGrantsGovQueue } from "../api-rate-limiter";
import { extractLocation } from "./utils";

/**
 * Grants.gov Federal Construction Grants adapter.
 *
 * Searches for construction-related federal grant opportunities using
 * the Grants.gov Search API. No authentication required.
 *
 * Runs multiple keyword searches to capture a broad range of
 * construction, infrastructure, and remediation grant opportunities,
 * then deduplicates by opportunity ID.
 *
 * API docs: https://www.grants.gov/web/grants/s2s/applicant/schemas/grant-opportunities.html
 */

/** Shape of a Grants.gov opportunity record from the search API */
interface GrantsGovOpportunity {
  opportunityId?: string;
  id?: string;
  title?: string;
  opportunityTitle?: string;
  description?: string;
  synopsis?: string;
  agencyName?: string;
  agency?: string;
  estimatedFunding?: string | number;
  awardCeiling?: string | number;
  openDate?: string;
  postedDate?: string;
  closeDate?: string;
  applicationDeadline?: string;
  [key: string]: unknown;
}

/** Shape of the Grants.gov search API response */
interface GrantsGovResponse {
  hits?: GrantsGovOpportunity[];
  items?: GrantsGovOpportunity[];
  oppHits?: GrantsGovOpportunity[];
  opportunities?: GrantsGovOpportunity[];
  [key: string]: unknown;
}

/** Construction-related search keywords */
const SEARCH_KEYWORDS = [
  "construction infrastructure",
  "building renovation",
  "environmental remediation",
  "highway bridge",
  "facility construction",
] as const;

export class GrantsGovAdapter implements ScraperAdapter {
  readonly sourceId = "grants-gov";
  readonly sourceName = "Grants.gov Federal Construction Grants";
  readonly sourceType = "grant" as const;

  private readonly endpoint = "https://api.grants.gov/v1/api/search2";

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getGrantsGovQueue();
      const seenIds = new Set<string>();
      const results: RawLeadData[] = [];

      for (const keyword of SEARCH_KEYWORDS) {
        try {
          const items = await queue.add(async () => {
            const response = await fetch(this.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ keyword }),
            });

            if (!response.ok) {
              console.warn(
                `[grants-gov] API error for keyword "${keyword}": ${response.status} ${response.statusText}`
              );
              return [];
            }

            const data: GrantsGovResponse = await response.json();

            // The Grants.gov API response structure may vary;
            // try multiple known field names for the results array
            const opportunities =
              data.hits ||
              data.items ||
              data.oppHits ||
              data.opportunities ||
              [];

            return Array.isArray(opportunities) ? opportunities : [];
          });

          if (!items || items.length === 0) continue;

          for (const item of items) {
            const oppId = item.opportunityId || item.id;
            if (!oppId) continue;

            const idStr = String(oppId);

            // Deduplicate across keyword searches
            if (seenIds.has(idStr)) continue;
            seenIds.add(idStr);

            const title = item.title || item.opportunityTitle || "";
            const description = item.description || item.synopsis || "";

            // Parse funding amount from available fields
            const fundingRaw = item.estimatedFunding ?? item.awardCeiling;
            let estimatedValue: number | undefined;
            if (fundingRaw !== undefined && fundingRaw !== null) {
              const parsed = parseFloat(String(fundingRaw));
              if (!isNaN(parsed) && parsed > 0) {
                estimatedValue = parsed;
              }
            }

            // Parse dates
            const postedDateStr = item.openDate || item.postedDate;
            const deadlineDateStr = item.closeDate || item.applicationDeadline;

            let postedDate: Date | undefined;
            if (postedDateStr) {
              const d = new Date(postedDateStr);
              if (!isNaN(d.getTime())) postedDate = d;
            }

            let deadlineDate: Date | undefined;
            if (deadlineDateStr) {
              const d = new Date(deadlineDateStr);
              if (!isNaN(d.getTime())) deadlineDate = d;
            }

            // Extract location from description text
            const location = extractLocation(description);

            const lead: RawLeadData = {
              externalId: `grants-gov-${idStr}`,
              title: title.length > 200 ? title.slice(0, 197) + "..." : title,
              description:
                description.length > 500
                  ? description.slice(0, 497) + "..."
                  : description || undefined,
              agencyName: item.agencyName || item.agency,
              estimatedValue,
              postedDate,
              deadlineDate,
              sourceUrl: `https://www.grants.gov/search-results-detail/${idStr}`,
              sourceType: "grant",
              city: location.city,
              state: location.state,
            };

            results.push(lead);
          }
        } catch (error) {
          console.warn(
            `[grants-gov] Error fetching keyword "${keyword}":`,
            error instanceof Error ? error.message : error
          );
          continue;
        }
      }

      return results;
    } catch (error) {
      console.warn(
        "[grants-gov] Fetch failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
}
