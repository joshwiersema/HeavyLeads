import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getUsaSpendingQueue } from "../api-rate-limiter";

/**
 * USAspending federal contract results shape (from spending_by_award endpoint).
 * Fields are returned as display-name keys by the API.
 */
interface UsaSpendingAwardResult {
  "Award ID": string;
  "Recipient Name": string;
  Description: string;
  "Award Amount": number | string | null;
  "Place of Performance City Code": string | null;
  "Place of Performance State Code": string | null;
  "Start Date": string | null;
  generated_internal_id: string;
}

/** USAspending search API response shape */
interface UsaSpendingResponse {
  results: UsaSpendingAwardResult[];
  page_metadata?: {
    page: number;
    hasNext: boolean;
    total: number;
  };
}

/**
 * USAspending Federal Construction Contracts adapter.
 *
 * Fetches awarded construction contracts from the USAspending API,
 * filtering by NAICS sector 23 (Construction):
 * - 236: Building Construction
 * - 237: Heavy and Civil Engineering Construction
 * - 238: Specialty Trade Contractors
 *
 * No authentication required -- USAspending is a free public API.
 * Uses POST endpoint for complex filtering.
 *
 * API docs: https://api.usaspending.gov/
 */
export class UsaSpendingContractsAdapter implements ScraperAdapter {
  readonly sourceId = "usaspending-contracts";
  readonly sourceName = "USAspending Federal Construction Contracts";
  readonly sourceType = "contract-award" as const;

  private readonly endpoint =
    "https://api.usaspending.gov/api/v2/search/spending_by_award/";
  private readonly naicsCodes: string[];

  constructor(options?: { naicsCodes?: string[] }) {
    this.naicsCodes = options?.naicsCodes ?? ["236", "237", "238"];
  }

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getUsaSpendingQueue();
      const results: RawLeadData[] = [];

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const today = new Date();

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const requestBody = {
        filters: {
          time_period: [
            {
              start_date: formatDate(ninetyDaysAgo),
              end_date: formatDate(today),
            },
          ],
          award_type_codes: ["A", "B", "C", "D"],
          naics_codes: { require: this.naicsCodes },
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Description",
          "Award Amount",
          "Place of Performance City Code",
          "Place of Performance State Code",
          "Start Date",
          "generated_internal_id",
        ],
        limit: 100,
        page: 1,
        sort: "Award Amount",
        order: "desc",
      };

      await queue.add(async () => {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          console.warn(
            `[UsaSpendingContractsAdapter] API error: ${response.status} ${response.statusText}`
          );
          return;
        }

        const data: UsaSpendingResponse = await response.json();

        if (!data.results || data.results.length === 0) {
          return;
        }

        for (const item of data.results) {
          const rawAmount = item["Award Amount"];
          const estimatedValue =
            rawAmount != null ? parseFloat(String(rawAmount)) : undefined;

          const description = item.Description
            ? item.Description.slice(0, 200)
            : "Federal Construction Contract";

          results.push({
            title: description,
            description: `Federal contract awarded to ${item["Recipient Name"] ?? "Unknown"} - $${estimatedValue?.toLocaleString() ?? "N/A"}`,
            estimatedValue:
              estimatedValue && !isNaN(estimatedValue)
                ? estimatedValue
                : undefined,
            agencyName: item["Recipient Name"] ?? undefined,
            city: item["Place of Performance City Code"] ?? undefined,
            state: item["Place of Performance State Code"] ?? undefined,
            externalId:
              item["Award ID"] || item.generated_internal_id || undefined,
            sourceUrl: item.generated_internal_id
              ? `https://www.usaspending.gov/award/${item.generated_internal_id}`
              : undefined,
            postedDate: item["Start Date"]
              ? new Date(item["Start Date"])
              : undefined,
            sourceType: "contract-award" as const,
          });
        }
      });

      return results;
    } catch (error) {
      console.warn(
        "[UsaSpendingContractsAdapter] Scrape failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
}
