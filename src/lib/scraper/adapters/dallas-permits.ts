import type { RawLeadData } from "./base-adapter";
import { SocrataPermitAdapter } from "./socrata-permit-adapter";

/**
 * Dallas TX building permits adapter.
 *
 * Fetches building permits from the City of Dallas open data portal
 * via SODA3 (with SODA2 fallback).
 *
 * Dataset: e7gq-4sah (Building Permits)
 * Source: https://www.dallasopendata.com/resource/e7gq-4sah.json
 *
 * Notable: This dataset does NOT include lat/lng coordinates.
 * All Dallas records will need geocoding by the pipeline.
 */
export class DallasPermitsAdapter extends SocrataPermitAdapter {
  constructor() {
    super({
      sourceId: "dallas-tx-permits",
      sourceName: "City of Dallas Building Permits",
      jurisdiction: "Dallas, TX",
      domain: "www.dallasopendata.com",
      datasetId: "e7gq-4sah",
      fieldMap: {
        permitNumber: "permit_number",
        description: "work_description",
        address: "street_address",
        projectType: "permit_type",
        estimatedValue: "value",
        applicantName: "contractor",
        permitDate: "issued_date",
      },
    });
  }

  protected mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
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
      sourceUrl: `https://www.dallasopendata.com/resource/e7gq-4sah.json?permit_number=${record.permit_number}`,
      sourceType: "permit" as const,
      // Dallas does NOT include lat/lng -- these records will need geocoding
    }));
  }
}
