import type { RawLeadData } from "./base-adapter";
import { SocrataViolationAdapter } from "./socrata-violation-adapter";

/**
 * Austin TX code violations adapter.
 *
 * Fetches code enforcement cases from the City of Austin's Socrata
 * open data portal via SODA3 (with SODA2 fallback).
 *
 * Dataset: ckex-2zb9 (Property Code Enforcement Cases)
 * Source: https://data.austintexas.gov/resource/ckex-2zb9.json
 *
 * Violation types include HVAC/mechanical, roofing, electrical, and
 * general building code violations — tagged for industry relevance.
 */
export class AustinViolationsAdapter extends SocrataViolationAdapter {
  constructor() {
    super({
      sourceId: "austin-tx-violations",
      sourceName: "City of Austin Code Violations",
      jurisdiction: "Austin, TX",
      domain: "data.austintexas.gov",
      datasetId: "ckex-2zb9",
      fieldMap: {
        violationNumber: "case_id",
        description: "description",
        address: "address",
        caseType: "case_type",
        dateField: "date_opened",
        latitude: "latitude",
        longitude: "longitude",
        status: "status",
      },
    });
  }

  protected mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
    return data.map((record) => ({
      permitNumber: record.case_id as string,
      title: `Code Violation: ${(record.case_type as string) || "General"}`,
      description: (record.description as string) || undefined,
      address: record.address as string,
      projectType: (record.case_type as string) || undefined,
      permitDate: record.date_opened
        ? new Date(record.date_opened as string)
        : undefined,
      sourceUrl: `https://data.austintexas.gov/resource/ckex-2zb9.json?case_id=${record.case_id}`,
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
