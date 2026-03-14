import type { ScraperAdapter, RawPermitData } from "@/lib/scraper/adapters/base-adapter";

/** Create a mock adapter with configurable behavior */
export function createMockAdapter(
  overrides: Partial<ScraperAdapter> & { results?: RawPermitData[] } = {}
): ScraperAdapter {
  const results = overrides.results ?? [createMockPermitData()];
  return {
    sourceId: overrides.sourceId ?? "test-source",
    sourceName: overrides.sourceName ?? "Test Source",
    jurisdiction: overrides.jurisdiction ?? "Test City, TS",
    scrape: overrides.scrape ?? (async () => results),
  };
}

/** Create valid mock permit data */
export function createMockPermitData(
  overrides: Partial<RawPermitData> = {}
): RawPermitData {
  return {
    permitNumber: overrides.permitNumber ?? "PERMIT-001",
    description: overrides.description ?? "Commercial building renovation",
    address: overrides.address ?? "123 Main St, Test City, TS 12345",
    projectType: overrides.projectType ?? "commercial",
    estimatedValue: overrides.estimatedValue ?? 500000,
    applicantName: overrides.applicantName ?? "Acme Construction",
    permitDate: overrides.permitDate ?? new Date("2025-01-15"),
    sourceUrl: overrides.sourceUrl ?? "https://example.com/permits/001",
  };
}

/** Create an adapter whose scrape() throws the given error */
export function createFailingAdapter(
  sourceId: string,
  error: string
): ScraperAdapter {
  return {
    sourceId,
    sourceName: `Failing ${sourceId}`,
    jurisdiction: "Fail City, FL",
    scrape: async () => {
      throw new Error(error);
    },
  };
}
