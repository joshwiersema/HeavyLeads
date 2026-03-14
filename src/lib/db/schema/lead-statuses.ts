import {
  pgTable,
  text,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Lead status tracking -- per-user, per-organization status for each lead.
 *
 * Leads without an explicit row default to "new" at the query layer
 * (via COALESCE in LEFT JOIN). A row is only inserted when the user
 * explicitly changes a lead's status.
 */
export const leadStatuses = pgTable(
  "lead_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    status: text("status").notNull().default("new"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_statuses_user_lead_idx").on(
      table.userId,
      table.leadId,
      table.organizationId
    ),
  ]
);

/** Valid lead status values */
export type LeadStatus = "new" | "viewed" | "contacted" | "won" | "lost";

/** All valid lead status values as array for validation */
export const LEAD_STATUS_VALUES: LeadStatus[] = [
  "new",
  "viewed",
  "contacted",
  "won",
  "lost",
];
