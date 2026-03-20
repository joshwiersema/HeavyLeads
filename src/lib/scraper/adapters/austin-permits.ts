import type { RawLeadData } from "./base-adapter";
import { SocrataPermitAdapter } from "./socrata-permit-adapter";
import { buildPermitTitle, toTitleCase } from "./utils";

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
    return data.map((record) => {
      const description = (record.description as string) || undefined;
      const projectType = (record.permit_type_desc as string) || undefined;
      const address = record.permit_location as string;

      // Austin dataset may include project_valuation or total_valuation
      const rawValue = (record.project_valuation ?? record.total_valuation ?? record.valuation) as string | undefined;
      const estimatedValue = rawValue ? parseFloat(rawValue) : undefined;

      return {
        permitNumber: record.permit_number as string,
        title: buildPermitTitle({ description, projectType, address }),
        description,
        address: toTitleCase(address),
        projectType,
        estimatedValue: estimatedValue && !isNaN(estimatedValue) ? estimatedValue : undefined,
        permitDate: record.issue_date
          ? new Date(record.issue_date as string)
          : undefined,
        sourceUrl: `https://data.austintexas.gov/resource/3syk-w9eu.json?permit_number=${record.permit_number}`,
        sourceType: "permit" as const,
        lat: record.latitude
          ? parseFloat(record.latitude as string)
          : undefined,
        lng: record.longitude
          ? parseFloat(record.longitude as string)
          : undefined,
      };
    });
  }
}
