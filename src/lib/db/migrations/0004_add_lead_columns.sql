ALTER TABLE "leads" ADD COLUMN "content_hash" text;
ALTER TABLE "leads" ADD COLUMN "applicable_industries" text[] DEFAULT '{}';
ALTER TABLE "leads" ADD COLUMN "value_tier" text;
ALTER TABLE "leads" ADD COLUMN "severity" text;
ALTER TABLE "leads" ADD COLUMN "deadline" timestamp;
CREATE UNIQUE INDEX "leads_content_hash_idx" ON "leads" ("content_hash") WHERE content_hash IS NOT NULL;
