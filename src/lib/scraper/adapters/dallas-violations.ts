import type { RawLeadData } from "./base-adapter";
import { SocrataViolationAdapter } from "./socrata-violation-adapter";

/**
 * Dallas TX code violations adapter.
 *
 * Fetches code compliance cases from the City of Dallas open data portal
 * via SODA3 (with SODA2 fallback).
 *
 * Dataset: 46i7-rbhj (Code Compliance Active Cases)
 * Source: https://www.dallasopendata.com/resource/46i7-rbhj.json
 *
 * Dallas does NOT include lat/lng in this dataset — records will need
 * geocoding by the pipeline.
 */
export class DallasViolationsAdapter extends SocrataViolationAdapter {
  constructor() {
    super({
      sourceId: "dallas-tx-violations",
      sourceName: "City of Dallas Code Compliance",
      jurisdiction: "Dallas, TX",
      domain: "www.dallasopendata.com",
      datasetId: "46i7-rbhj",
      fieldMap: {
        violationNumber: "case_number",
        description: "case_description",
        address: "location",
        caseType: "violation_type",
        dateField: "date_filed",
        status: "case_status",
      },
    });
  }

  protected mapRecords(data: Record<string, unknown>[]): RawLeadData[] {
    return data.map((record) => ({
      permitNumber: record.case_number as string,
      title: `Code Violation: ${(record.violation_type as string) || "General"}`,
      description: (record.case_description as string) || undefined,
      address: record.location as string,
      projectType: (record.violation_type as string) || undefined,
      permitDate: record.date_filed
        ? new Date(record.date_filed as string)
        : undefined,
      sourceUrl: `https://www.dallasopendata.com/resource/46i7-rbhj.json?case_number=${record.case_number}`,
      sourceType: "violation" as const,
      // Dallas violations do NOT include lat/lng — needs geocoding
    }));
  }
}
