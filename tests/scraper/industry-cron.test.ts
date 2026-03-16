import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunPipeline = vi.fn();
const mockGetAdaptersForIndustry = vi.fn().mockReturnValue([]);

vi.mock("@/lib/scraper/pipeline", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

vi.mock("@/lib/scraper/adapters", () => ({
  getAdaptersForIndustry: (...args: unknown[]) =>
    mockGetAdaptersForIndustry(...args),
}));

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "run-1" }]),
  }),
});

const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "eq", a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ type: "and", args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "gte", a, b })),
  sql: vi.fn(),
}));

import { GET } from "@/app/api/cron/scrape/[industry]/route";

describe("GET /api/cron/scrape/[industry]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue({
      results: [
        {
          sourceId: "test",
          sourceName: "Test",
          recordsScraped: 5,
          recordsStored: 3,
          errors: [],
        },
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    });
  });

  function makeRequest(industry: string) {
    const request = new Request(
      `http://localhost:3000/api/cron/scrape/${industry}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );
    const params = Promise.resolve({ industry });
    return { request, params };
  }

  it("returns 401 without authorization header", async () => {
    const request = new Request(
      "http://localhost:3000/api/cron/scrape/heavy_equipment",
      { method: "GET" }
    );
    const params = Promise.resolve({ industry: "heavy_equipment" });

    const response = await GET(request as any, { params });
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid industry", async () => {
    const { request, params } = makeRequest("invalid_industry");
    const response = await GET(request as any, { params });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid industry");
  });

  it("returns 200 with skipped=true if already running", async () => {
    // Mock select to return an existing running pipeline
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "existing-run" }]),
        }),
      }),
    });

    const { request, params } = makeRequest("heavy_equipment");
    const response = await GET(request as any, { params });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).toBe(true);
  });

  it("runs pipeline for valid industry", async () => {
    const { request, params } = makeRequest("heavy_equipment");
    const response = await GET(request as any, { params });
    expect(response.status).toBe(200);
    expect(mockGetAdaptersForIndustry).toHaveBeenCalledWith("heavy_equipment");
    expect(mockRunPipeline).toHaveBeenCalledOnce();
  });

  it("creates pipeline_runs with correct triggeredBy", async () => {
    const { request, params } = makeRequest("hvac");
    await GET(request as any, { params });

    const insertCall = mockInsert.mock.results[0].value.values;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeredBy: "cron-hvac",
        triggerType: "cron",
      })
    );
  });

  it("returns 500 on pipeline error", async () => {
    mockRunPipeline.mockRejectedValueOnce(new Error("Adapter failed"));

    const { request, params } = makeRequest("roofing");
    const response = await GET(request as any, { params });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Adapter failed");
  });
});
