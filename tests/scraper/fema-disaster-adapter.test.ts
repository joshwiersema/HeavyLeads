import { describe, it, expect, vi, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

const mockFemaResponse = {
  DisasterDeclarations: [
    {
      disasterNumber: 4799,
      declarationDate: "2026-02-10T00:00:00.000Z",
      state: "TX",
      designatedArea: "Harris County (County)",
      incidentType: "Hurricane",
      declarationType: "Major Disaster",
      title: "HURRICANE DELTA",
    },
    {
      disasterNumber: 4800,
      declarationDate: "2026-01-15T00:00:00.000Z",
      state: "FL",
      designatedArea: "Miami-Dade County",
      incidentType: "Severe Storm",
      declarationType: "Major Disaster",
      title: "SEVERE STORMS AND FLOODING",
    },
    {
      disasterNumber: 4801,
      declarationDate: "2026-03-01T00:00:00.000Z",
      state: "CA",
      designatedArea: "Los Angeles County",
      incidentType: "Fire",
      declarationType: "Major Disaster",
      title: "CALIFORNIA WILDFIRES",
    },
  ],
};

describe("FemaDisasterAdapter", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct adapter metadata", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ DisasterDeclarations: [] }),
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    expect(adapter.sourceId).toBe("fema-disaster-declarations");
    expect(adapter.sourceName).toBe("FEMA Disaster Declarations");
    expect(adapter.sourceType).toBe("disaster");
  });

  it("maps disaster declarations to RawLeadData correctly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFemaResponse,
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(3);

    const first = results.find((r) => r.externalId === "4799");
    expect(first).toBeDefined();
    expect(first!.title).toBe("HURRICANE DELTA");
    expect(first!.sourceType).toBe("disaster");
    expect(first!.state).toBe("TX");
    expect(first!.description).toContain("Hurricane");
    expect(first!.description).toContain("Harris County");
    expect(first!.postedDate).toBeInstanceOf(Date);
    expect(first!.sourceUrl).toContain("4799");
  });

  it("returns valid RawLeadData that passes Zod validation", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFemaResponse,
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();

    for (const result of results) {
      const parsed = rawLeadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("returns [] on fetch error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("returns [] on non-200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("returns [] on empty DisasterDeclarations array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ DisasterDeclarations: [] }),
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("does not include lat/lng (FEMA is state-level)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFemaResponse,
    });

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    const results = await adapter.scrape();

    for (const result of results) {
      expect(result.lat).toBeUndefined();
      expect(result.lng).toBeUndefined();
    }
  });

  it("constructs FEMA API URL with $filter for recent declarations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ DisasterDeclarations: [] }),
    });
    globalThis.fetch = fetchMock;

    const { FemaDisasterAdapter } = await import(
      "@/lib/scraper/adapters/fema-disaster-adapter"
    );
    const adapter = new FemaDisasterAdapter();
    await adapter.scrape();

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("fema.gov");
    expect(url).toContain("DisasterDeclarations");
    // URLSearchParams encodes $ as %24
    expect(url).toContain("filter");
  });
});
