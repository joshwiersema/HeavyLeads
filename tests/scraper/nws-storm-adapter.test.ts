import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

vi.mock("@/lib/scraper/api-rate-limiter", () => ({
  getNwsQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}));

const mockNwsResponse = {
  type: "FeatureCollection",
  features: [
    {
      properties: {
        id: "urn:oid:2.49.0.1.840.0.2026.03.16.12.30.00",
        headline: "Severe Thunderstorm Warning issued March 16",
        description:
          "The National Weather Service has issued a severe thunderstorm warning for the Dallas-Fort Worth area. Large hail and damaging winds expected.",
        event: "Severe Thunderstorm Warning",
        severity: "Severe",
        effective: "2026-03-16T12:00:00-05:00",
        expires: "2026-03-16T14:00:00-05:00",
        senderName: "NWS Fort Worth TX",
        areaDesc: "Dallas, TX; Tarrant, TX; Denton, TX",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-97.0, 33.0],
            [-96.0, 33.0],
            [-96.0, 32.0],
            [-97.0, 32.0],
            [-97.0, 33.0],
          ],
        ],
      },
    },
    {
      properties: {
        id: "urn:oid:2.49.0.1.840.0.2026.03.16.13.00.00",
        headline: "Tornado Warning issued March 16",
        description: "A tornado has been sighted near Arlington.",
        event: "Tornado Warning",
        severity: "Extreme",
        effective: "2026-03-16T13:00:00-05:00",
        expires: "2026-03-16T14:30:00-05:00",
        senderName: "NWS Fort Worth TX",
        areaDesc: "Arlington, TX",
      },
      geometry: {
        type: "Point",
        coordinates: [-97.1, 32.7],
      },
    },
    {
      properties: {
        id: "urn:oid:2.49.0.1.840.0.2026.03.16.14.00.00",
        headline: "Winter Storm Watch issued March 16",
        description: "A winter storm is expected to bring heavy snow.",
        event: "Winter Storm Watch",
        severity: "Moderate",
        effective: "2026-03-16T14:00:00-05:00",
        expires: "2026-03-17T14:00:00-05:00",
        senderName: "NWS Chicago IL",
        areaDesc: "Cook, IL; DuPage, IL",
      },
      geometry: null,
    },
    {
      properties: {
        id: "urn:oid:2.49.0.1.840.0.2026.03.16.15.00.00",
        headline: "Flash Flood Warning issued March 16",
        description: "Flash flooding is occurring in the Houston area.",
        event: "Flash Flood Warning",
        severity: "Severe",
        effective: "2026-03-16T15:00:00-05:00",
        expires: "2026-03-16T18:00:00-05:00",
        senderName: "NWS Houston TX",
        areaDesc: "Houston, TX; Harris, TX",
      },
      geometry: null,
    },
  ],
};

describe("NwsStormAdapter", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct adapter metadata", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    expect(adapter.sourceId).toBe("nws-storm-alerts");
    expect(adapter.sourceName).toBe("NWS Active Storm Alerts");
    expect(adapter.sourceType).toBe("storm");
  });

  it("filters for roofing-relevant events only", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    // Should include: Severe Thunderstorm Warning, Tornado Warning, Flash Flood Warning
    // Should exclude: Winter Storm Watch (not roofing-relevant)
    expect(results).toHaveLength(3);
    const events = results.map((r) => r.title);
    expect(events).toContain("Severe Thunderstorm Warning issued March 16");
    expect(events).toContain("Tornado Warning issued March 16");
    expect(events).toContain("Flash Flood Warning issued March 16");
  });

  it("computes centroid from Polygon geometry", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    // First feature is a Polygon: centroid of [(-97,33),(-96,33),(-96,32),(-97,32),(-97,33)]
    // Average of unique 4 corners: lat=(33+33+32+32)/4=32.5, lng=(-97-96-96-97)/4=-96.5
    // Note: centroid includes closing point so 5 points: avg lat = (33+33+32+32+33)/5 = 32.6
    const polygonResult = results.find((r) =>
      r.externalId?.includes("12.30.00")
    );
    expect(polygonResult).toBeDefined();
    expect(polygonResult!.lat).toBeCloseTo(32.6, 1);
    expect(polygonResult!.lng).toBeCloseTo(-96.6, 1);
  });

  it("uses Point geometry coordinates directly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    // Second feature is a Point: [-97.1, 32.7]
    const pointResult = results.find((r) =>
      r.externalId?.includes("13.00.00")
    );
    expect(pointResult).toBeDefined();
    expect(pointResult!.lat).toBeCloseTo(32.7, 1);
    expect(pointResult!.lng).toBeCloseTo(-97.1, 1);
  });

  it("maps all fields correctly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    const first = results.find((r) => r.externalId?.includes("12.30.00"));
    expect(first).toBeDefined();
    expect(first!.sourceType).toBe("storm");
    expect(first!.title).toBe("Severe Thunderstorm Warning issued March 16");
    expect(first!.externalId).toBe(
      "urn:oid:2.49.0.1.840.0.2026.03.16.12.30.00"
    );
    expect(first!.description).toContain("severe thunderstorm warning");
    expect(first!.state).toBe("TX");
    expect(first!.city).toBe("Dallas");
    expect(first!.postedDate).toBeInstanceOf(Date);
    expect(first!.deadlineDate).toBeInstanceOf(Date);
    expect(first!.sourceUrl).toContain("alerts.weather.gov");
    expect(first!.sourceUrl).toContain("2.49.0.1.840.0.2026.03.16.12.30.00");
  });

  it("returns valid RawLeadData that passes Zod validation", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
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

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("returns [] on non-200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("returns [] on empty features", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();
    expect(results).toEqual([]);
  });

  it("handles null geometry gracefully (no lat/lng)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNwsResponse,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    // Flash Flood Warning has null geometry
    const floodResult = results.find((r) =>
      r.externalId?.includes("15.00.00")
    );
    expect(floodResult).toBeDefined();
    expect(floodResult!.lat).toBeUndefined();
    expect(floodResult!.lng).toBeUndefined();
  });

  it("sends User-Agent header in fetch request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    });
    globalThis.fetch = fetchMock;

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    await adapter.scrape();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers?.["User-Agent"]).toContain("LeadForge");
  });

  it("truncates long descriptions to 2000 chars", async () => {
    const longDesc = "A".repeat(3000);
    const response = {
      type: "FeatureCollection",
      features: [
        {
          properties: {
            id: "test-long-desc",
            headline: "Tornado Warning",
            description: longDesc,
            event: "Tornado Warning",
            severity: "Extreme",
            effective: "2026-03-16T13:00:00-05:00",
            expires: "2026-03-16T14:30:00-05:00",
            senderName: "NWS Test TX",
            areaDesc: "Test, TX",
          },
          geometry: null,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    });

    const { NwsStormAdapter } = await import(
      "@/lib/scraper/adapters/nws-storm-adapter"
    );
    const adapter = new NwsStormAdapter();
    const results = await adapter.scrape();

    expect(results[0].description!.length).toBeLessThanOrEqual(2000);
  });
});
