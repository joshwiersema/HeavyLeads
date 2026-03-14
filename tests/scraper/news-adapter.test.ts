import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";
import { extractLocation, isConstructionRelevant } from "@/lib/scraper/adapters/utils";

// We'll test through the ENR adapter as the representative RSS adapter
// since all three (ENR, Construction Dive, PR Newswire) share the same pattern

describe("RSS News Adapters", () => {
  // Mock rss-parser module
  const mockParseURL = vi.fn();

  beforeEach(() => {
    vi.mock("rss-parser", () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          parseURL: mockParseURL,
        })),
      };
    });
    mockParseURL.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("EnrNewsAdapter", () => {
    it("filters non-construction items and returns only relevant ones", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "New Construction Project Breaks Ground in Dallas, TX",
            contentSnippet: "A major commercial construction project begins",
            link: "https://enr.com/article/1",
            pubDate: "2026-03-10T00:00:00Z",
          },
          {
            title: "Stock Market Falls on Economic Concerns",
            contentSnippet: "Investors worry about inflation",
            link: "https://enr.com/article/2",
            pubDate: "2026-03-10T00:00:00Z",
          },
          {
            title: "Bridge Renovation Project Approved",
            contentSnippet: "Highway bridge getting major overhaul",
            link: "https://enr.com/article/3",
            pubDate: "2026-03-09T00:00:00Z",
          },
        ],
      });

      const adapter = new EnrNewsAdapter();
      const results = await adapter.scrape();

      // Should filter out the stock market article
      expect(results.length).toBe(2);
      expect(results.every((r) => r.sourceType === "news")).toBe(true);
    });

    it("maps RSS fields correctly (title, sourceUrl, postedDate, sourceType='news')", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "Major Infrastructure Project Announced",
            contentSnippet: "Large-scale bridge construction project",
            link: "https://enr.com/article/100",
            pubDate: "2026-03-10T12:00:00Z",
          },
        ],
      });

      const adapter = new EnrNewsAdapter();
      const results = await adapter.scrape();

      expect(results.length).toBe(1);
      const result = results[0];
      expect(result.title).toBe("Major Infrastructure Project Announced");
      expect(result.description).toBe("Large-scale bridge construction project");
      expect(result.sourceUrl).toBe("https://enr.com/article/100");
      expect(result.sourceType).toBe("news");
      expect(result.postedDate).toEqual(new Date("2026-03-10T12:00:00Z"));
    });

    it("validates against rawLeadSchema", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "Construction Equipment Expo Opens",
            contentSnippet: "Annual heavy equipment show features new crane models",
            link: "https://enr.com/article/200",
            pubDate: "2026-03-08T00:00:00Z",
          },
        ],
      });

      const adapter = new EnrNewsAdapter();
      const results = await adapter.scrape();

      for (const result of results) {
        const parsed = rawLeadSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      }
    });

    it("each result has externalId set to article URL", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "New Building Construction Begins",
            contentSnippet: "Residential construction project underway",
            link: "https://enr.com/article/300",
            pubDate: "2026-03-07T00:00:00Z",
          },
        ],
      });

      const adapter = new EnrNewsAdapter();
      const results = await adapter.scrape();

      expect(results.length).toBe(1);
      expect(results[0].externalId).toBe("https://enr.com/article/300");
    });

    it("returns empty array on parse error", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      mockParseURL.mockRejectedValue(new Error("XML parse error"));

      const adapter = new EnrNewsAdapter();
      const results = await adapter.scrape();

      expect(results).toEqual([]);
    });

    it("has correct adapter metadata", async () => {
      const { EnrNewsAdapter } = await import(
        "@/lib/scraper/adapters/enr-news"
      );

      const adapter = new EnrNewsAdapter();
      expect(adapter.sourceId).toBe("enr-news");
      expect(adapter.sourceName).toBe("Engineering News-Record");
      expect(adapter.sourceType).toBe("news");
    });
  });

  describe("ConstructionDiveNewsAdapter", () => {
    it("parses feeds and returns sourceType='news'", async () => {
      const { ConstructionDiveNewsAdapter } = await import(
        "@/lib/scraper/adapters/construction-dive-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "Demolition of Historic Building Set for Spring",
            contentSnippet: "Commercial demolition project approved",
            link: "https://constructiondive.com/news/1",
            pubDate: "2026-03-06T00:00:00Z",
          },
        ],
      });

      const adapter = new ConstructionDiveNewsAdapter();
      const results = await adapter.scrape();

      expect(results.length).toBe(1);
      expect(results[0].sourceType).toBe("news");
      expect(results[0].externalId).toBe("https://constructiondive.com/news/1");
    });

    it("has correct adapter metadata", async () => {
      const { ConstructionDiveNewsAdapter } = await import(
        "@/lib/scraper/adapters/construction-dive-news"
      );

      const adapter = new ConstructionDiveNewsAdapter();
      expect(adapter.sourceId).toBe("construction-dive-news");
      expect(adapter.sourceName).toBe("Construction Dive");
      expect(adapter.sourceType).toBe("news");
    });
  });

  describe("PrNewswireNewsAdapter", () => {
    it("parses feeds and returns sourceType='news'", async () => {
      const { PrNewswireNewsAdapter } = await import(
        "@/lib/scraper/adapters/prnewswire-news"
      );

      mockParseURL.mockResolvedValue({
        items: [
          {
            title: "Contractor Announces New Industrial Project",
            contentSnippet: "Leading contractor breaks ground on factory",
            link: "https://prnewswire.com/news/1",
            pubDate: "2026-03-05T00:00:00Z",
          },
        ],
      });

      const adapter = new PrNewswireNewsAdapter();
      const results = await adapter.scrape();

      expect(results.length).toBe(1);
      expect(results[0].sourceType).toBe("news");
      expect(results[0].externalId).toBe("https://prnewswire.com/news/1");
    });

    it("has correct adapter metadata", async () => {
      const { PrNewswireNewsAdapter } = await import(
        "@/lib/scraper/adapters/prnewswire-news"
      );

      const adapter = new PrNewswireNewsAdapter();
      expect(adapter.sourceId).toBe("prnewswire-news");
      expect(adapter.sourceName).toBe("PR Newswire Construction");
      expect(adapter.sourceType).toBe("news");
    });
  });
});

