import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunPipeline = vi.fn();

vi.mock("@/lib/scraper/pipeline", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

vi.mock("@/lib/scraper/adapters/nws-storm-adapter", () => {
  class MockNwsStormAdapter {
    sourceId = "nws-storm-alerts";
    sourceName = "NWS Active Storm Alerts";
    sourceType = "storm" as const;
    scrape = vi.fn().mockResolvedValue([]);
  }
  return { NwsStormAdapter: MockNwsStormAdapter };
});

vi.mock("@/lib/scraper/adapters/fema-disaster-adapter", () => {
  class MockFemaDisasterAdapter {
    sourceId = "fema-disaster-declarations";
    sourceName = "FEMA Disaster Declarations";
    sourceType = "disaster" as const;
    scrape = vi.fn().mockResolvedValue([]);
  }
  return { FemaDisasterAdapter: MockFemaDisasterAdapter };
});

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "storm-run-1" }]),
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
  eq: vi
    .fn()
    .mockImplementation((a: unknown, b: unknown) => ({ type: "eq", a, b })),
  and: vi
    .fn()
    .mockImplementation((...args: unknown[]) => ({ type: "and", args })),
  gte: vi
    .fn()
    .mockImplementation((a: unknown, b: unknown) => ({ type: "gte", a, b })),
  sql: vi.fn(),
}));

import { GET } from "@/app/api/cron/storm-alerts/route";

describe("GET /api/cron/storm-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue({
      results: [
        {
          sourceId: "nws-storm-alerts",
          sourceName: "NWS Active Storm Alerts",
          recordsScraped: 10,
          recordsStored: 8,
          errors: [],
        },
        {
          sourceId: "fema-disaster-declarations",
          sourceName: "FEMA Disaster Declarations",
          recordsScraped: 5,
          recordsStored: 3,
          errors: [],
        },
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    });
  });

  function makeRequest() {
    return new Request("http://localhost:3000/api/cron/storm-alerts", {
      method: "GET",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
  }

  it("returns 401 without valid CRON_SECRET", async () => {
    const request = new Request(
      "http://localhost:3000/api/cron/storm-alerts",
      { method: "GET" }
    );
    const response = await GET(request as any);
    expect(response.status).toBe(401);
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const request = new Request(
      "http://localhost:3000/api/cron/storm-alerts",
      {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret" },
      }
    );
    const response = await GET(request as any);
    expect(response.status).toBe(401);
  });

  it("skips if already running within 25 min (idempotency)", async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "existing-run" }]),
        }),
      }),
    });

    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).toBe(true);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it("creates pipeline_runs and calls runPipeline with NWS + FEMA adapters", async () => {
    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(200);

    // Should have called insert for pipeline_runs
    expect(mockInsert).toHaveBeenCalled();
    const insertCall = mockInsert.mock.results[0].value.values;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeredBy: "cron-storm-alerts",
        triggerType: "cron",
      })
    );

    // Should have called runPipeline
    expect(mockRunPipeline).toHaveBeenCalledOnce();
    const [adapters, options] = mockRunPipeline.mock.calls[0];
    expect(adapters).toHaveLength(2);
    expect(adapters[0].sourceId).toBe("nws-storm-alerts");
    expect(adapters[1].sourceId).toBe("fema-disaster-declarations");
    expect(options.pipelineRunId).toBe("storm-run-1");
    expect(options.industry).toBe("storm");
  });

  it("returns success JSON with stats", async () => {
    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.runId).toBe("storm-run-1");
    expect(body.totalScraped).toBe(15);
    expect(body.totalStored).toBe(11);
  });

  it("updates pipeline_runs on success", async () => {
    await GET(makeRequest() as any);

    // Should have called update to mark completed
    expect(mockUpdate).toHaveBeenCalled();
    const setCall = mockUpdate.mock.results[0].value.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
      })
    );
  });

  it("returns 500 and updates pipeline_runs on failure", async () => {
    mockRunPipeline.mockRejectedValueOnce(new Error("Storm API down"));

    const response = await GET(makeRequest() as any);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Storm API down");

    // Should have updated pipeline_runs with failure
    expect(mockUpdate).toHaveBeenCalled();
    const setCall = mockUpdate.mock.results[0].value.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      })
    );
  });
});
