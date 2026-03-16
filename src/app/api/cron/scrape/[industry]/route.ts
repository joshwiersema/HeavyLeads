import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { getAdaptersForIndustry } from "@/lib/scraper/adapters";
import type { Industry } from "@/lib/onboarding/types";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, and, gte } from "drizzle-orm";

export const maxDuration = 300;

const VALID_INDUSTRIES: Industry[] = [
  "heavy_equipment",
  "hvac",
  "roofing",
  "solar",
  "electrical",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { industry } = await params;

  if (!VALID_INDUSTRIES.includes(industry as Industry)) {
    return Response.json(
      { error: `Invalid industry: ${industry}` },
      { status: 400 }
    );
  }

  // Idempotency: skip if same industry already running within last 15 min
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const existing = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.status, "running"),
        eq(pipelineRuns.triggeredBy, `cron-${industry}`),
        gte(pipelineRuns.startedAt, fifteenMinAgo)
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
      triggeredBy: `cron-${industry}`,
      triggerType: "cron",
      status: "running",
    })
    .returning();

  try {
    const adapters = getAdaptersForIndustry(industry as Industry);
    const result = await runPipeline(adapters, {
      pipelineRunId: run.id,
      industry,
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
      industry,
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

    console.error(`[cron/scrape/${industry}] Pipeline failed:`, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
