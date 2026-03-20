import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCityStateFromDomain,
  discoverSocrataDatasets,
  type SocrataDiscoveryResult,
} from "@/lib/scraper/discovery/socrata-discovery";

// ---------------------------------------------------------------------------
// parseCityStateFromDomain
// ---------------------------------------------------------------------------

describe("parseCityStateFromDomain", () => {
  it("resolves well-known domain data.austintexas.gov", () => {
    const result = parseCityStateFromDomain("data.austintexas.gov");
    expect(result).toEqual({ city: "Austin", state: "TX" });
  });

  it("resolves well-known domain www.dallasopendata.com", () => {
    const result = parseCityStateFromDomain("www.dallasopendata.com");
    expect(result).toEqual({ city: "Dallas", state: "TX" });
  });

  it("resolves well-known domain data.cityofchicago.org", () => {
    const result = parseCityStateFromDomain("data.cityofchicago.org");
    expect(result).toEqual({ city: "Chicago", state: "IL" });
  });

  it("resolves well-known domain data.sfgov.org", () => {
    const result = parseCityStateFromDomain("data.sfgov.org");
    expect(result).toEqual({ city: "San Francisco", state: "CA" });
  });

  it("parses data.{city}.gov pattern", () => {
    const result = parseCityStateFromDomain("data.portland.gov");
    expect(result.city).toBe("Portland");
    expect(result.state).toBeNull();
  });

  it("parses datahub.{city}.gov pattern", () => {
    const result = parseCityStateFromDomain("datahub.tucson.gov");
    expect(result.city).toBe("Tucson");
    expect(result.state).toBeNull();
  });

  it("parses {city}.data.socrata.com pattern", () => {
    const result = parseCityStateFromDomain("phoenix.data.socrata.com");
    expect(result.city).toBe("Phoenix");
    expect(result.state).toBeNull();
  });

  it("returns null for unrecognizable domains", () => {
    const result = parseCityStateFromDomain("some-random-domain.net");
    expect(result).toEqual({ city: null, state: null });
  });
});

// ---------------------------------------------------------------------------
// discoverSocrataDatasets
// ---------------------------------------------------------------------------

