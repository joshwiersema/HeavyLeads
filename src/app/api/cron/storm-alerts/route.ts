import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { NwsStormAdapter } from "@/lib/scraper/adapters/nws-storm-adapter";
import { FemaDisasterAdapter } from "@/lib/scraper/adapters/fema-disaster-adapter";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { leads } from "@/lib/db/schema/leads";
import { eq, and, gte, inArray } from "drizzle-orm";
import { getRoofingSubscribersInStormArea } from "@/lib/storm-alerts/queries";
import { getActiveStormAlertsForOrg } from "@/lib/storm-alerts/queries";
import { sendStormAlertEmail } from "@/lib/email/send-storm-alert";

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

    // --- Email dispatch to affected roofing subscribers ---
    let emailsSent = 0;
    try {
      // Collect new lead IDs from all adapter results
      const newLeadIds = result.results.flatMap((r) => r.newLeadIds ?? []);

      if (newLeadIds.length > 0) {
        // Fetch the newly created storm leads with coordinates
        const newStormLeads = await db
          .select({ id: leads.id, lat: leads.lat, lng: leads.lng })
          .from(leads)
          .where(
            and(
              inArray(leads.id, newLeadIds),
              eq(leads.sourceType, "storm")
            )
          );

        // Find unique subscribers affected by any of the new storm leads
        const subscriberMap = new Map<
          string,
          { userId: string; userName: string; email: string; orgId: string }
        >();

        for (const lead of newStormLeads) {
          if (lead.lat == null || lead.lng == null) continue;
          const subscribers = await getRoofingSubscribersInStormArea(
            lead.lat,
            lead.lng
          );
          for (const sub of subscribers) {
            // Deduplicate by userId so each user gets one email
            if (!subscriberMap.has(sub.userId)) {
              subscriberMap.set(sub.userId, {
                userId: sub.userId,
                userName: sub.userName,
                email: sub.email,
                orgId: sub.orgId,
              });
            }
          }
        }

        // Send email to each unique subscriber with their org's active storm alerts
        const dashboardUrl = (
          process.env.NEXT_PUBLIC_APP_URL ?? "https://app.groundpulse.com"
        ).trim();

        for (const sub of subscriberMap.values()) {
          const alerts = await getActiveStormAlertsForOrg(sub.orgId);
          if (alerts.length > 0) {
            await sendStormAlertEmail(
              sub.email,
              sub.userName,
              alerts,
              dashboardUrl
            );
            emailsSent++;
          }
        }

        console.log(
          `[storm-cron] Sent ${emailsSent} storm alert emails to ${subscriberMap.size} subscribers`
        );
      }
    } catch (emailError) {
      // Email failures must not fail the cron
      console.error(
        "[storm-cron] Email dispatch error:",
        emailError instanceof Error ? emailError.message : emailError
      );
    }

    return Response.json({
      success: true,
      runId: run.id,
      totalScraped,
      totalStored,
      emailsSent,
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
