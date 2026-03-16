import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { NwsStormAdapter } from "@/lib/scraper/adapters/nws-storm-adapter";
import { FemaDisasterAdapter } from "@/lib/scraper/adapters/fema-disaster-adapter";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, and, gte } from "drizzle-orm";

export const maxDuration = 120;

/**
 * GET /api/cron/storm-alerts
 *
 * Vercel Cron endpoint for storm alert scraping (every 30 minutes).
 * Secured with CRON_SECRET Bearer token.
 *
 * Runs NWS + FEMA adapters directly (not per-industry) since storm
 * alerts serve all relevant industries. 25-minute idempotency window
 * prevents overlapping runs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Idempotency: skip if storm pipeline ran within last 25 minutes
  const twentyFiveMinAgo = new Date(Date.now() - 25 * 60 * 1000);
  const existing = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.status, "running"),
        eq(pipelineRuns.triggeredBy, "cron-storm-alerts"),
        gte(pipelineRuns.startedAt, twentyFiveMinAgo)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ skipped: true, reason: "Already running" });
  }

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      organizationId: null,
      triggeredBy: "cron-storm-alerts",
      triggerType: "cron",
      status: "running",
    })
    .returning();

  try {
    const adapters = [new NwsStormAdapter(), new FemaDisasterAdapter()];
    const result = await runPipeline(adapters, {
      pipelineRunId: run.id,
      industry: "storm",
    });

    const totalScraped = result.results.reduce(
      (sum, r) => sum + r.recordsScraped,
      0
    );
    const totalStored = result.results.reduce(
      (sum, r) => sum + r.recordsStored,
      0
    );

    await db
      .update(pipelineRuns)
      .set({
        status: "completed",
        recordsScraped: totalScraped,
        recordsStored: totalStored,
        completedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, run.id));

    return Response.json({
      success: true,
      runId: run.id,
      totalScraped,
      totalStored,
      adapters: result.results.length,
      duration: result.completedAt.getTime() - result.startedAt.getTime(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pipeline error";

    await db
      .update(pipelineRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, run.id));

    console.error("[cron/storm-alerts] Pipeline failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
