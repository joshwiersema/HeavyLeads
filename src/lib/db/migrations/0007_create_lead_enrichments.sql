CREATE TABLE "lead_enrichments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "enrichment_type" text NOT NULL,
  "data" text NOT NULL,
  "source" text,
  "fetched_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp
);
CREATE INDEX "lead_enrichments_lead_id_idx" ON "lead_enrichments" ("lead_id");
