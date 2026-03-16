import type { NextRequest } from "next/server";

export const maxDuration = 120;

/**
 * GET /api/cron/digest
 *
 * Vercel Cron endpoint for daily digest email generation.
 * Runs at 7 AM UTC daily. Secured with CRON_SECRET Bearer token.
 *
 * Calls generateDigests() which:
 * - Queries all users with digest-enabled saved searches
 * - Checks notification preferences (skips unsubscribed users)
 * - Sends industry-themed digest emails with unsubscribe links
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    console.log(
      `[cron/digest] Complete: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`
    );

    return Response.json({
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Digest generation error";
    console.error("[cron/digest] Failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
