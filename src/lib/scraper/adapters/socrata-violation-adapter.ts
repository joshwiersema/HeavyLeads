import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getSocrataQueue } from "../api-rate-limiter";

/**
 * Configuration for a Socrata-backed code violation dataset.
 *
 * Each city's violation portal uses different field names, so the fieldMap
 * lets each concrete adapter declare its dataset-specific column mappings.
 */
export interface SocrataViolationConfig {
  sourceId: string;
  sourceName: string;
  jurisdiction: string;
  domain: string;
  datasetId: string;
  fieldMap: {
    /** Field containing the violation/case number (maps to permitNumber for dedup) */
    violationNumber: string;
    /** Field containing the violation description */
    description?: string;
    /** Field containing the street address */
    address: string;
    /** Field containing the case/violation type or code */
    caseType?: string;
    /** Field containing the violation date (used for time-window filtering) */
    dateField: string;
    /** Field containing latitude */
    latitude?: string;
    /** Field containing longitude */
    longitude?: string;
    /** Field containing case/violation status */
    status?: string;
  };
}

/**
 * Abstract base class for Socrata-backed code violation adapters.
 *
 * Mirrors the SocrataPermitAdapter pattern: SODA3 POST with SODA2 GET
 * fallback, rate limited via the shared Socrata queue. Uses a 60-day
 * lookback window (longer than permits, since violations persist longer).
 *
 * Subclasses only need to provide a SocrataViolationConfig and implement
 * mapRecords() for city-specific field mapping.
 */
export abstract class SocrataViolationAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType = "violation" as const;
  readonly jurisdiction: string;

  protected readonly config: SocrataViolationConfig;

  constructor(config: SocrataViolationConfig) {
    this.sourceId = config.sourceId;
    this.sourceName = config.sourceName;
    this.jurisdiction = config.jurisdiction;
    this.config = config;
  }

  async scrape(): Promise<RawLeadData[]> {
    const queue = await getSocrataQueue();

    return queue.add(async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const dateStr = sixtyDaysAgo.toISOString().split("T")[0];
      const { domain, datasetId, fieldMap } = this.config;

      const appToken = process.env.SOCRATA_APP_TOKEN?.trim();

      // Try SODA3 first
      const soda3Url = `https://${domain}/api/v3/views/${datasetId}/query.json`;
      const soda3Body = {
        query: `SELECT * WHERE ${fieldMap.dateField} > '${dateStr}' ORDER BY ${fieldMap.dateField} DESC LIMIT 1000`,
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
            fieldMap.dateField,
            dateStr,
            appToken
          );
        }
      } catch {
        // Fallback to SODA2 on network error
        data = await this.fetchSoda2(
          domain,
          datasetId,
          fieldMap.dateField,
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
    dateField: string,
    dateStr: string,
    appToken: string | undefined
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(`https://${domain}/resource/${datasetId}.json`);
    url.searchParams.set("$where", `${dateField} > '${dateStr}'`);
    url.searchParams.set("$limit", "1000");
    url.searchParams.set("$order", `${dateField} DESC`);

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
