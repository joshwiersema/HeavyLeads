import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

// ─── Mock rate limiter (pass-through queue) ───

vi.mock("@/lib/scraper/api-rate-limiter", () => ({
  getSocrataQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}));

// ─── Fixture data ───

const austinFixture = [
  {
    permit_number: "2026-012345",
    description: "New commercial office building",
    permit_location: "1100 Congress Ave, Austin, TX 78701",
    permit_type_desc: "Commercial - New Construction",
    issue_date: "2026-02-15T00:00:00.000",
    latitude: "30.2747",
    longitude: "-97.7404",
  },
];

const dallasFixture = [
  {
    permit_number: "BLD2026-00100",
    work_description: "Interior renovation of office space",
    street_address: "500 Commerce St, Dallas, TX 75201",
    permit_type: "Building (COM)",
    value: "750000",
    contractor: "Smith Construction LLC",
    issued_date: "2026-02-20T00:00:00.000",
  },
];

// ─── Helpers ───

const originalFetch = global.fetch;
const originalEnv = process.env.SOCRATA_APP_TOKEN;

beforeEach(() => {
  delete process.env.SOCRATA_APP_TOKEN;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalEnv !== undefined) {
    process.env.SOCRATA_APP_TOKEN = originalEnv;
  } else {
    delete process.env.SOCRATA_APP_TOKEN;
  }
});

// ─── SODA3 Request Shape ───

describe("SocrataPermitAdapter — SODA3 request", () => {
  it("sends POST to /api/v3/views/{datasetId}/query.json", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? "GET";
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    expect(capturedUrl).toBe(
      "https://data.austintexas.gov/api/v3/views/3syk-w9eu/query.json"
    );
    expect(capturedMethod).toBe("POST");
  });

  it("sends request body with { query: 'SELECT * WHERE ...' } SoQL", async () => {
    let capturedBody = "";

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    const parsed = JSON.parse(capturedBody);
    expect(parsed.query).toMatch(/^SELECT \* WHERE issue_date > '/);
    expect(parsed.query).toMatch(/ORDER BY issue_date DESC LIMIT 1000$/);
  });
});

// ─── X-App-Token Header ───

describe("SocrataPermitAdapter — X-App-Token", () => {
  it("includes X-App-Token header when SOCRATA_APP_TOKEN is set", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token-abc123";
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    expect(capturedHeaders["X-App-Token"]).toBe("test-token-abc123");
  });

  it("trims trailing newlines from SOCRATA_APP_TOKEN (Vercel paste issue)", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token-abc123\n";
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    expect(capturedHeaders["X-App-Token"]).toBe("test-token-abc123");
  });

  it("omits X-App-Token header when env var is not set", async () => {
    delete process.env.SOCRATA_APP_TOKEN;
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    expect(capturedHeaders["X-App-Token"]).toBeUndefined();
  });
});

// ─── SODA2 Fallback ───

