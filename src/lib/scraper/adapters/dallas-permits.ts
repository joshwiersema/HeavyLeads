import type { ScraperAdapter, RawPermitData } from "./base-adapter";

/**
 * Dallas TX building permits adapter.
 *
 * Fetches building permits from the City of Dallas open data portal
 * via the Socrata SODA JSON API.
 *
 * Dataset: e7gq-4sah (Building Permits)
 * Source: https://www.dallasopendata.com/resource/e7gq-4sah.json
 *
 * Notable: This dataset does NOT include lat/lng coordinates.
 * All Dallas records will need geocoding by the pipeline.
 */
export class DallasPermitsAdapter implements ScraperAdapter {
  readonly sourceId = "dallas-tx-permits";
  readonly sourceName = "City of Dallas Building Permits";
  readonly jurisdiction = "Dallas, TX";

  private readonly endpoint =
    "https://www.dallasopendata.com/resource/e7gq-4sah.json";

  async scrape(): Promise<RawPermitData[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

    const url = new URL(this.endpoint);
    url.searchParams.set("$where", `issued_date > '${dateStr}'`);
    url.searchParams.set("$limit", "1000");
    url.searchParams.set("$order", "issued_date DESC");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Dallas permits API error: ${response.status} ${response.statusText}`
      );
    }

    const data: Record<string, unknown>[] = await response.json();

    return data.map((record) => ({
      permitNumber: record.permit_number as string,
      description: (record.work_description as string) || undefined,
      address: record.street_address as string,
      projectType: (record.permit_type as string) || undefined,
      estimatedValue: record.value
        ? parseFloat(record.value as string)
        : undefined,
      applicantName: (record.contractor as string) || undefined,
      permitDate: record.issued_date
        ? new Date(record.issued_date as string)
        : undefined,
      sourceUrl: `${this.endpoint}?permit_number=${record.permit_number}`,
      // Dallas does NOT include lat/lng -- these records will need geocoding
    }));
  }
}
