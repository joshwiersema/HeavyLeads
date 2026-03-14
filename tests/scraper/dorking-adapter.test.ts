import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleDorkingAdapter } from "@/lib/scraper/adapters/google-dorking";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

describe("GoogleDorkingAdapter", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.SERPER_API_KEY;

  const mockSerperResponse = {
    organic: [
      {
        title: "Heavy Equipment Operator Job - Austin, TX",
        snippet:
          "Hiring heavy equipment operator for large construction project in Austin, TX. Experience with cranes and excavators required.",
        link: "https://example.com/job/123",
        date: "2026-03-10",
      },
      {
        title: "Contract Awarded: Highway Bridge Project",
        snippet:
          "$5M contract awarded for highway bridge reconstruction in Denver, CO. Construction expected to begin Q2 2026.",
        link: "https://example.com/contract/456",
      },
      {
        title: "Request for Proposal: Federal Building Renovation",
        snippet:
          "RFP for renovation of federal office complex. Interested contractors should apply by April 2026.",
        link: "https://example.com/rfp/789",
        date: "2026-03-08",
      },
    ],
  };

  beforeEach(() => {
    process.env.SERPER_API_KEY = "test-serper-key-123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.SERPER_API_KEY;
    } else {
      process.env.SERPER_API_KEY = originalEnv;
    }
  });

  it("returns valid RawLeadData with sourceType='deep-web' from mocked response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSerperResponse,
    });

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.sourceType).toBe("deep-web");
      const parsed = rawLeadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("maps Serper response fields correctly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSerperResponse,
    });

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    const first = results.find((r) => r.sourceUrl === "https://example.com/job/123");
    expect(first).toBeDefined();
    expect(first!.title).toBe("Heavy Equipment Operator Job - Austin, TX");
    expect(first!.description).toContain("heavy equipment operator");
    expect(first!.sourceType).toBe("deep-web");
    expect(first!.externalId).toBe("https://example.com/job/123");
  });

  it("returns empty array when SERPER_API_KEY is not set", async () => {
    delete process.env.SERPER_API_KEY;

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("each result has externalId set to result URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSerperResponse,
    });

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    for (const result of results) {
      expect(result.externalId).toBeDefined();
      expect(result.externalId!.startsWith("http")).toBe(true);
      // externalId should equal sourceUrl for deep-web results
      expect(result.externalId).toBe(result.sourceUrl);
    }
  });

  it("only stores metadata (title, snippet, URL) - no link-following behavior", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSerperResponse,
    });
    globalThis.fetch = fetchMock;

    const adapter = new GoogleDorkingAdapter();
    await adapter.scrape();

    // All fetch calls should be to Serper.dev API only
    for (const call of fetchMock.mock.calls) {
      const url = call[0] as string;
      expect(url).toBe("https://google.serper.dev/search");
    }
  });

  it("respects daily query budget (does not exceed DAILY_QUERY_BUDGET queries)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });
    globalThis.fetch = fetchMock;

    const adapter = new GoogleDorkingAdapter();
    await adapter.scrape();

    // Should not exceed DAILY_QUERY_BUDGET (50) calls
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(50);
    // But should make at least 1 call
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("sends correct headers to Serper API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });
    globalThis.fetch = fetchMock;

    const adapter = new GoogleDorkingAdapter();
    await adapter.scrape();

    const firstCall = fetchMock.mock.calls[0];
    const options = firstCall[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["X-API-KEY"]).toBe(
      "test-serper-key-123"
    );
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("continues on individual query errors", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockSerperResponse,
      });
    });

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    // Should still get results from successful queries
    expect(results.length).toBeGreaterThan(0);
  });

  it("handles empty organic results gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });

    const adapter = new GoogleDorkingAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });

  it("has correct adapter metadata", () => {
    const adapter = new GoogleDorkingAdapter();
    expect(adapter.sourceId).toBe("google-dorking");
    expect(adapter.sourceName).toBe("Google Deep Web Search");
    expect(adapter.sourceType).toBe("deep-web");
  });
});
