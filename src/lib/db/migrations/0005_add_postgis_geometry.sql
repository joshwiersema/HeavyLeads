ALTER TABLE "leads" ADD COLUMN "location" geometry(Point, 4326);
CREATE INDEX "leads_location_gist_idx" ON "leads" USING gist ("location");
UPDATE "leads" SET "location" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
  WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL AND "location" IS NULL;
