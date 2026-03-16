import type { ScraperAdapter, RawLeadData } from "./base-adapter";

/**
 * SAM.gov Federal Contract Opportunities adapter.
 *
 * Fetches construction-related bid opportunities from the SAM.gov
 * Opportunities API v2, filtering by NAICS sector 23 (Construction).
 *
 * NAICS codes:
 * - 236: Building Construction
 * - 237: Heavy and Civil Engineering Construction
 * - 238: Specialty Trade Contractors
 *
 * Requires SAM_GOV_API_KEY environment variable.
 * Gracefully returns [] when key is missing or on API error.
 *
 * API docs: https://open.gsa.gov/api/get-opportunities-public-api/
 */
export class SamGovBidsAdapter implements ScraperAdapter {
  readonly sourceId = "sam-gov-bids";
  readonly sourceName = "SAM.gov Federal Contract Opportunities";
  readonly sourceType = "bid" as const;

  private readonly endpoint =
    "https://api.sam.gov/opportunities/v2/search";
  private readonly naicsCodes: string[];

  constructor(options?: { naicsCodes?: string[] }) {
    this.naicsCodes = options?.naicsCodes ?? ["236", "237", "238"];
  }

  async scrape(): Promise<RawLeadData[]> {
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      console.warn(
        "[SamGovBidsAdapter] SAM_GOV_API_KEY not set — skipping SAM.gov scrape"
      );
      return [];
    }

    const results: RawLeadData[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const ncode of this.naicsCodes) {
      try {
        const url = new URL(this.endpoint);
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("postedFrom", formatDate(thirtyDaysAgo));
        url.searchParams.set("postedTo", formatDate(new Date()));
        url.searchParams.set("ncode", ncode);
        url.searchParams.set("limit", "100");

        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.warn(
            `[SamGovBidsAdapter] API error for NAICS ${ncode}: ${response.status} ${response.statusText}`
          );
          continue;
        }

        const data = await response.json();
        const opportunities = data.opportunitiesData ?? [];

        for (const item of opportunities) {
          results.push({
            title: item.title,
            description: item.description,
            agencyName: item.department || item.subtier,
            postedDate: item.postedDate
              ? new Date(item.postedDate)
              : undefined,
            deadlineDate: item.responseDeadLine
              ? new Date(item.responseDeadLine)
              : undefined,
            city: item.officeAddress?.city,
            state: item.officeAddress?.state,
            externalId: item.noticeId,
            sourceUrl: `https://sam.gov/opp/${item.noticeId}/view`,
            sourceType: "bid" as const,
            estimatedValue: item.award?.amount
              ? parseFloat(item.award.amount)
              : undefined,
          });
        }
      } catch (error) {
        console.warn(
          `[SamGovBidsAdapter] Error fetching NAICS ${ncode}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return results;
  }
}

/**
 * Format a Date as MM/dd/yyyy for the SAM.gov API query parameters.
 */
function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}
