ALTER TABLE "organization" ADD COLUMN "industry" text DEFAULT 'heavy_equipment';
UPDATE "organization" SET "industry" = 'heavy_equipment' WHERE "industry" IS NULL;
