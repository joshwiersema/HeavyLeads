import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { pipelineRuns } from "./pipeline-runs";

/**
 * Scraper runs -- per-adapter tracking within a pipeline run.
 *
 * Each pipeline run may invoke multiple scraper adapters (one per
 * source/industry combination). This table tracks individual adapter
 * execution: records found, stored, skipped, and any errors.
 */
export const scraperRuns = pgTable(
  "scraper_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineRunId: uuid("pipeline_run_id").references(() => pipelineRuns.id),
    adapterId: text("adapter_id").notNull(),
    adapterName: text("adapter_name").notNull(),
    industry: text("industry"),
    status: text("status").notNull().default("pending"),
    recordsFound: integer("records_found"),
    recordsStored: integer("records_stored"),
    recordsSkipped: integer("records_skipped"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("scraper_runs_pipeline_run_idx").on(table.pipelineRunId)]
);
