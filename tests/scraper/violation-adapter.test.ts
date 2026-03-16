import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawLeadSchema } from "@/lib/scraper/adapters/base-adapter";

// ─── Mock rate limiter (pass-through queue) ───

vi.mock("@/lib/scraper/api-rate-limiter", () => ({
  getSocrataQueue: vi.fn().mockResolvedValue({
    add: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}));

// ─── Austin violations fixture ───

const austinViolationFixture = [
  {
    case_id: "2026-000123",
    case_type: "HVAC Mechanical",
    description: "Operating HVAC system without proper permit",
    address: "500 E 7th St, Austin, TX 78701",
    date_opened: "2026-02-10T00:00:00.000",
    status: "Open",
    latitude: "30.2672",
    longitude: "-97.7431",
  },
  {
    case_id: "2026-000456",
    case_type: "Roofing Violation",
    description: "Roof repair work without building permit",
    address: "200 Congress Ave, Austin, TX 78701",
    date_opened: "2026-02-15T00:00:00.000",
    status: "Open",
    latitude: "30.2649",
    longitude: "-97.7428",
  },
];

// ─── Dallas violations fixture ───

const dallasViolationFixture = [
  {
    case_number: "CE2026-00100",
    violation_type: "Electrical",
    case_description: "Unlicensed electrical work in commercial building",
    location: "600 Commerce St, Dallas, TX 75201",
    date_filed: "2026-02-20T00:00:00.000",
    case_status: "Active",
  },
];

// ─── Houston violations fixture ───

const houstonViolationFixture = [
  {
    case_number: "HOU-2026-789",
    violation_description: "Building code violation — structural damage to roof",
    street_address: "1000 Main St, Houston, TX 77002",
    violation_date: "2026-02-25T00:00:00.000",
    case_status: "Open",
    latitude: "29.7604",
    longitude: "-95.3698",
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

// ─── SocrataViolationAdapter — SODA3/SODA2 pattern ───

describe("SocrataViolationAdapter — SODA3 request", () => {
  it("sends POST to /api/v3/views/{datasetId}/query.json", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? "GET";
      return new Response(JSON.stringify(austinViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    await adapter.scrape();

    expect(capturedUrl).toBe(
      "https://data.austintexas.gov/api/v3/views/ckex-2zb9/query.json"
    );
    expect(capturedMethod).toBe("POST");
  });

  it("uses 60-day window for violation queries (longer than permits)", async () => {
    let capturedBody = "";

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify(austinViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    await adapter.scrape();

    const parsed = JSON.parse(capturedBody);
    expect(parsed.query).toMatch(/^SELECT \* WHERE date_opened > '/);
    expect(parsed.query).toMatch(/ORDER BY date_opened DESC LIMIT 1000$/);

    // Verify 60-day window: extract the date from the query and check it
    const dateMatch = parsed.query.match(/> '(\d{4}-\d{2}-\d{2})'/);
    expect(dateMatch).toBeTruthy();
    const queryDate = new Date(dateMatch[1]);
    const now = new Date();
    const diffDays = Math.round(
      (now.getTime() - queryDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Should be approximately 60 days
    expect(diffDays).toBeGreaterThanOrEqual(59);
    expect(diffDays).toBeLessThanOrEqual(61);
  });
});

describe("SocrataViolationAdapter — SODA2 fallback", () => {
  it("falls back to SODA2 GET on SODA3 404 response", async () => {
    const calls: { url: string; method: string }[] = [];

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const method = init?.method ?? "GET";
      calls.push({ url: urlStr, method });

      if (urlStr.includes("/api/v3/")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify(austinViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    const results = await adapter.scrape();

    expect(calls.length).toBe(2);
    expect(calls[0].url).toContain("/api/v3/views/ckex-2zb9/query.json");
    expect(calls[0].method).toBe("POST");
    expect(calls[1].url).toContain(
      "https://data.austintexas.gov/resource/ckex-2zb9.json"
    );
    expect(calls[1].method).toBe("GET");
    expect(results.length).toBe(2);
  });

  it("falls back to SODA2 on network error", async () => {
    let callCount = 0;

    global.fetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();

      if (urlStr.includes("/api/v3/")) {
        throw new Error("Network error");
      }
      return new Response(JSON.stringify(dallasViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;

    const { DallasViolationsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-violations"
    );
    const adapter = new DallasViolationsAdapter();
    const results = await adapter.scrape();

    expect(callCount).toBe(2);
    expect(results.length).toBe(1);
  });
});

// ─── All violation adapters have sourceType "violation" ───

describe("All violation adapters — sourceType is 'violation'", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("AustinViolationsAdapter has sourceType 'violation'", async () => {
    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    expect(adapter.sourceType).toBe("violation");
  });

  it("DallasViolationsAdapter has sourceType 'violation'", async () => {
    const { DallasViolationsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-violations"
    );
    const adapter = new DallasViolationsAdapter();
    expect(adapter.sourceType).toBe("violation");
  });

  it("HoustonViolationsAdapter has sourceType 'violation'", async () => {
    const { HoustonViolationsAdapter } = await import(
      "@/lib/scraper/adapters/houston-violations"
    );
    const adapter = new HoustonViolationsAdapter();
    expect(adapter.sourceType).toBe("violation");
  });
});

// ─── Austin violations field mapping ───

describe("AustinViolationsAdapter — field mapping", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(austinViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("maps case_id, case_type, description, address, date_opened correctly", async () => {
    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(2);
    const record = results[0];

    expect(record.title).toContain("HVAC Mechanical");
    expect(record.description).toBe("Operating HVAC system without proper permit");
    expect(record.address).toBe("500 E 7th St, Austin, TX 78701");
    expect(record.permitDate).toBeInstanceOf(Date);
    expect(record.sourceType).toBe("violation");
  });

  it("passes through lat/lng from Austin violation data", async () => {
    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    const results = await adapter.scrape();

    const record = results[0];
    expect(record.lat).toBeCloseTo(30.2672, 3);
    expect(record.lng).toBeCloseTo(-97.7431, 3);
  });

  it("passes Zod rawLeadSchema validation", async () => {
    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawLeadSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });

  it("has correct adapter metadata", async () => {
    const { AustinViolationsAdapter } = await import(
      "@/lib/scraper/adapters/austin-violations"
    );
    const adapter = new AustinViolationsAdapter();
    expect(adapter.sourceId).toBe("austin-tx-violations");
    expect(adapter.sourceType).toBe("violation");
    expect(adapter.jurisdiction).toBe("Austin, TX");
  });
});

// ─── Dallas violations field mapping ───

describe("DallasViolationsAdapter — field mapping", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(dallasViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("maps Dallas-specific fields correctly", async () => {
    const { DallasViolationsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-violations"
    );
    const adapter = new DallasViolationsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(1);
    const record = results[0];

    expect(record.title).toContain("Electrical");
    expect(record.description).toBe("Unlicensed electrical work in commercial building");
    expect(record.address).toBe("600 Commerce St, Dallas, TX 75201");
    expect(record.permitDate).toBeInstanceOf(Date);
    expect(record.sourceType).toBe("violation");
  });

  it("has correct adapter metadata", async () => {
    const { DallasViolationsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-violations"
    );
    const adapter = new DallasViolationsAdapter();
    expect(adapter.sourceId).toBe("dallas-tx-violations");
    expect(adapter.sourceType).toBe("violation");
    expect(adapter.jurisdiction).toBe("Dallas, TX");
  });

  it("passes Zod rawLeadSchema validation", async () => {
    const { DallasViolationsAdapter } = await import(
      "@/lib/scraper/adapters/dallas-violations"
    );
    const adapter = new DallasViolationsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawLeadSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });
});

// ─── Houston violations field mapping ───

describe("HoustonViolationsAdapter — field mapping", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(houstonViolationFixture), { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("maps Houston-specific fields correctly", async () => {
    const { HoustonViolationsAdapter } = await import(
      "@/lib/scraper/adapters/houston-violations"
    );
    const adapter = new HoustonViolationsAdapter();
    const results = await adapter.scrape();

    expect(results.length).toBe(1);
    const record = results[0];

    expect(record.description).toContain("structural damage to roof");
    expect(record.address).toBe("1000 Main St, Houston, TX 77002");
    expect(record.permitDate).toBeInstanceOf(Date);
    expect(record.sourceType).toBe("violation");
  });

  it("passes through lat/lng from Houston violation data", async () => {
    const { HoustonViolationsAdapter } = await import(
      "@/lib/scraper/adapters/houston-violations"
    );
    const adapter = new HoustonViolationsAdapter();
    const results = await adapter.scrape();

    const record = results[0];
    expect(record.lat).toBeCloseTo(29.7604, 3);
    expect(record.lng).toBeCloseTo(-95.3698, 3);
  });

  it("has correct adapter metadata", async () => {
    const { HoustonViolationsAdapter } = await import(
      "@/lib/scraper/adapters/houston-violations"
    );
    const adapter = new HoustonViolationsAdapter();
    expect(adapter.sourceId).toBe("houston-tx-violations");
    expect(adapter.sourceType).toBe("violation");
    expect(adapter.jurisdiction).toBe("Houston, TX");
  });

  it("passes Zod rawLeadSchema validation", async () => {
    const { HoustonViolationsAdapter } = await import(
      "@/lib/scraper/adapters/houston-violations"
    );
    const adapter = new HoustonViolationsAdapter();
    const results = await adapter.scrape();

    for (const record of results) {
      const parsed = rawLeadSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    }
  });
});
