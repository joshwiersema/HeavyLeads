import { NextResponse } from "next/server";
import { generateDigests } from "@/lib/email/digest-generator";

/**
 * POST /api/email-digest
 *
 * Triggers the daily email digest generation. Designed for:
 * 1. Manual triggering via curl for testing/debugging
 * 2. External cron services (e.g., Vercel Cron) for serverless deployments
 *
 * Authorization:
 * - If CRON_SECRET env var is set, requires Bearer token match
 * - If CRON_SECRET is not set (dev mode), allows all requests
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Auth guard -- check CRON_SECRET if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  const startTime = Date.now();
  console.log("[email-digest] Digest generation started");

  try {
    const result = await generateDigests();
    const duration = Date.now() - startTime;

    console.log(
      `[email-digest] Digest generation completed in ${duration}ms`
    );

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      "[email-digest] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        error: "Digest generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}
