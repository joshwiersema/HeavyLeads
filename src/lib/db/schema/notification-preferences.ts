import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Notification preferences -- per-user opt-out settings for email notifications.
 *
 * Uses an opt-out model (defaults to true) per CAN-SPAM requirements.
 * One row per user, upserted when a user unsubscribes from any email type.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    dailyDigest: boolean("daily_digest").default(true).notNull(),
    weeklySummary: boolean("weekly_summary").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("notification_prefs_user_idx").on(table.userId)]
);
