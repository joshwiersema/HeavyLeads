import type { RawLeadData } from "./base-adapter";
import { SocrataViolationAdapter } from "./socrata-violation-adapter";

/**
 * Houston TX code violations adapter.
 *
 * Fetches code enforcement cases from the City of Houston open data portal
 * via SODA3 (with SODA2 fallback).
 *
 * Dataset: k6hb-wr87 (Code Enforcement Active Cases)
 * Source: https://data.houstontx.gov/resource/k6hb-wr87.json
 *
 * Houston includes lat/lng coordinates in violation records.
 */
export class HoustonViolationsAdapter extends SocrataViolationAdapter {
  constructor() {
    super({
      sourceId: "houston-tx-violations",
      sourceName: "City of Houston Code Enforcement",
      jurisdiction: "Houston, TX",
      domain: "data.houstontx.gov",
      datasetId: "k6hb-wr87",
      fieldMap: {
        violationNumber: "case_number",
        description: "violation_description",
        address: "street_address",
        dateField: "violation_date",
        latitude: "latitude",
        longitude: "longitude",
        status: "case_status",
      },
    });
  }

  protected mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
    return data.map((record) => ({
      permitNumber: record.case_number as string,
      title: `Code Violation: ${record.case_number as string}`,
      description: (record.violation_description as string) || undefined,
      address: record.street_address as string,
      permitDate: record.violation_date
        ? new Date(record.violation_date as string)
        : undefined,
      sourceUrl: `https://data.houstontx.gov/resource/k6hb-wr87.json?case_number=${record.case_number}`,
      sourceType: "violation" as const,
      lat: record.latitude
        ? parseFloat(record.latitude as string)
        : undefined,
      lng: record.longitude
        ? parseFloat(record.longitude as string)
        : undefined,
    }));
  }
}