describe("SocrataPermitAdapter — SODA2 fallback", () => {
  it("falls back to SODA2 GET on SODA3 404 response", async () => {
    const calls: { url: string; method: string }[] = [];

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const method = init?.method ?? "GET";
      calls.push({ url: urlStr, method });

      // First call (SODA3) returns 404
      if (urlStr.includes("/api/v3/")) {
        return new Response("Not Found", { status: 404 });
      }
      // Second call (SODA2) returns data
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    expect(calls.length).toBe(2);
    // First call: SODA3 POST
    expect(calls[0].url).toContain("/api/v3/views/3syk-w9eu/query.json");
    expect(calls[0].method).toBe("POST");
    // Second call: SODA2 GET
    expect(calls[1].url).toContain(
      "https://data.austintexas.gov/resource/3syk-w9eu.json"
    );
    expect(calls[1].method).toBe("GET");
    expect(results.length).toBe(1);
  });

  it("falls back to SODA2 GET on SODA3 403 response", async () => {
    const calls: { url: string; method: string }[] = [];

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const method = init?.method ?? "GET";
      calls.push({ url: urlStr, method });

      if (urlStr.includes("/api/v3/")) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(JSON.stringify(dallasFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    expect(calls.length).toBe(2);
    expect(calls[0].url).toContain("/api/v3/views/e7gq-4sah/query.json");
    expect(calls[1].url).toContain(
      "https://www.dallasopendata.com/resource/e7gq-4sah.json"
    );
    expect(results.length).toBe(1);
  });

  it("SODA2 fallback uses $where, $limit, $order query params", async () => {
    let soda2Url = "";

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes("/api/v3/")) {
        return new Response("Not Found", { status: 404 });
      }
      soda2Url = urlStr;
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    await adapter.scrape();

    // URLSearchParams encodes $ as %24
    expect(soda2Url).toContain("%24where=");
    expect(soda2Url).toContain("issue_date");
    expect(soda2Url).toContain("%24limit=1000");
    expect(soda2Url).toContain("%24order=");
    expect(soda2Url).toContain("issue_date+DESC");
  });

  it("falls back to SODA2 on network error (fetch throws)", async () => {
    let callCount = 0;

    global.fetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();

      if (urlStr.includes("/api/v3/")) {
        throw new Error("Network error");
      }
      return new Response(JSON.stringify(dallasFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    expect(callCount).toBe(2);
    expect(results.length).toBe(1);
  });

  it("throws when both SODA3 and SODA2 fail", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.includes("/api/v3/")) {
        return new Response("Not Found", { status: 404 });
      }
      // SODA2 also fails
      return new Response("Service Unavailable", { status: 503 });
    }) as unknown as typeof fetch;

    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();

    await expect(adapter.scrape()).rejects.toThrow(/503|error|failed/i);
  });
});

// ─── Austin Field Mapping ───

describe("AustinPermitsAdapter — field mapping", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(austinFixture), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("maps permit_number, description, permit_location, permit_type_desc, issue_date correctly", async () => {
    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(1);
    const record = results[0];

    expect(record.permitNumber).toBe("2026-012345");
    expect(record.description).toBe("New commercial office building");
    expect(record.address).toBe("1100 Congress Ave, Austin, TX 78701");
    expect(record.projectType).toBe("Commercial - New Construction");
    expect(record.permitDate).toBeInstanceOf(Date);
  });

  it("passes through lat/lng from source data", async () => {
    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    const record = results[0];
    expect(record.lat).toBeCloseTo(30.2747, 3);
    expect(record.lng).toBeCloseTo(-97.7404, 3);
  });

  it("returns data with sourceType='permit'", async () => {
    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      expect(record.sourceType).toBe("permit");
    }
  });

  it("passes Zod rawLeadSchema validation", async () => {
    const { AustinPermitsAdapter } = await import(
      "@/lib/scraper/adapters/austin-permits"
    );
    const adapter = new AustinPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawLeadSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });
});

// ─── Dallas Field Mapping ───

describe("DallasPermitsAdapter — field mapping", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(dallasFixture), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("maps permit_number, work_description, street_address, permit_type, value, contractor, issued_date correctly", async () => {
    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(1);
    const record = results[0];

    expect(record.permitNumber).toBe("BLD2026-00100");
    expect(record.description).toBe("Interior renovation of office space");
    expect(record.address).toBe("500 Commerce St, Dallas, TX 75201");
    expect(record.projectType).toBe("Building (COM)");
    expect(record.estimatedValue).toBe(750000);
    expect(record.applicantName).toBe("Smith Construction LLC");
    expect(record.permitDate).toBeInstanceOf(Date);
  });

  it("does NOT include lat/lng (Dallas needs geocoding)", async () => {
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

  it("returns data with sourceType='permit'", async () => {
    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      expect(record.sourceType).toBe("permit");
    }
  });

  it("passes Zod rawLeadSchema validation", async () => {
    const { DallasPermitsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-permits"
    );
    const adapter = new DallasPermitsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawLeadSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });
});

// ─── Empty results ───

describe("SocrataPermitAdapter — empty results", () => {
  it("returns empty array for empty SODA3 response", async () => {
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
