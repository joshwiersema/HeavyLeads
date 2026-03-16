import type { NextRequest } from "next/server";
import { enrichLeads } from "@/lib/scraper/enrichment";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await enrichLeads();
    return Response.json({ success: true, enriched: result.enriched });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enrichment error";
    console.error("[cron/enrich] Failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
