import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { initializeAdapters } from "@/lib/scraper/adapters";
import { getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";

// TODO: Add auth guard before production use

/**
 * POST /api/scraper/run
 *
 * Manually trigger the scraping pipeline. Initializes all registered
 * adapters, runs the pipeline, and returns the aggregated results.
 *
 * Currently unauthenticated for internal/development use.
 */
export async function POST(_request: Request) {
  try {
    initializeAdapters();
    const adapters = getRegisteredAdapters();
    const result = await runPipeline(adapters);

    clearAdapters();

    return NextResponse.json(result);
  } catch (error) {
    clearAdapters();

    const message =
      error instanceof Error ? error.message : "Unknown pipeline error";
    console.error("[api/scraper/run] Pipeline error:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
