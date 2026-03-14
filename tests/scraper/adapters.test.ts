import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawPermitSchema } from "@/lib/scraper/adapters/base-adapter";
import type { ScraperAdapter } from "@/lib/scraper/adapters/base-adapter";
import { registerAdapter, getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";

// ─── Socrata fixture data (matches real API response shapes) ───

const austinSocrataFixture = [
  {
    permit_number: "2026-012345",
    description: "New commercial office building",
    permit_location: "1100 Congress Ave, Austin, TX 78701",
    permit_type_desc: "Commercial - New Construction",
    issue_date: "2026-02-15T00:00:00.000",
    latitude: "30.2747",
    longitude: "-97.7404",
  },
  {
    permit_number: "2026-012346",
    description: "Residential addition",
    permit_location: "2500 Lake Austin Blvd, Austin, TX 78703",
    permit_type_desc: "Residential - Addition",
    issue_date: "2026-02-16T00:00:00.000",
    latitude: "30.2890",
    longitude: "-97.7780",
  },
];

const dallasSocrataFixture = [
  {
    permit_number: "BLD2026-00100",
    work_description: "Interior renovation of office space",
    street_address: "500 Commerce St, Dallas, TX 75201",
    permit_type: "Building (COM)",
    value: "750000",
    contractor: "Smith Construction LLC",
    issued_date: "2026-02-20T00:00:00.000",
  },
  {
    permit_number: "BLD2026-00101",
    work_description: "New restaurant buildout",
    street_address: "1900 Main St, Dallas, TX 75201",
    permit_type: "Building (COM)",
    value: "320000",
    contractor: "Metro Builders Inc",
    issued_date: "2026-02-21T00:00:00.000",
  },
];

// ─── ArcGIS GeoJSON fixture data ───

const atlantaArcGISFixture = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        permit_number: "ATL-2026-001",
        address: "191 Peachtree St NE, Atlanta, GA 30303",
        permit_type: "Building Permit",
        status: "Issued",
        issue_date: "2026-02-18",
        description: "High-rise mixed-use development",
      },
      geometry: {
        type: "Point",
        coordinates: [-84.3880, 33.7590],
      },
    },
    {
      type: "Feature",
      properties: {
        permit_number: "ATL-2026-002",
        address: "250 Spring St NW, Atlanta, GA 30303",
        permit_type: "Demolition Permit",
        status: "Issued",
        issue_date: "2026-02-19",
        description: "Demolition of existing structure",
      },
      geometry: {
        type: "Point",
        coordinates: [-84.3920, 33.7580],
      },
    },
  ],
};

// ─── Mock fetch ───

const originalFetch = global.fetch;

beforeEach(() => {
  clearAdapters();
});

afterEach(() => {
  global.fetch = originalFetch;
  clearAdapters();
});

// ─── Austin Adapter Tests ───

describe("AustinPermitsAdapter", () => {
  it("implements ScraperAdapter interface (has sourceId, sourceName, jurisdiction, scrape method)", async () => {
    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter: ScraperAdapter = new AustinPermitsAdapter();

    expect(adapter.sourceId).toBe("austin-tx-permits");
    expect(adapter.sourceName).toBe(
      "City of Austin Issued Construction Permits"
    );
    expect(adapter.jurisdiction).toBe("Austin, TX");
    expect(typeof adapter.scrape).toBe("function");
  });

  it("calls the Socrata SODA endpoint for dataset 3syk-w9eu with $where date filter and $limit", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify(austinSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    expect(capturedUrl).toContain(
      "https://data.austintexas.gov/resource/3syk-w9eu.json"
    );
    // URLSearchParams encodes $ as %24
    expect(capturedUrl).toContain("%24where=");
    expect(capturedUrl).toContain("issue_date");
    expect(capturedUrl).toContain("%24limit=1000");
  });

  it("maps Socrata fields to RawPermitData (permit_number -> permitNumber, permit_location -> address, latitude/longitude preserved)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(austinSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(2);

    const first = results[0];
    expect(first.permitNumber).toBe("2026-012345");
    expect(first.description).toBe("New commercial office building");
    expect(first.address).toBe("1100 Congress Ave, Austin, TX 78701");
    expect(first.projectType).toBe("Commercial - New Construction");
    expect(first.permitDate).toBeInstanceOf(Date);

    // Austin includes lat/lng from source
    expect(first.lat).toBeCloseTo(30.2747, 3);
    expect(first.lng).toBeCloseTo(-97.7404, 3);
  });

  it("returns data that passes Zod validation", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(austinSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawPermitSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });

  it("handles API error (non-200 response) by throwing descriptive error", async () => {
    global.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();

    await expect(adapter.scrape()).rejects.toThrow(/500|error|failed/i);
  });

  it("handles empty result set gracefully (returns empty array)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });
});

// ─── Dallas Adapter Tests ───

