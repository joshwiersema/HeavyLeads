import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  desc: vi.fn().mockImplementation((col) => ({ type: "desc", col })),
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
}));

import { checkAdapterHealth } from "@/lib/scraper/health";

function setupMockRuns(runs: Array<{ adapterId: string; adapterName: string; industry: string | null; status: string; startedAt: Date; completedAt: Date | null }>) {
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(runs),
      }),
    }),
  });
}

describe("checkAdapterHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports 'healthy' for adapter with 0 consecutive failures", async () => {
    setupMockRuns([
      { adapterId: "austin-tx-permits", adapterName: "Austin Permits", industry: "heavy_equipment", status: "completed", startedAt: new Date(), completedAt: new Date() },
    ]);

    const report = await checkAdapterHealth();
    const austin = report.adapters.find((a) => a.adapterId === "austin-tx-permits");
    expect(austin?.healthStatus).toBe("healthy");
    expect(austin?.consecutiveFailures).toBe(0);
  });

  it("reports 'degraded' for adapter with 1-2 consecutive failures", async () => {
    setupMockRuns([
      { adapterId: "sam-gov-bids", adapterName: "SAM.gov", industry: null, status: "failed", startedAt: new Date("2026-03-16T07:00:00Z"), completedAt: new Date("2026-03-16T07:01:00Z") },
      { adapterId: "sam-gov-bids", adapterName: "SAM.gov", industry: null, status: "failed", startedAt: new Date("2026-03-15T07:00:00Z"), completedAt: new Date("2026-03-15T07:01:00Z") },
      { adapterId: "sam-gov-bids", adapterName: "SAM.gov", industry: null, status: "completed", startedAt: new Date("2026-03-14T07:00:00Z"), completedAt: new Date("2026-03-14T07:01:00Z") },
    ]);

    const report = await checkAdapterHealth();
    const samGov = report.adapters.find((a) => a.adapterId === "sam-gov-bids");
    expect(samGov?.healthStatus).toBe("degraded");
    expect(samGov?.consecutiveFailures).toBe(2);
  });

  it("reports 'circuit_open' for adapter with 3+ consecutive failures", async () => {
    setupMockRuns([
      { adapterId: "dallas-tx-permits", adapterName: "Dallas Permits", industry: "heavy_equipment", status: "failed", startedAt: new Date("2026-03-16T07:00:00Z"), completedAt: new Date("2026-03-16T07:01:00Z") },
      { adapterId: "dallas-tx-permits", adapterName: "Dallas Permits", industry: "heavy_equipment", status: "failed", startedAt: new Date("2026-03-15T07:00:00Z"), completedAt: new Date("2026-03-15T07:01:00Z") },
      { adapterId: "dallas-tx-permits", adapterName: "Dallas Permits", industry: "heavy_equipment", status: "failed", startedAt: new Date("2026-03-14T07:00:00Z"), completedAt: new Date("2026-03-14T07:01:00Z") },
    ]);

    const report = await checkAdapterHealth();
    const dallas = report.adapters.find((a) => a.adapterId === "dallas-tx-permits");
    expect(dallas?.healthStatus).toBe("circuit_open");
    expect(dallas?.consecutiveFailures).toBe(3);
  });

  it("includes unhealthyCount in report", async () => {
    setupMockRuns([
      { adapterId: "austin-tx-permits", adapterName: "Austin Permits", industry: "heavy_equipment", status: "completed", startedAt: new Date(), completedAt: new Date() },
      { adapterId: "dallas-tx-permits", adapterName: "Dallas Permits", industry: "heavy_equipment", status: "failed", startedAt: new Date(), completedAt: new Date() },
    ]);

    const report = await checkAdapterHealth();
    expect(report.unhealthyCount).toBe(1); // dallas is degraded (1 failure)
  });

  it("reports healthy after recent success following failures", async () => {
    setupMockRuns([
      { adapterId: "enr-news", adapterName: "ENR News", industry: null, status: "completed", startedAt: new Date("2026-03-16T07:00:00Z"), completedAt: new Date("2026-03-16T07:01:00Z") },
      { adapterId: "enr-news", adapterName: "ENR News", industry: null, status: "failed", startedAt: new Date("2026-03-15T07:00:00Z"), completedAt: new Date("2026-03-15T07:01:00Z") },
      { adapterId: "enr-news", adapterName: "ENR News", industry: null, status: "failed", startedAt: new Date("2026-03-14T07:00:00Z"), completedAt: new Date("2026-03-14T07:01:00Z") },
    ]);

    const report = await checkAdapterHealth();
    const enr = report.adapters.find((a) => a.adapterId === "enr-news");
    expect(enr?.healthStatus).toBe("healthy");
    expect(enr?.consecutiveFailures).toBe(0);
  });

  it("returns empty adapters list when no scraper runs exist", async () => {
    setupMockRuns([]);

    const report = await checkAdapterHealth();
    expect(report.adapters).toEqual([]);
    expect(report.unhealthyCount).toBe(0);
  });
});
