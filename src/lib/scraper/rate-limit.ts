import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, and, gte, desc } from "drizzle-orm";

/** Rate limit window: 1 hour in milliseconds */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Check whether an organization is allowed to trigger a pipeline run.
 *
 * Rate limit: 1 run per hour per organization. Only checks runs
 * with a non-null organizationId, so cron-triggered global runs
 * (organizationId = null) do not affect per-org rate limiting.
 *
 * @param orgId - Organization ID to check
 * @returns allowed: true if no recent run, false with nextAllowedAt if rate limited
 */
export async function checkRateLimit(
  orgId: string
): Promise<{ allowed: boolean; nextAllowedAt?: Date }> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const recentRun = await db.query.pipelineRuns.findFirst({
    where: and(
      eq(pipelineRuns.organizationId, orgId),
      gte(pipelineRuns.startedAt, oneHourAgo)
    ),
    orderBy: [desc(pipelineRuns.startedAt)],
  });

  if (recentRun) {
    return {
      allowed: false,
      nextAllowedAt: new Date(
        recentRun.startedAt.getTime() + RATE_LIMIT_WINDOW_MS
      ),
    };
  }

  return { allowed: true };
}