describe("DallasPermitsAdapter", () => {
  it("implements ScraperAdapter interface", async () => {
    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter: ScraperAdapter = new DallasPermitsAdapter();

    expect(adapter.sourceId).toBe("dallas-tx-permits");
    expect(adapter.sourceName).toBe("City of Dallas Building Permits");
    expect(adapter.jurisdiction).toBe("Dallas, TX");
    expect(typeof adapter.scrape).toBe("function");
  });

  it("calls the Socrata SODA endpoint for dataset e7gq-4sah", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify(dallasSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    await adapter.scrape();

    expect(capturedUrl).toContain(
      "https://www.dallasopendata.com/resource/e7gq-4sah.json"
    );
    // URLSearchParams encodes $ as %24
    expect(capturedUrl).toContain("%24where=");
    expect(capturedUrl).toContain("issued_date");
    expect(capturedUrl).toContain("%24limit=1000");
  });

  it("maps Socrata fields to RawPermitData (permit_number -> permitNumber, street_address -> address, value -> estimatedValue, contractor -> applicantName)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(dallasSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(2);

    const first = results[0];
    expect(first.permitNumber).toBe("BLD2026-00100");
    expect(first.description).toBe("Interior renovation of office space");
    expect(first.address).toBe("500 Commerce St, Dallas, TX 75201");
    expect(first.projectType).toBe("Building (COM)");
    expect(first.estimatedValue).toBe(750000);
    expect(first.applicantName).toBe("Smith Construction LLC");
    expect(first.permitDate).toBeInstanceOf(Date);
  });

  it("does NOT provide lat/lng (Dallas dataset lacks coordinates)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(dallasSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      expect(record.lat).toBeUndefined();
      expect(record.lng).toBeUndefined();
    }
  });

  it("returns data that passes Zod validation", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(dallasSocrataFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawPermitSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });

  it("handles API error (non-200 response) by throwing descriptive error", async () => {
    global.fetch = vi.fn(async () => {
      return new Response("Not Found", { status: 404 });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();

    await expect(adapter.scrape()).rejects.toThrow(/404|error|failed/i);
  });

  it("handles empty result set gracefully (returns empty array)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });
});

// ─── Atlanta Adapter Tests ───

describe("AtlantaPermitsAdapter", () => {
  it("implements ScraperAdapter interface", async () => {
    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter: ScraperAdapter = new AtlantaPermitsAdapter();

    expect(adapter.sourceId).toBe("atlanta-ga-permits");
    expect(adapter.sourceName).toBe("City of Atlanta Building Permits");
    expect(adapter.jurisdiction).toBe("Atlanta, GA");
    expect(typeof adapter.scrape).toBe("function");
  });

  it("calls the ArcGIS REST API for the building permits feature service", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify(atlantaArcGISFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter = new AtlantaPermitsAdapter();
    await adapter.scrape();

    expect(capturedUrl).toContain("arcgis");
  });

  it("maps ArcGIS fields to RawPermitData", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(atlantaArcGISFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter = new AtlantaPermitsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(2);

    const first = results[0];
    expect(first.permitNumber).toBe("ATL-2026-001");
    expect(first.address).toBe("191 Peachtree St NE, Atlanta, GA 30303");
    expect(first.projectType).toBe("Building Permit");
    expect(first.description).toBe("High-rise mixed-use development");
    expect(first.permitDate).toBeInstanceOf(Date);

    // Atlanta ArcGIS includes coordinates from GeoJSON geometry
    expect(first.lat).toBeCloseTo(33.759, 2);
    expect(first.lng).toBeCloseTo(-84.388, 2);
  });

  it("returns data that passes Zod validation", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(atlantaArcGISFixture), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter = new AtlantaPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawPermitSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });

  it("handles API error (non-200 response) by throwing descriptive error", async () => {
    global.fetch = vi.fn(async () => {
      return new Response("Service Unavailable", { status: 503 });
    }) as unknown as typeof fetch;

    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter = new AtlantaPermitsAdapter();

    await expect(adapter.scrape()).rejects.toThrow(/503|error|failed/i);
  });

  it("handles empty feature collection gracefully (returns empty array)", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ type: "FeatureCollection", features: [] }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const { AtlantaPermitsAdapter } = await import(
      "@/lib/scraper/adapters/atlanta-permits"
    );
    const adapter = new AtlantaPermitsAdapter();
    const results = await adapter.scrape();

    expect(results).toEqual([]);
  });
});

// ─── Adapter Registration Tests ───

describe("initializeAdapters", () => {
  it("registers all three adapters in the registry", async () => {
    const { initializeAdapters } = await import(
      "@/lib/scraper/adapters/index"
    );

    initializeAdapters();
    const adapters = getRegisteredAdapters();

    expect(adapters.length).toBe(8);
    const sourceIds = adapters.map((a) => a.sourceId);
    // Permit adapters
    expect(sourceIds).toContain("austin-tx-permits");
    expect(sourceIds).toContain("dallas-tx-permits");
    expect(sourceIds).toContain("atlanta-ga-permits");
    // Bid board adapters
    expect(sourceIds).toContain("sam-gov-bids");
    // News adapters
    expect(sourceIds).toContain("enr-news");
    expect(sourceIds).toContain("construction-dive-news");
    expect(sourceIds).toContain("prnewswire-news");
    // Deep web adapters
    expect(sourceIds).toContain("google-dorking");
  });
});

// ─── Pluggability Tests ───

describe("Adapter pluggability", () => {
  it("new adapter can be added by creating and registering it -- no pipeline changes needed", async () => {
    const { initializeAdapters } = await import(
      "@/lib/scraper/adapters/index"
    );

    // Register the 8 built-in adapters
    initializeAdapters();

    // Create and register a custom 9th adapter
    const customAdapter: ScraperAdapter = {
      sourceId: "houston-tx-permits",
      sourceName: "City of Houston Building Permits",
      sourceType: "permit",
      jurisdiction: "Houston, TX",
      scrape: async () => [],
    };
    registerAdapter(customAdapter);

    const adapters = getRegisteredAdapters();
    expect(adapters.length).toBe(9);
    expect(adapters.map((a) => a.sourceId)).toContain("houston-tx-permits");
  });
});
