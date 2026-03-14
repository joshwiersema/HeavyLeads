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
 * Leads table — stores scraped building permit data from all jurisdictions.
 *
 * Coordinates: lat/lng stored as plain `real` columns for MVP.
 * PostGIS upgrade path: Once Neon serverless driver compatibility with
 * PostGIS geometry types is verified, add a `geometry(Point, 4326)` column
 * with a GiST spatial index. The existing lat/lng columns can be kept for
 * backward compat or migrated. Haversine-based queries on real columns
 * are sufficient for MVP volumes (<100k records).
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    permitNumber: text("permit_number").notNull(),
    description: text("description"),
    address: text("address").notNull(),
    formattedAddress: text("formatted_address"),
    lat: real("lat"),
    lng: real("lng"),
    projectType: text("project_type"),
    estimatedValue: integer("estimated_value"),
    applicantName: text("applicant_name"),
    permitDate: timestamp("permit_date"),
    sourceId: text("source_id").notNull(),
    sourceJurisdiction: text("source_jurisdiction").notNull(),
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
  ]
);
