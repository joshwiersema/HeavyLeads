import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  integer,
  uniqueIndex,
  index,
  geometry,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Leads table -- stores scraped lead data from all source types.
 *
 * Supports permit, bid, news, and deep-web source types. permitNumber and
 * address are nullable to accommodate non-permit sources (e.g., news articles
 * may lack a street address, bid postings may not have a permit number).
 *
 * Coordinates: lat/lng stored as plain `real` columns for backward compat.
 * The `location` geometry(Point, 4326) column provides PostGIS spatial queries
 * with a GiST index. Uses { x: longitude, y: latitude } convention.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    permitNumber: text("permit_number"),
    title: text("title"),
    description: text("description"),
    address: text("address"),
    formattedAddress: text("formatted_address"),
    lat: real("lat"),
    lng: real("lng"),
    city: text("city"),
    state: text("state"),
    projectType: text("project_type"),
    estimatedValue: integer("estimated_value"),
    applicantName: text("applicant_name"),
    contractorName: text("contractor_name"),
    agencyName: text("agency_name"),
    permitDate: timestamp("permit_date"),
    postedDate: timestamp("posted_date"),
    deadlineDate: timestamp("deadline_date"),
    sourceType: text("source_type").notNull().default("permit"),
    sourceId: text("source_id").notNull(),
    sourceJurisdiction: text("source_jurisdiction"),
    sourceUrl: text("source_url"),
    scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    contentHash: text("content_hash"),
    applicableIndustries: text("applicable_industries").array().default([]),
    valueTier: text("value_tier"),
    severity: text("severity"),
    deadline: timestamp("deadline"),
    location: geometry("location", { type: "point", mode: "xy", srid: 4326 }),
  },
  (table) => [
    uniqueIndex("leads_source_permit_idx").on(
      table.sourceId,
      table.permitNumber
    ),
    index("leads_scraped_at_idx").on(table.scrapedAt),
    index("leads_source_type_idx").on(table.sourceType),
    uniqueIndex("leads_source_url_dedup_idx")
      .on(table.sourceId, table.sourceUrl)
      .where(sql`source_type != 'permit' AND source_url IS NOT NULL`),
    uniqueIndex("leads_content_hash_idx")
      .on(table.contentHash)
      .where(sql`content_hash IS NOT NULL`),
    index("leads_location_gist_idx").using("gist", table.location),
  ]
);
