import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { runPipeline } from "@/lib/scraper/pipeline";
import { getAllAdapters } from "@/lib/scraper/adapters";
import { checkRateLimit } from "@/lib/scraper/rate-limit";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

/**
 * POST /api/scraper/run
 *
 * User-triggered pipeline run. Requires session auth and enforces
 * a 1-run-per-hour rate limit per organization.
 *
 * - Verifies session and active organization
 * - Checks DB-based rate limit (1/hour per org)
 * - Records pipeline run with org and user context
 * - Runs all adapters via factory pattern (no global registry)
 * - Updates run record with results or error
 */
export async function POST(_request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.session.activeOrganizationId;

  // Rate limit: 1 run per hour per org
  const rateCheck = await checkRateLimit(orgId);
  if (!rateCheck.allowed) {
    return Response.json(
      {
        error: "Rate limited",
        nextAllowedAt: rateCheck.nextAllowedAt!.toISOString(),
      },
      { status: 429 }
    );
  }

  // Record the pipeline run start
  const [run] = await db
    .insert(pipelineRuns)
    .values({
      organizationId: orgId,
      triggeredBy: session.user.id,
      triggerType: "manual",
      status: "running",
    })
    .returning();

  try {
    const adapters = await getAllAdapters();
    const result = await runPipeline(adapters, { pipelineRunId: run.id });

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
      error instanceof Error ? error.message : "Unknown pipeline error";

    // Update run record with failure
    await db
      .update(pipelineRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, run.id));

    console.error("[api/scraper/run] Pipeline error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
