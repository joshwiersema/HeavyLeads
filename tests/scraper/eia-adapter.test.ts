import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

// ─── Mock rate limiter (pass-through queue) ───

vi.mock("@/lib/scraper/api-rate-limiter", () => ({
  getEiaQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}));

// ─── EIA API response fixture ───

const eiaResponseFixture = {
  response: {
    data: [
      {
        period: "2025",
        stateDescription: "California",
        stateId: "CA",
        sectorName: "residential",
        price: 28.5,
      },
      {
        period: "2025",
        stateDescription: "Texas",
        stateId: "TX",
        sectorName: "residential",
        price: 13.2,
      },
      {
        period: "2025",
        stateDescription: "New York",
        stateId: "NY",
        sectorName: "residential",
        price: 22.8,
      },
    ],
  },
};

// ─── Helpers ───

const originalFetch = globalThis.fetch;
const originalEnv = process.env.EIA_API_KEY;

beforeEach(() => {
  process.env.EIA_API_KEY = "test-eia-key-123";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv === undefined) {
    delete process.env.EIA_API_KEY;
  } else {
    process.env.EIA_API_KEY = originalEnv;
  }
});

describe("EiaUtilityRateAdapter", () => {
  it("returns valid RawLeadData from EIA API response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => eiaResponseFixture,
    });

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(3);

    for (const result of results) {
      expect(result.sourceType).toBe("news");
      const parsed = rawLeadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("maps EIA state data to RawLeadData correctly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => eiaResponseFixture,
    });

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    const caRecord = results.find((r) => r.state === "CA");
    expect(caRecord).toBeDefined();
    expect(caRecord!.title).toContain("California");
    expect(caRecord!.title).toContain("28.5");
    expect(caRecord!.title).toContain("cents/kWh");
    expect(caRecord!.state).toBe("CA");
    expect(caRecord!.sourceType).toBe("news");
  });

  it("returns empty array when EIA_API_KEY is not set", async () => {
    delete process.env.EIA_API_KEY;

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("trims EIA_API_KEY env var (Vercel paste issue)", async () => {
    process.env.EIA_API_KEY = "test-eia-key-123\n";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => eiaResponseFixture,
    });
    globalThis.fetch = fetchMock;

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    await adapter.scrape();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("api_key=test-eia-key-123");
    expect(url).not.toContain("api_key=test-eia-key-123%0A");
  });

  it("returns empty array on API error (non-200)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("returns empty array on fetch exception", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("has correct adapter metadata", async () => {
    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    expect(adapter.sourceId).toBe("eia-utility-rates");
    expect(adapter.sourceName).toBe("EIA Residential Electricity Rates");
    expect(adapter.sourceType).toBe("news");
  });

  it("fetches from EIA API v2 electricity endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => eiaResponseFixture,
    });
    globalThis.fetch = fetchMock;

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    await adapter.scrape();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("api.eia.gov/v2/electricity/retail-sales/data");
    expect(url).toContain("frequency=annual");
    expect(url).toContain("data%5B0%5D=price");
  });

  it("handles empty API response gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: { data: [] } }),
    });

    const { EiaUtilityRateAdapter } = await import(
      "@/lib/scraper/adapters/eia-utility-rates"
    );
    const adapter = new EiaUtilityRateAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });
});
