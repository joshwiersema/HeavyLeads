/**
 * Generic Socrata adapter that reads configuration from data_portals rows.
 *
 * Eliminates the need for per-city TypeScript adapter files (like
 * austin-permits.ts, dallas-permits.ts). Instead, each Socrata dataset
 * is configured as a row in the data_portals table with its field mapping,
 * and this adapter handles the rest.
 *
 * Features:
 * - SODA3 POST with automatic SODA2 GET fallback
 * - Rate limited via the shared Socrata p-queue
 * - Dynamic field mapping from DataPortalConfig
 * - Source type routing (permit, violation, inspection)
 * - Optional X-App-Token authentication
 */

import type { ScraperAdapter, RawLeadData, SourceType } from "./base-adapter";
import { getSocrataQueue } from "../api-rate-limiter";
import type { FieldMapping } from "../field-mapper";
import { buildPermitTitle, toTitleCase } from "./utils";

/**
 * Configuration representing a row from the data_portals table.
 * Passed to GenericSocrataAdapter at construction time.
 */
export interface DataPortalConfig {
  id: string;
  portalType: string;
  domain: string;
  datasetId: string;
  name: string;
  /** Dataset type for lead classification: "permit" | "violation" | "inspection" */
  datasetType: string;
  city: string | null;
  state: string | null;
  jurisdiction: string | null;
  fieldMapping: FieldMapping;
  queryFilters: Record<string, unknown> | null;
  enabled: boolean;
  applicableIndustries: string[];
}

/** Map dataset type strings to SourceType enum values */
function toSourceType(datasetType: string): SourceType {
  switch (datasetType) {
    case "permit":
      return "permit";
    case "violation":
      return "violation";
    default:
      return "permit";
  }
}

/**
 * Generic Socrata adapter that can scrape any Socrata dataset
 * configured in the data_portals table.
 *
 * Unlike the per-city adapters (AustinPermitsAdapter, DallasPermitsAdapter),
 * this adapter reads its field mapping from a DataPortalConfig object,
 * making it fully data-driven.
 */
export class GenericSocrataAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly jurisdiction?: string;

  private readonly config: DataPortalConfig;

  constructor(config: DataPortalConfig) {
    this.config = config;
    this.sourceId = `portal-${config.domain}-${config.datasetId}`;
    this.sourceName = config.name;
    this.sourceType = toSourceType(config.datasetType);
    this.jurisdiction =
      config.jurisdiction ??
      (config.city && config.state
        ? `${config.city}, ${config.state}`
        : undefined);
  }

  async scrape(): Promise<RawLeadData[]> {
    const queue = await getSocrataQueue();

    return queue.add(async () => {
      const { domain, datasetId, fieldMapping } = this.config;

      // Calculate lookback window: 30 days for permits, 60 for violations
      const lookbackDays = this.sourceType === "violation" ? 60 : 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      const dateStr = cutoffDate.toISOString().split("T")[0];

      // Determine the date field from the field mapping
      const dateField = fieldMapping.permitDate;

      const appToken = process.env.SOCRATA_APP_TOKEN?.trim();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (appToken) {
        headers["X-App-Token"] = appToken;
      }

      let data: Record<string, unknown>[];

      // Build query based on whether we have a date field mapped
      const hasDateFilter = !!dateField;
      const query = hasDateFilter
        ? `SELECT * WHERE ${dateField} > '${dateStr}' ORDER BY ${dateField} DESC LIMIT 1000`
        : `SELECT * LIMIT 1000`;

      // Try SODA3 first
      const soda3Url = `https://${domain}/api/v3/views/${datasetId}/query.json`;
      const soda3Body = { query };

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
            dateField,
            dateStr,
            appToken,
            hasDateFilter
          );
        }
      } catch {
        // Fallback to SODA2 on network error
        data = await this.fetchSoda2(
          domain,
          datasetId,
          dateField,
          dateStr,
          appToken,
          hasDateFilter
        );
      }

      return this.mapRecords(data);
    }) as Promise<RawLeadData[]>;
  }

  /**
   * SODA2 GET fallback for portals that don't support SODA3.
   */
  private async fetchSoda2(
    domain: string,
    datasetId: string,
    dateField: string | undefined,
    dateStr: string,
    appToken: string | undefined,
    hasDateFilter: boolean
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(`https://${domain}/resource/${datasetId}.json`);

    if (hasDateFilter && dateField) {
      url.searchParams.set("$where", `${dateField} > '${dateStr}'`);
      url.searchParams.set("$order", `${dateField} DESC`);
    }
    url.searchParams.set("$limit", "1000");

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

  /**
   * Map raw Socrata records to RawLeadData using the configured field mapping.
   */
  private mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
    const { fieldMapping, domain, datasetId } = this.config;
    const results: RawLeadData[] = [];

    for (const record of data) {
      // Extract values using the field mapping
      const permitNumber = fieldMapping.permitNumber
        ? (record[fieldMapping.permitNumber] as string | undefined)
        : undefined;

      const description = fieldMapping.description
        ? (record[fieldMapping.description] as string | undefined)
        : undefined;

      const rawAddress = fieldMapping.address
        ? (record[fieldMapping.address] as string | undefined)
        : undefined;

      const projectType = fieldMapping.projectType
        ? (record[fieldMapping.projectType] as string | undefined)
        : undefined;

      const applicantName = fieldMapping.applicantName
        ? (record[fieldMapping.applicantName] as string | undefined)
        : undefined;

      // Parse estimated value
      let estimatedValue: number | undefined;
      if (fieldMapping.estimatedValue) {
        const rawValue = record[fieldMapping.estimatedValue];
        if (rawValue !== undefined && rawValue !== null) {
          const parsed = parseFloat(String(rawValue));
          estimatedValue = isNaN(parsed) ? undefined : parsed;
        }
      }

      // Parse latitude
      let lat: number | undefined;
      if (fieldMapping.latitude) {
        const rawLat = record[fieldMapping.latitude];
        if (rawLat !== undefined && rawLat !== null) {
          const parsed = parseFloat(String(rawLat));
          lat = isNaN(parsed) ? undefined : parsed;
        }
      }

      // Parse longitude
      let lng: number | undefined;
      if (fieldMapping.longitude) {
        const rawLng = record[fieldMapping.longitude];
        if (rawLng !== undefined && rawLng !== null) {
          const parsed = parseFloat(String(rawLng));
          lng = isNaN(parsed) ? undefined : parsed;
        }
      }

      // Parse date
      let permitDate: Date | undefined;
      if (fieldMapping.permitDate) {
        const rawDate = record[fieldMapping.permitDate];
        if (rawDate) {
          const parsed = new Date(String(rawDate));
          permitDate = isNaN(parsed.getTime()) ? undefined : parsed;
        }
      }

      // Build title and format address
      const address = rawAddress ? toTitleCase(rawAddress) : undefined;
      const title = buildPermitTitle({
        description: description || undefined,
        projectType: projectType || undefined,
        address: rawAddress || undefined,
      });

      // Skip records without any identity field
      if (!permitNumber && !title) {
        continue;
      }

      results.push({
        permitNumber: permitNumber || undefined,
        title,
        description: description || undefined,
        address,
        projectType: projectType || undefined,
        estimatedValue,
        applicantName: applicantName || undefined,
        permitDate,
        lat,
        lng,
        sourceUrl: `https://${domain}/resource/${datasetId}.json?$limit=1`,
        sourceType: this.sourceType,
      });
    }

    return results;
  }
}
