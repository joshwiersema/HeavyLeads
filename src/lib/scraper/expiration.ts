import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/** Number of days before a lead is eligible for deletion */
const EXPIRATION_DAYS = 45;

/** Batch size for deletion to avoid overwhelming the database */
const DELETE_BATCH_SIZE = 500;

/**
 * Hard-delete leads older than 45 days that have no user interaction.
 *
 * Preservation rules:
 * - Bookmarked leads (any row in `bookmarks` table) are preserved regardless of age
 * - Leads with any `lead_statuses` entry (user explicitly interacted) are preserved
 * - All other leads older than EXPIRATION_DAYS are permanently deleted
 *
 * Related rows in lead_sources, lead_enrichments, etc. are cleaned up via
 * ON DELETE CASCADE foreign key constraints on those tables.
 *
 * Processes in batches of DELETE_BATCH_SIZE to avoid Neon serverless query timeouts.
 */
export async function expireStaleLeads(): Promise<{ expired: number }> {
  const cutoffDate = new Date(
    Date.now() - EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );
  let totalExpired = 0;

  let deletedInBatch: number;
  do {
    const result = await db.execute(sql`
      DELETE FROM leads
      WHERE id IN (
        SELECT l.id FROM leads l
        WHERE l.scraped_at < ${cutoffDate}
        AND NOT EXISTS (
          SELECT 1 FROM bookmarks b WHERE b.lead_id = l.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM lead_statuses ls WHERE ls.lead_id = l.id
        )
        LIMIT ${DELETE_BATCH_SIZE}
      )
    `);

    deletedInBatch = Number(result.rowCount ?? 0);
    totalExpired += deletedInBatch;

    console.log(
      `[expire] Batch deleted ${deletedInBatch} leads (total: ${totalExpired})`
    );
  } while (deletedInBatch === DELETE_BATCH_SIZE);

  return { expired: totalExpired };
}
