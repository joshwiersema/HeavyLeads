import type { NextRequest } from "next/server";
import { checkAdapterHealth } from "@/lib/scraper/health";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const report = await checkAdapterHealth();

    // Log unhealthy adapters for Vercel log alerting
    for (const adapter of report.adapters) {
      if (adapter.healthStatus === "circuit_open") {
        console.error(
          `[cron/health] CIRCUIT OPEN: ${adapter.adapterId} (${adapter.consecutiveFailures} consecutive failures)`
        );
      } else if (adapter.healthStatus === "degraded") {
        console.warn(
          `[cron/health] DEGRADED: ${adapter.adapterId} (${adapter.consecutiveFailures} consecutive failures)`
        );
      }
    }

    return Response.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Health check error";
    console.error("[cron/health] Failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