describe("extractLocation", () => {
  it("extracts city/state from 'in Dallas, TX' pattern", () => {
    const result = extractLocation(
      "A new project broke ground in Dallas, TX last week"
    );
    expect(result).toEqual({ city: "Dallas", state: "TX" });
  });

  it("extracts city/state from 'in Austin, Texas' pattern", () => {
    const result = extractLocation(
      "Construction begins in Austin, Texas this spring"
    );
    expect(result).toEqual({ city: "Austin", state: "TX" });
  });

  it("extracts city/state from 'City, ST' without 'in' prefix", () => {
    const result = extractLocation("Denver, CO construction market booming");
    expect(result).toEqual({ city: "Denver", state: "CO" });
  });

  it("returns empty object for text without location", () => {
    const result = extractLocation("Stock market hits new high");
    expect(result).toEqual({});
  });

  it("returns empty object for empty string", () => {
    const result = extractLocation("");
    expect(result).toEqual({});
  });
});

describe("isConstructionRelevant", () => {
  it("returns true for construction keywords in title", () => {
    expect(isConstructionRelevant("New Construction Project Announced")).toBe(
      true
    );
    expect(isConstructionRelevant("Bridge Renovation Complete")).toBe(true);
    expect(isConstructionRelevant("Heavy Equipment Sale")).toBe(true);
  });

  it("returns true for construction keywords in description", () => {
    expect(
      isConstructionRelevant("Article Title", "A new demolition project begins")
    ).toBe(true);
  });

  it("returns false for non-construction content", () => {
    expect(
      isConstructionRelevant(
        "Stock Market Falls",
        "Investors worried about inflation"
      )
    ).toBe(false);
  });

  it("handles undefined title and description", () => {
    expect(isConstructionRelevant(undefined, undefined)).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isConstructionRelevant("CONSTRUCTION PROJECT")).toBe(true);
    expect(isConstructionRelevant("Highway Expansion")).toBe(true);
  });
});
