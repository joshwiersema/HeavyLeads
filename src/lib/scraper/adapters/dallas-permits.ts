import type { RawLeadData } from "./base-adapter";
import { SocrataPermitAdapter } from "./socrata-permit-adapter";
import { buildPermitTitle, toTitleCase } from "./utils";

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
    return data.map((record) => {
      const description = (record.work_description as string) || undefined;
      const projectType = (record.permit_type as string) || undefined;
      const address = record.street_address as string;

      return {
        permitNumber: record.permit_number as string,
        title: buildPermitTitle({ description, projectType, address }),
        description,
        address: toTitleCase(address),
        projectType,
        estimatedValue: record.value
          ? parseFloat(record.value as string)
          : undefined,
        applicantName: (record.contractor as string) || undefined,
        permitDate: record.issued_date
          ? new Date(record.issued_date as string)
          : undefined,
        sourceUrl: `https://www.dallasopendata.com/resource/e7gq-4sah.json?permit_number=${record.permit_number}`,
        sourceType: "permit" as const,
      };
    });
  }
}
