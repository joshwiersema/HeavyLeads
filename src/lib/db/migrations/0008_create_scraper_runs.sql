CREATE TABLE "scraper_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pipeline_run_id" uuid REFERENCES "pipeline_runs"("id"),
  "adapter_id" text NOT NULL,
  "adapter_name" text NOT NULL,
  "industry" text,
  "status" text NOT NULL DEFAULT 'pending',
  "records_found" integer,
  "records_stored" integer,
  "records_skipped" integer,
  "error_message" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
CREATE INDEX "scraper_runs_pipeline_run_idx" ON "scraper_runs" ("pipeline_run_id");
