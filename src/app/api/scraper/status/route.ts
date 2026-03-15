import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgPipelineStatus } from "@/lib/leads/pipeline-status";

/**
 * GET /api/scraper/status
 *
 * Lightweight endpoint for polling pipeline status.
 * Used by the PipelineProgress component to detect when a
 * running pipeline completes. Session auth required.
 *
 * Returns: { isRunning, hasEverRun, lastRun }
 */
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.session.activeOrganizationId;
  const status = await getOrgPipelineStatus(orgId);

  return Response.json({
    isRunning: status.isRunning,
    hasEverRun: status.hasEverRun,
    lastRun: status.lastRun
      ? {
          status: status.lastRun.status,
          recordsScraped: status.lastRun.recordsScraped,
          completedAt: status.lastRun.completedAt,
        }
      : null,
  });
}
