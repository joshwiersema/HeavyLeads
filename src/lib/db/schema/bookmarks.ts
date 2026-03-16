import {
  pgTable,
  text,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Bookmarks -- per-user, per-organization bookmarks on individual leads.
 *
 * Toggling a bookmark inserts or deletes a row. The unique index on
 * (userId, leadId, organizationId) prevents duplicate bookmarks and
 * supports ON CONFLICT DO NOTHING for safe upserts.
 */
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    notes: text("notes"),
    pipelineStatus: text("pipeline_status").default("saved"),
  },
  (table) => [
    uniqueIndex("bookmarks_user_lead_idx").on(
      table.userId,
      table.leadId,
      table.organizationId
    ),
  ]
);
