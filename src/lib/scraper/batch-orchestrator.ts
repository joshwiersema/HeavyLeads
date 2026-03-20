import type { ScraperAdapter } from "./adapters/base-adapter";
import type { PipelineResult } from "./types";

/** Default batch size: 5 adapters per invocation */
export const DEFAULT_BATCH_SIZE = 5;

/**
 * Split adapters into batches of the given size.
 * Returns array of arrays, each containing at most `batchSize` adapters.
 */
export function splitIntoBatches(
  adapters: ScraperAdapter[],
  batchSize: number = DEFAULT_BATCH_SIZE
): ScraperAdapter[][] {
  if (adapters.length === 0) return [];
  const batches: ScraperAdapter[][] = [];
  for (let i = 0; i < adapters.length; i += batchSize) {
    batches.push(adapters.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Serialize adapter identifiers for passing via HTTP.
 * Returns array of sourceId strings for the batch endpoint to reconstruct.
 */
export function serializeBatch(adapters: ScraperAdapter[]): string[] {
  return adapters.map((a) => a.sourceId);
}

export interface BatchResult {
  batchIndex: number;
  success: boolean;
  results?: PipelineResult[];
  error?: string;
  duration?: number;
}

/**
 * Invoke a single batch via internal HTTP fetch to /api/cron/scrape/batch.
 *
 * Uses the app's own base URL (NEXT_PUBLIC_APP_URL or VERCEL_URL) to make
 * an internal request. The batch endpoint runs the adapters and returns results.
 *
 * Each batch invocation is a separate serverless function execution with
 * its own 300s timeout window.
 */
export async function invokeBatch(opts: {
  adapterIds: string[];
  industry: string;
  pipelineRunId: string;
  batchIndex: number;
  cronSecret: string;
  baseUrl: string;
}): Promise<BatchResult> {
  const { adapterIds, industry, pipelineRunId, batchIndex, cronSecret, baseUrl } = opts;
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/cron/scrape/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        adapterIds,
        industry,
        pipelineRunId,
        batchIndex,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        batchIndex,
        success: false,
        error: `Batch ${batchIndex} HTTP ${response.status}: ${text}`,
        duration: Date.now() - startTime,
      };
    }

    const data = await response.json();
    return {
      batchIndex,
      success: true,
      results: data.results,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      batchIndex,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Get the base URL for internal API calls.
 * Prefers NEXT_PUBLIC_APP_URL, falls back to VERCEL_URL with https.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
