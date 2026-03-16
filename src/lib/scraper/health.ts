import { db } from "@/lib/db";
import { scraperRuns } from "@/lib/db/schema/scraper-runs";
import { desc, eq } from "drizzle-orm";

export interface AdapterHealth {
  adapterId: string;
  adapterName: string;
  industry: string | null;
  lastStatus: string;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  healthStatus: "healthy" | "degraded" | "circuit_open" | "unknown";
}

export interface HealthReport {
  checkedAt: Date;
  adapters: AdapterHealth[];
  unhealthyCount: number;
}

export async function checkAdapterHealth(): Promise<HealthReport> {
  // Get recent scraper runs ordered by most recent first
  const recentRuns = await db
    .select({
      adapterId: scraperRuns.adapterId,
      adapterName: scraperRuns.adapterName,
      industry: scraperRuns.industry,
      status: scraperRuns.status,
      startedAt: scraperRuns.startedAt,
      completedAt: scraperRuns.completedAt,
    })
    .from(scraperRuns)
    .orderBy(desc(scraperRuns.startedAt))
    .limit(200);

  // Group by adapterId
  const adapterMap = new Map<string, typeof recentRuns>();
  for (const run of recentRuns) {
    const runs = adapterMap.get(run.adapterId) ?? [];
    runs.push(run);
    adapterMap.set(run.adapterId, runs);
  }

  const adapters: AdapterHealth[] = [];

  for (const [adapterId, runs] of adapterMap) {
    // Count consecutive failures from most recent backward
    let consecutiveFailures = 0;
    for (const run of runs) {
      if (run.status === "failed") {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    const lastRun = runs[0];
    const lastSuccess = runs.find((r) => r.status === "completed");
    const lastFailure = runs.find((r) => r.status === "failed");

    let healthStatus: AdapterHealth["healthStatus"];
    if (consecutiveFailures === 0) {
      healthStatus = "healthy";
    } else if (consecutiveFailures < 3) {
      healthStatus = "degraded";
    } else {
      healthStatus = "circuit_open";
    }

    adapters.push({
      adapterId,
      adapterName: lastRun.adapterName,
      industry: lastRun.industry,
      lastStatus: lastRun.status,
      consecutiveFailures,
      lastSuccessAt: lastSuccess?.completedAt ?? null,
      lastFailureAt: lastFailure?.completedAt ?? null,
      healthStatus,
    });
  }

  const unhealthyCount = adapters.filter(
    (a) => a.healthStatus === "circuit_open" || a.healthStatus === "degraded"
  ).length;

  return {
    checkedAt: new Date(),
    adapters,
    unhealthyCount,
  };
}
