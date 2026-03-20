import type { NextRequest } from "next/server";
import { expireStaleLeads } from "@/lib/scraper/expiration";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await expireStaleLeads();
    console.log(`[cron/expire] Deleted ${result.expired} stale leads`);
    return Response.json({ success: true, deleted: result.expired });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Expiration error";
    console.error("[cron/expire] Failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
