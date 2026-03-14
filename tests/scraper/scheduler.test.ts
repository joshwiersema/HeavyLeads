import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mocks are available when vi.mock factory runs
const { mockStop, mockSchedule } = vi.hoisted(() => {
  const mockStop = vi.fn();
  const mockSchedule = vi.fn().mockReturnValue({ stop: mockStop });
  return { mockStop, mockSchedule };
});

// Mock node-cron
vi.mock("node-cron", () => ({
  default: {
    schedule: mockSchedule,
  },
}));

// Mock pipeline
vi.mock("@/lib/scraper/pipeline", () => ({
  runPipeline: vi.fn().mockResolvedValue({
    results: [
      {
        sourceId: "test-source",
        sourceName: "Test Source",
        recordsScraped: 5,
        recordsStored: 5,
        errors: [],
      },
    ],
    startedAt: new Date(),
    completedAt: new Date(),
  }),
}));

// Mock registry
vi.mock("@/lib/scraper/registry", () => ({
  getRegisteredAdapters: vi.fn().mockReturnValue([]),
  clearAdapters: vi.fn(),
}));

// Mock adapters index
vi.mock("@/lib/scraper/adapters/index", () => ({
  initializeAdapters: vi.fn(),
}));

// Mock db (needed for API route which imports pipeline -> db)
vi.mock("@/lib/db", () => ({
  db: { insert: vi.fn() },
}));

// Mock geocoding (needed for pipeline import chain)
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn(),
}));

import { startScheduler, stopScheduler } from "@/lib/scraper/scheduler";
import { runPipeline } from "@/lib/scraper/pipeline";
import { getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";
import { initializeAdapters } from "@/lib/scraper/adapters/index";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("startScheduler() calls cron.schedule with '0 6 * * *' expression and UTC timezone", () => {
    startScheduler();

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const [expression, , options] = mockSchedule.mock.calls[0];
    expect(expression).toBe("0 6 * * *");
    expect(options).toEqual(
      expect.objectContaining({ timezone: "UTC" })
    );
  });

  it("scheduled callback calls initializeAdapters() and runPipeline() with registered adapters", async () => {
    startScheduler();

    // Extract the callback passed to cron.schedule
    const callback = mockSchedule.mock.calls[0][1];
    expect(typeof callback).toBe("function");

    // Execute the callback
    await callback();

    expect(initializeAdapters).toHaveBeenCalled();
    expect(getRegisteredAdapters).toHaveBeenCalled();
    expect(runPipeline).toHaveBeenCalled();
  });

  it("stopScheduler() stops the cron task", () => {
    startScheduler();
    stopScheduler();

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("scheduled callback calls clearAdapters() after pipeline run", async () => {
    startScheduler();

    const callback = mockSchedule.mock.calls[0][1];
    await callback();

    expect(clearAdapters).toHaveBeenCalled();
  });
});

// ─── API Route Tests ───

describe("POST /api/scraper/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers runPipeline and returns JSON with pipeline results", async () => {
    const { POST } = await import("@/app/api/scraper/run/route");

    const request = new Request("http://localhost:3000/api/scraper/run", {
      method: "POST",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toBeDefined();
    expect(Array.isArray(body.results)).toBe(true);
    expect(initializeAdapters).toHaveBeenCalled();
    expect(runPipeline).toHaveBeenCalled();
    expect(clearAdapters).toHaveBeenCalled();
  });

  it("returns 500 with error message if pipeline throws", async () => {
    // Make runPipeline throw for this test
    vi.mocked(runPipeline).mockRejectedValueOnce(
      new Error("Pipeline execution failed")
    );

    const { POST } = await import("@/app/api/scraper/run/route");

    const request = new Request("http://localhost:3000/api/scraper/run", {
      method: "POST",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
    expect(body.error).toContain("Pipeline execution failed");
  });
});
