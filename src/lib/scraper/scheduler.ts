import cron from "node-cron";
import { runPipeline } from "./pipeline";
import { getRegisteredAdapters, clearAdapters } from "./registry";
import { initializeAdapters } from "./adapters";

/** The active cron task, if the scheduler is running */
let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the daily scraping pipeline scheduler.
 *
 * Runs at 06:00 UTC every day. The callback:
 * 1. Initializes all built-in adapters
 * 2. Runs the pipeline with all registered adapters
 * 3. Logs results summary
 * 4. Clears adapters after the run
 */
export function startScheduler(): void {
  scheduledTask = cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Starting daily scraping pipeline...");

      try {
        initializeAdapters();
        const adapters = getRegisteredAdapters();
        const result = await runPipeline(adapters);

        for (const adapterResult of result.results) {
          console.log(
            `[scheduler] ${adapterResult.sourceId}: ${adapterResult.recordsScraped} scraped, ${adapterResult.recordsStored} stored, ${adapterResult.errors.length} errors`
          );
        }

        console.log("[scheduler] Daily pipeline complete.");
      } catch (error) {
        console.error(
          "[scheduler] Pipeline failed:",
          error instanceof Error ? error.message : error
        );
      } finally {
        clearAdapters();
      }
    },
    {
      timezone: "UTC",
    }
  );

  console.log("[scheduler] Daily scraping pipeline scheduled at 06:00 UTC");
}

/**
 * Stop the daily scheduler.
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[scheduler] Scheduler stopped.");
  }
}
