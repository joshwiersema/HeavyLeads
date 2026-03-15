import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";

/**
 * Pipeline runs table -- tracks every scraping pipeline execution.
 *
 * Used for:
 * - Rate limiting on-demand refreshes (1 per hour per org)
 * - Progress indicator (status: pending -> running -> completed/failed)
 * - Pipeline run history and audit trail
 *
 * organizationId is nullable: cron-triggered (global) runs have null orgId,
 * while user-triggered runs record the requesting org.
 */
export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id"),
    triggeredBy: text("triggered_by"),
    triggerType: text("trigger_type").notNull(),
    status: text("status").notNull().default("pending"),
    recordsScraped: integer("records_scraped"),
    recordsStored: integer("records_stored"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("pipeline_runs_org_started_idx").on(
      table.organizationId,
      table.startedAt
    ),
  ]
);
