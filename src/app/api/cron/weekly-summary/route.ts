import type { NextRequest } from "next/server";

export const maxDuration = 120;

/**
 * GET /api/cron/weekly-summary
 *
 * Vercel Cron endpoint for weekly summary email generation.
 * Runs Monday at 8 AM UTC. Secured with CRON_SECRET Bearer token.
 *
 * Calls generateWeeklySummaries() which:
 * - Queries all users with organization memberships
 * - Checks notification preferences (skips unsubscribed users)
 * - Computes lead volume trends (this week vs last week)
 * - Sends industry-themed summary emails with unsubscribe links
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { generateWeeklySummaries } = await import(
      "@/lib/email/weekly-summary-generator"
    );
    const result = await generateWeeklySummaries();

    console.log(
      `[cron/weekly-summary] Complete: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`
    );

    return Response.json({
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Weekly summary generation error";
    console.error("[cron/weekly-summary] Failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
