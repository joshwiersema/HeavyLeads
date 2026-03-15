import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, or, isNull, desc } from "drizzle-orm";

/**
 * Pipeline run type inferred from the schema.
 */
export type PipelineRun = typeof pipelineRuns.$inferSelect;

/**
 * Get the most recent pipeline run for an organization.
 *
 * Includes both org-specific runs (organizationId = orgId) and global
 * cron runs (organizationId IS NULL), so the status reflects any
 * pipeline activity that could have produced leads for this org.
 */
export async function getLatestPipelineRun(
  orgId: string
): Promise<PipelineRun | null> {
  const run = await db.query.pipelineRuns.findFirst({
    where: or(
      eq(pipelineRuns.organizationId, orgId),
      isNull(pipelineRuns.organizationId)
    ),
    orderBy: [desc(pipelineRuns.startedAt)],
  });

  return run ?? null;
}

/**
 * Get the overall pipeline status for an organization.
 *
 * Returns whether any pipeline has ever run (org-specific or global cron),
 * whether a pipeline is currently running, and the last run details.
 */
export async function getOrgPipelineStatus(orgId: string): Promise<{
  hasEverRun: boolean;
  isRunning: boolean;
  lastRun: PipelineRun | null;
}> {
  const lastRun = await getLatestPipelineRun(orgId);

  return {
    hasEverRun: lastRun !== null,
    isRunning: lastRun?.status === "running" || lastRun?.status === "pending",
    lastRun,
  };
}

/**
 * Determine whether the dashboard should auto-trigger the pipeline
 * for a first-login scenario.
 *
 * Returns true only when:
 * - No pipeline has ever run for this org (and no global cron run exists)
 * - No leads exist for the org (leadCount === 0)
 *
 * This ensures new users who complete onboarding see the pipeline
 * fire automatically on their first dashboard visit.
 */
export async function shouldAutoTrigger(
  orgId: string,
  leadCount: number
): Promise<boolean> {
  if (leadCount > 0) {
    return false;
  }

  const status = await getOrgPipelineStatus(orgId);
  return !status.hasEverRun;
}
