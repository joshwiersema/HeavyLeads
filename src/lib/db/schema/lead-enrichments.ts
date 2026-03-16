import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Lead enrichments -- stores additional data fetched for a lead from
 * external sources (e.g., company info, contact details, project details).
 *
 * Each enrichment has a type (e.g., "company_info", "contacts"), the raw
 * data as text (JSON stringified), and expiration tracking for cache
 * invalidation.
 */
export const leadEnrichments = pgTable(
  "lead_enrichments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    enrichmentType: text("enrichment_type").notNull(),
    data: text("data").notNull(),
    source: text("source"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [index("lead_enrichments_lead_id_idx").on(table.leadId)]
);
