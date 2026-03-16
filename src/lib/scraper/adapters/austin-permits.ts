import type { RawLeadData } from "./base-adapter";
import { SocrataPermitAdapter } from "./socrata-permit-adapter";

/**
 * Austin TX building permits adapter.
 *
 * Fetches issued construction permits from the City of Austin's Socrata
 * open data portal via SODA3 (with SODA2 fallback).
 *
 * Dataset: 3syk-w9eu (Issued Construction Permits)
 * Source: https://data.austintexas.gov/resource/3syk-w9eu.json
 *
 * Notable: This dataset includes latitude/longitude, so geocoding
 * can be skipped for Austin records.
 */
export class AustinPermitsAdapter extends SocrataPermitAdapter {
  constructor() {
    super({
      sourceId: "austin-tx-permits",
      sourceName: "City of Austin Issued Construction Permits",
      jurisdiction: "Austin, TX",
      domain: "data.austintexas.gov",
      datasetId: "3syk-w9eu",
      fieldMap: {
        permitNumber: "permit_number",
        description: "description",
        address: "permit_location",
        projectType: "permit_type_desc",
        permitDate: "issue_date",
        latitude: "latitude",
        longitude: "longitude",
      },
    });
  }

  protected mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
    return data.map((record) => ({
      permitNumber: record.permit_number as string,
      description: (record.description as string) || undefined,
      address: record.permit_location as string,
      projectType: (record.permit_type_desc as string) || undefined,
      permitDate: record.issue_date
        ? new Date(record.issue_date as string)
        : undefined,
      sourceUrl: `https://data.austintexas.gov/resource/3syk-w9eu.json?permit_number=${record.permit_number}`,
      sourceType: "permit" as const,
      // Austin includes coordinates from source data -- pass through for geocoding skip
      lat: record.latitude
        ? parseFloat(record.latitude as string)
        : undefined,
      lng: record.longitude
        ? parseFloat(record.longitude as string)
        : undefined,
    }));
  }
}
