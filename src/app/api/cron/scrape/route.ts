import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { initializeAdapters } from "@/lib/scraper/adapters";
import { getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

/**
 * GET /api/cron/scrape
 *
 * Vercel Cron endpoint for daily automated scraping pipeline.
 * Secured with CRON_SECRET Bearer token (injected by Vercel).
 *
 * - Records a global pipeline run (organizationId = null)
 * - Runs all registered adapters
 * - Triggers email digest after completion
 * - Updates run record with results or error
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Record the pipeline run start
  const [run] = await db
    .insert(pipelineRuns)
    .values({
      organizationId: null,
      triggeredBy: "cron",
      triggerType: "cron",
      status: "running",
    })
    .returning();

  try {
    initializeAdapters();
    const adapters = getRegisteredAdapters();
    const result = await runPipeline(adapters);
    clearAdapters();

    // Calculate totals from adapter results
    const totalScraped = result.results.reduce(
      (sum, r) => sum + r.recordsScraped,
      0
    );
    const totalStored = result.results.reduce(
      (sum, r) => sum + r.recordsStored,
      0
    );

    // Update run record with success
    await db
      .update(pipelineRuns)
      .set({
        status: "completed",
        recordsScraped: totalScraped,
        recordsStored: totalStored,
        completedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, run.id));

    // Trigger email digest after pipeline completion
    try {
      const { generateDigests } = await import(
        "@/lib/email/digest-generator"
      );
      const digestResult = await generateDigests();
      console.log(
        `[cron/scrape] Email digest: ${digestResult.sent} sent, ${digestResult.skipped} skipped, ${digestResult.errors} errors`
      );
    } catch (digestError) {
      console.error(
        "[cron/scrape] Digest generation failed:",
        digestError instanceof Error ? digestError.message : digestError
      );
    }

    return Response.json({
      success: true,
      runId: run.id,
      totalScraped,
      totalStored,
      adapters: result.results.length,
      duration: result.completedAt.getTime() - result.startedAt.getTime(),
    });
  } catch (error) {
    clearAdapters();

    const message =
      error instanceof Error ? error.message : "Pipeline error";

    // Update run record with failure
    await db
      .update(pipelineRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, run.id));

    console.error("[cron/scrape] Pipeline failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
