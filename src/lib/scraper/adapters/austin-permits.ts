import type { ScraperAdapter, RawLeadData } from "./base-adapter";

/**
 * Austin TX building permits adapter.
 *
 * Fetches issued construction permits from the City of Austin's Socrata
 * open data portal via the SODA JSON API.
 *
 * Dataset: 3syk-w9eu (Issued Construction Permits)
 * Source: https://data.austintexas.gov/resource/3syk-w9eu.json
 *
 * Notable: This dataset includes latitude/longitude, so geocoding
 * can be skipped for Austin records.
 */
export class AustinPermitsAdapter implements ScraperAdapter {
  readonly sourceId = "austin-tx-permits";
  readonly sourceName = "City of Austin Issued Construction Permits";
  readonly sourceType = "permit" as const;
  readonly jurisdiction = "Austin, TX";

  private readonly endpoint =
    "https://data.austintexas.gov/resource/3syk-w9eu.json";

  async scrape(): Promise<RawLeadData[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

    const url = new URL(this.endpoint);
    url.searchParams.set("$where", `issue_date > '${dateStr}'`);
    url.searchParams.set("$limit", "1000");
    url.searchParams.set("$order", "issue_date DESC");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Austin permits API error: ${response.status} ${response.statusText}`
      );
    }

    const data: Record<string, unknown>[] = await response.json();

    return data.map((record) => ({
      permitNumber: record.permit_number as string,
      description: (record.description as string) || undefined,
      address: record.permit_location as string,
      projectType: (record.permit_type_desc as string) || undefined,
      permitDate: record.issue_date
        ? new Date(record.issue_date as string)
        : undefined,
      sourceUrl: `${this.endpoint}?permit_number=${record.permit_number}`,
      sourceType: "permit" as const,
      // Austin includes coordinates from source data -- pass through for geocoding skip
      lat: record.latitude ? parseFloat(record.latitude as string) : undefined,
      lng: record.longitude
        ? parseFloat(record.longitude as string)
        : undefined,
    }));
  }
}
