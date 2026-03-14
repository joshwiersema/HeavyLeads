import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Leads table -- stores scraped lead data from all source types.
 *
 * Supports permit, bid, news, and deep-web source types. permitNumber and
 * address are nullable to accommodate non-permit sources (e.g., news articles
 * may lack a street address, bid postings may not have a permit number).
 *
 * Coordinates: lat/lng stored as plain `real` columns for MVP.
 * PostGIS upgrade path: Once Neon serverless driver compatibility with
 * PostGIS geometry types is verified, add a `geometry(Point, 4326)` column
 * with a GiST spatial index. Haversine-based queries on real columns
 * are sufficient for MVP volumes (<100k records).
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
  },
  (table) => [
    uniqueIndex("leads_source_permit_idx").on(
      table.sourceId,
      table.permitNumber
    ),
    index("leads_scraped_at_idx").on(table.scrapedAt),
    index("leads_source_type_idx").on(table.sourceType),
  ]
);
