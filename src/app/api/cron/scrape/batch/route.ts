import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { getAdaptersForIndustry } from "@/lib/scraper/adapters";
import type { Industry } from "@/lib/onboarding/types";

export const maxDuration = 300;

/**
 * POST /api/cron/scrape/batch
 *
 * Internal endpoint invoked by the fan-out orchestrator.
 * Receives a list of adapter sourceIds and runs only those adapters.
 * Not scheduled as a cron -- only called internally.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { adapterIds, industry, pipelineRunId, batchIndex } = body as {
    adapterIds: string[];
    industry: string;
    pipelineRunId: string;
    batchIndex: number;
  };

  if (!adapterIds || !Array.isArray(adapterIds) || adapterIds.length === 0) {
    return Response.json({ error: "adapterIds required" }, { status: 400 });
  }

  // Get all adapters for the industry and filter to requested IDs
  const allAdapters = getAdaptersForIndustry(industry as Industry);
  const batchAdapters = allAdapters.filter((a) =>
    adapterIds.includes(a.sourceId)
  );

  if (batchAdapters.length === 0) {
    return Response.json(
      {
        error: `No matching adapters for IDs: ${adapterIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  console.log(
    `[batch] Processing batch ${batchIndex}: ${batchAdapters.map((a) => a.sourceId).join(", ")}`
  );

  const result = await runPipeline(batchAdapters, {
    pipelineRunId,
    industry,
  });

  return Response.json({
    batchIndex,
    results: result.results,
    duration: result.completedAt.getTime() - result.startedAt.getTime(),
  });
}
