import {
  pgTable,
  text,
  uuid,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

/**
 * Lead sources junction table -- tracks which data sources contributed to each lead.
 *
 * A single real-world project may appear across multiple sources (permit filing,
 * bid board posting, news article, deep-web search result). This table records
 * each source reference so the lead detail page can show full source attribution
 * and the dedup engine can track provenance.
 */
export const leadSources = pgTable(
  "lead_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    externalId: text("external_id"),
    sourceUrl: text("source_url"),
    title: text("title"),
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_sources_lead_source_idx").on(
      table.leadId,
      table.sourceId,
      table.externalId
    ),
    index("lead_sources_lead_id_idx").on(table.leadId),
  ]
);
