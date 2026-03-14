import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  real,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * Saved searches -- per-user, per-organization saved filter configurations.
 *
 * Filter criteria are stored as explicit columns (not a JSON blob) so
 * they can be queried at the SQL level for email digest generation.
 * The isDigestEnabled flag determines which saved searches drive the
 * daily email digest.
 */
export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  equipmentFilter: text("equipment_filter").array(),
  radiusMiles: real("radius_miles"),
  keyword: text("keyword"),
  dateFrom: timestamp("date_from"),
  dateTo: timestamp("date_to"),
  minProjectSize: integer("min_project_size"),
  maxProjectSize: integer("max_project_size"),
  isDigestEnabled: boolean("is_digest_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
