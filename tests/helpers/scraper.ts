import type {
  ScraperAdapter,
  RawLeadData,
  SourceType,
} from "@/lib/scraper/adapters/base-adapter";

// Backward-compatible re-export
export type { RawLeadData as RawPermitData } from "@/lib/scraper/adapters/base-adapter";

/** Create a mock adapter with configurable behavior */
export function createMockAdapter(
  overrides: Partial<ScraperAdapter> & { results?: RawLeadData[] } = {}
): ScraperAdapter {
  const results = overrides.results ?? [createMockPermitData()];
  return {
    sourceId: overrides.sourceId ?? "test-source",
    sourceName: overrides.sourceName ?? "Test Source",
    sourceType: overrides.sourceType ?? "permit",
    jurisdiction: overrides.jurisdiction ?? "Test City, TS",
    scrape: overrides.scrape ?? (async () => results),
  };
}

/** Create valid mock permit data */
export function createMockPermitData(
  overrides: Partial<RawLeadData> = {}
): RawLeadData {
  return {
    permitNumber: overrides.permitNumber ?? "PERMIT-001",
    description: overrides.description ?? "Commercial building renovation",
    address: overrides.address ?? "123 Main St, Test City, TS 12345",
    projectType: overrides.projectType ?? "commercial",
    estimatedValue: overrides.estimatedValue ?? 500000,
    applicantName: overrides.applicantName ?? "Acme Construction",
    permitDate: overrides.permitDate ?? new Date("2025-01-15"),
    sourceUrl: overrides.sourceUrl ?? "https://example.com/permits/001",
    sourceType: overrides.sourceType ?? "permit",
    ...overrides,
  };
}

/** Create valid mock lead data for non-permit sources */
export function createMockLeadData(
  sourceType: SourceType,
  overrides: Partial<RawLeadData> = {}
): RawLeadData {
  const defaults: Record<SourceType, Partial<RawLeadData>> = {
    permit: {
      permitNumber: "PERMIT-001",
      address: "123 Main St, Test City, TS 12345",
      projectType: "commercial",
    },
    bid: {
      title: "Federal Building Renovation RFP",
      externalId: "SAM-2026-001",
      agencyName: "GSA",
      estimatedValue: 5000000,
      deadlineDate: new Date("2026-04-01"),
    },
    news: {
      title: "Groundbreaking ceremony for new hospital",
      description: "A new 500-bed hospital project",
      city: "Dallas",
      state: "TX",
      postedDate: new Date("2026-03-10"),
      sourceUrl: "https://enr.com/article/123",
    },
    "deep-web": {
      title: "Heavy equipment operator job posting",
      externalId: "https://linkedin.com/jobs/123",
      city: "Austin",
      state: "TX",
      sourceUrl: "https://linkedin.com/jobs/123",
    },
    storm: {
      title: "Severe Thunderstorm Warning",
      externalId: "urn:oid:2.49.0.1.840.0.test",
      city: "Dallas",
      state: "TX",
      deadlineDate: new Date("2026-03-17T12:00:00Z"),
      sourceUrl: "https://alerts.weather.gov/search?id=test",
    },
    disaster: {
      title: "HURRICANE DELTA",
      externalId: "4799",
      state: "TX",
      postedDate: new Date("2026-02-10"),
      sourceUrl: "https://www.fema.gov/disaster/4799",
    },
  };

  return {
    sourceType,
    ...defaults[sourceType],
    ...overrides,
  } as RawLeadData;
}

/** Create an adapter whose scrape() throws the given error */
export function createFailingAdapter(
  sourceId: string,
  error: string
): ScraperAdapter {
  return {
    sourceId,
    sourceName: `Failing ${sourceId}`,
    sourceType: "permit",
    jurisdiction: "Fail City, FL",
    scrape: async () => {
      throw new Error(error);
    },
  };
}