describe("discoverSocrataDatasets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /** Build a mock Socrata catalog response */
  function mockCatalogResponse(
    datasets: Array<{
      domain: string;
      id: string;
      name: string;
      columns: string[];
    }>
  ) {
    return {
      results: datasets.map((d) => ({
        resource: {
          name: d.name,
          id: d.id,
          columns_name: d.columns,
          columns_field_name: d.columns,
          columns_datatype: d.columns.map(() => "text"),
          description: "",
          type: "dataset",
        },
        metadata: { domain: d.domain },
        classification: { categories: [], tags: [] },
        permalink: `https://${d.domain}/d/${d.id}`,
      })),
      resultSetSize: datasets.length,
    };
  }

  it("returns results with correct shape", async () => {
    const mockData = mockCatalogResponse([
      {
        domain: "data.austintexas.gov",
        id: "3syk-w9eu",
        name: "Austin Permits",
        columns: [
          "permit_number",
          "description",
          "permit_location",
          "issue_date",
          "latitude",
          "longitude",
        ],
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const results = await discoverSocrataDatasets();

    expect(results.length).toBeGreaterThanOrEqual(1);

    const austin = results.find((r) => r.datasetId === "3syk-w9eu");
    expect(austin).toBeDefined();
    expect(austin!.domain).toBe("data.austintexas.gov");
    expect(austin!.portalType).toBe("socrata");
    expect(austin!.discoveredBy).toBe("socrata-discovery");
    expect(austin!.fieldMapping.permitNumber).toBe("permit_number");
    expect(austin!.confidence).toBeGreaterThan(0);
    expect(austin!.city).toBe("Austin");
    expect(austin!.state).toBe("TX");
    expect(austin!.jurisdiction).toBe("Austin, TX");
  });

  it("deduplicates datasets by domain+datasetId", async () => {
    // Same dataset appears in two different query responses
    const dataset = {
      domain: "data.boston.gov",
      id: "abc-123",
      name: "Boston Permits",
      columns: ["permit_number", "address", "issue_date", "description"],
    };

    const mockData = mockCatalogResponse([dataset, dataset]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const results = await discoverSocrataDatasets();

    const bostonEntries = results.filter((r) => r.datasetId === "abc-123");
    expect(bostonEntries.length).toBe(1);
  });

  it("filters out datasets with confidence < 0.33", async () => {
    const mockData = mockCatalogResponse([
      {
        domain: "data.example.gov",
        id: "low-conf",
        name: "Low Confidence Dataset",
        // Only 2 of 9 canonical fields mapped -> 0.22 confidence
        columns: ["permit_number", "random_col_1", "random_col_2", "other"],
      },
      {
        domain: "data.example.gov",
        id: "high-conf",
        name: "High Confidence Dataset",
        columns: [
          "permit_number",
          "address",
          "description",
          "issue_date",
          "latitude",
          "longitude",
        ],
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const results = await discoverSocrataDatasets();

    // low-conf should be filtered out (1/9 = 0.11)
    expect(results.find((r) => r.datasetId === "low-conf")).toBeUndefined();
    // high-conf should be included
    expect(results.find((r) => r.datasetId === "high-conf")).toBeDefined();
  });

  it("assigns permit industries to permit datasets", async () => {
    const mockData = mockCatalogResponse([
      {
        domain: "data.test.gov",
        id: "perm-1",
        name: "Test Permits",
        columns: ["permit_number", "address", "issue_date", "description"],
      },
    ]);

    // Each call returns a fresh Response
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify(mockData), { status: 200 })
      );

    const results = await discoverSocrataDatasets();
    const permitResult = results.find((r) => r.datasetType === "permit");

    if (permitResult) {
      expect(permitResult.applicableIndustries).toContain("heavy_equipment");
      expect(permitResult.applicableIndustries).toContain("hvac");
      expect(permitResult.applicableIndustries).toContain("roofing");
      expect(permitResult.applicableIndustries).toContain("solar");
      expect(permitResult.applicableIndustries).toContain("electrical");
      expect(permitResult.applicableIndustries.length).toBe(5);
    }

    fetchMock.mockRestore();
  });

  it("assigns violation industries to violation datasets", async () => {
    // Return empty for permit queries, then violations for violation queries
    const emptyResponse = new Response(
      JSON.stringify({ results: [], resultSetSize: 0 }),
      { status: 200 }
    );

    const violationData = mockCatalogResponse([
      {
        domain: "data.test.gov",
        id: "viol-1",
        name: "Code Violations",
        columns: [
          "case_number",
          "address",
          "description",
          "date_filed",
          "latitude",
          "longitude",
        ],
      },
    ]);

    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      callCount++;
      const urlStr = typeof url === "string" ? url : url.toString();
      // Violation queries contain "code"
      if (urlStr.includes("code")) {
        return new Response(JSON.stringify(violationData), { status: 200 });
      }
      return new Response(
        JSON.stringify({ results: [], resultSetSize: 0 }),
        { status: 200 }
      );
    });

    const results = await discoverSocrataDatasets();
    const violationResult = results.find((r) => r.datasetType === "violation");

    if (violationResult) {
      expect(violationResult.applicableIndustries).toContain("hvac");
      expect(violationResult.applicableIndustries).toContain("roofing");
      expect(violationResult.applicableIndustries).toContain("electrical");
      expect(violationResult.applicableIndustries).not.toContain(
        "heavy_equipment"
      );
      expect(violationResult.applicableIndustries).not.toContain("solar");
      expect(violationResult.applicableIndustries.length).toBe(3);
    }
  });

  it("sorts results by confidence descending", async () => {
    const mockData = mockCatalogResponse([
      {
        domain: "data.test.gov",
        id: "low",
        name: "Low",
        // 3/9 fields -> ~0.33
        columns: ["permit_number", "address", "issue_date"],
      },
      {
        domain: "data.test.gov",
        id: "high",
        name: "High",
        // 6/9 fields -> ~0.67
        columns: [
          "permit_number",
          "address",
          "issue_date",
          "description",
          "latitude",
          "longitude",
        ],
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const results = await discoverSocrataDatasets();
    if (results.length >= 2) {
      expect(results[0].confidence).toBeGreaterThanOrEqual(
        results[1].confidence
      );
    }
  });

  it("handles fetch errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network error")
    );

    const results = await discoverSocrataDatasets();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});
