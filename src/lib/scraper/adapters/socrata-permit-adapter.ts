import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getSocrataQueue } from "../api-rate-limiter";

export interface SocrataConfig {
  sourceId: string;
  sourceName: string;
  jurisdiction: string;
  domain: string; // e.g., 'data.austintexas.gov'
  datasetId: string; // e.g., '3syk-w9eu'
  fieldMap: {
    permitNumber: string;
    description?: string;
    address: string;
    projectType?: string;
    estimatedValue?: string;
    applicantName?: string;
    permitDate: string;
    latitude?: string;
    longitude?: string;
  };
}

/**
 * Abstract base class for Socrata-backed permit adapters.
 *
 * Handles SODA3 POST queries with automatic SODA2 GET fallback,
 * rate limiting via the shared Socrata queue, and optional
 * X-App-Token authentication.
 *
 * Subclasses only need to provide a SocrataConfig and implement
 * mapRecords() for city-specific field mapping.
 */
export abstract class SocrataPermitAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType = "permit" as const;
  readonly jurisdiction: string;

  protected readonly config: SocrataConfig;

  constructor(config: SocrataConfig) {
    this.sourceId = config.sourceId;
    this.sourceName = config.sourceName;
    this.jurisdiction = config.jurisdiction;
    this.config = config;
  }

  async scrape(): Promise<RawLeadData[]> {
    const queue = await getSocrataQueue();

    return queue.add(async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split("T")[0];
      const { domain, datasetId, fieldMap } = this.config;

      const appToken = process.env.SOCRATA_APP_TOKEN?.trim();

      // Try SODA3 first
      const soda3Url = `https://${domain}/api/v3/views/${datasetId}/query.json`;
      const soda3Body = {
        query: `SELECT * WHERE ${fieldMap.permitDate} > '${dateStr}' ORDER BY ${fieldMap.permitDate} DESC LIMIT 1000`,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (appToken) {
        headers["X-App-Token"] = appToken;
      }

      let data: Record<string, unknown>[];

      try {
        const response = await fetch(soda3Url, {
          method: "POST",
          headers,
          body: JSON.stringify(soda3Body),
        });

        if (response.ok) {
          data = await response.json();
        } else {
          // Fallback to SODA2
          data = await this.fetchSoda2(
            domain,
            datasetId,
            fieldMap.permitDate,
            dateStr,
            appToken
          );
        }
      } catch {
        // Fallback to SODA2 on network error
        data = await this.fetchSoda2(
          domain,
          datasetId,
          fieldMap.permitDate,
          dateStr,
          appToken
        );
      }

      return this.mapRecords(data);
    }) as Promise<RawLeadData[]>;
  }

  private async fetchSoda2(
    domain: string,
    datasetId: string,
    permitDateField: string,
    dateStr: string,
    appToken: string | undefined
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(`https://${domain}/resource/${datasetId}.json`);
    url.searchParams.set("$where", `${permitDateField} > '${dateStr}'`);
    url.searchParams.set("$limit", "1000");
    url.searchParams.set("$order", `${permitDateField} DESC`);

    const headers: Record<string, string> = {};
    if (appToken) {
      headers["X-App-Token"] = appToken;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(
        `Socrata ${domain} API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  protected abstract mapRecords(
    data: Record<string, unknown>[]
  ): RawLeadData[];
}
