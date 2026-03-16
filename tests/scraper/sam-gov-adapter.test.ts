import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SamGovBidsAdapter } from "@/lib/scraper/adapters/sam-gov-bids";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";
import { getSamGovQueue } from "@/lib/scraper/api-rate-limiter";

vi.mock("@/lib/scraper/api-rate-limiter", () => ({
  getSamGovQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}));

describe("SamGovBidsAdapter", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.SAM_GOV_API_KEY;

  const mockSamGovResponse = {
    opportunitiesData: [
      {
        noticeId: "SAM-2026-001",
        title: "Federal Office Building Renovation",
        description: "Complete renovation of federal office building including HVAC",
        department: "General Services Administration",
        subtier: "Public Buildings Service",
        postedDate: "2026-03-01",
        responseDeadLine: "2026-04-15",
        officeAddress: {
          city: "Washington",
          state: "DC",
        },
        award: {
          amount: "5000000",
        },
      },
      {
        noticeId: "SAM-2026-002",
        title: "Highway Bridge Repair Project",
        description: "Structural repair and resurfacing of interstate bridge",
        department: "Department of Transportation",
        subtier: "Federal Highway Administration",
        postedDate: "2026-03-05",
        responseDeadLine: "2026-04-20",
        officeAddress: {
          city: "Denver",
          state: "CO",
        },
      },
    ],
  };

  beforeEach(() => {
    process.env.SAM_GOV_API_KEY = "test-api-key-123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.SAM_GOV_API_KEY;
    } else {
      process.env.SAM_GOV_API_KEY = originalEnv;
    }
  });

  it("returns valid RawLeadData with sourceType='bid' from mocked response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSamGovResponse,
    });

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.sourceType).toBe("bid");
      // Validate against the schema
      const parsed = rawLeadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("maps SAM.gov response fields correctly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSamGovResponse,
    });

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    // Find the first result (should map from first opportunity)
    const first = results.find((r) => r.externalId === "SAM-2026-001");
    expect(first).toBeDefined();
    expect(first!.title).toBe("Federal Office Building Renovation");
    expect(first!.description).toContain("renovation");
    expect(first!.agencyName).toBe("General Services Administration");
    expect(first!.city).toBe("Washington");
    expect(first!.state).toBe("DC");
    expect(first!.sourceUrl).toContain("SAM-2026-001");
    expect(first!.estimatedValue).toBe(5000000);
  });

  it("returns empty array when SAM_GOV_API_KEY is not set", async () => {
    delete process.env.SAM_GOV_API_KEY;

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("returns empty array on fetch error (non-200)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("each result has externalId (noticeId) set", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSamGovResponse,
    });

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    for (const result of results) {
      expect(result.externalId).toBeDefined();
      expect(result.externalId!.length).toBeGreaterThan(0);
    }
  });

  it("queries using construction NAICS codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ opportunitiesData: [] }),
    });
    globalThis.fetch = fetchMock;

    const adapter = new SamGovBidsAdapter();
    await adapter.scrape();

    // Should have been called for each NAICS code (236, 237, 238)
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const urls = fetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls.some((u: string) => u.includes("ncode=236"))).toBe(true);
    expect(urls.some((u: string) => u.includes("ncode=237"))).toBe(true);
    expect(urls.some((u: string) => u.includes("ncode=238"))).toBe(true);
  });

  it("continues scraping remaining NAICS codes when one fails", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockSamGovResponse,
      });
    });

    const adapter = new SamGovBidsAdapter();
    const results = await adapter.scrape();

    // Should still get results from the successful calls
    expect(results.length).toBeGreaterThan(0);
  });

  it("has correct adapter metadata", () => {
    const adapter = new SamGovBidsAdapter();
    expect(adapter.sourceId).toBe("sam-gov-bids");
    expect(adapter.sourceName).toBe("SAM.gov Federal Contract Opportunities");
    expect(adapter.sourceType).toBe("bid");
  });

  it("uses custom NAICS codes when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ opportunitiesData: [] }),
    });
    globalThis.fetch = fetchMock;

    const adapter = new SamGovBidsAdapter({ naicsCodes: ["238220"] });
    await adapter.scrape();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("ncode=238220");
  });

  it("trims SAM_GOV_API_KEY env var", async () => {
    process.env.SAM_GOV_API_KEY = "test-api-key-123\n";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ opportunitiesData: [] }),
    });
    globalThis.fetch = fetchMock;

    const adapter = new SamGovBidsAdapter({ naicsCodes: ["236"] });
    await adapter.scrape();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("api_key=test-api-key-123");
    expect(url).not.toContain("api_key=test-api-key-123%0A");
    expect(url).not.toContain("api_key=test-api-key-123\n");
  });

  it("routes API calls through getSamGovQueue rate limiter", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ opportunitiesData: [] }),
    });

    const adapter = new SamGovBidsAdapter();
    await adapter.scrape();

    expect(getSamGovQueue).toHaveBeenCalled();
  });
});
