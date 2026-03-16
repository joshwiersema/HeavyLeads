import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { sql, and, or, isNull, ne, lt } from "drizzle-orm";

export async function expireStaleLeads(): Promise<{ expired: number }> {
  const now = new Date();
  let totalExpired = 0;

  // Only expire leads where severity IS NULL or severity != 'expired'
  const notAlreadyExpired = or(
    isNull(leads.severity),
    ne(leads.severity, "expired")
  );

  // Permit: scrapedAt > 90 days ago
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const permitResult = await db
    .update(leads)
    .set({ severity: "expired" })
    .where(
      and(
        sql`${leads.sourceType} = 'permit'`,
        lt(leads.scrapedAt, ninetyDaysAgo),
        notAlreadyExpired
      )
    )
    .returning({ id: leads.id });
  totalExpired += permitResult.length;

  // Bid: deadlineDate < now (past deadline)
  const bidResult = await db
    .update(leads)
    .set({ severity: "expired" })
    .where(
      and(
        sql`${leads.sourceType} = 'bid'`,
        sql`${leads.deadlineDate} IS NOT NULL`,
        lt(leads.deadlineDate, now),
        notAlreadyExpired
      )
    )
    .returning({ id: leads.id });
  totalExpired += bidResult.length;

  // News: scrapedAt > 60 days ago
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const newsResult = await db
    .update(leads)
    .set({ severity: "expired" })
    .where(
      and(
        sql`${leads.sourceType} = 'news'`,
        lt(leads.scrapedAt, sixtyDaysAgo),
        notAlreadyExpired
      )
    )
    .returning({ id: leads.id });
  totalExpired += newsResult.length;

  // Deep-web: scrapedAt > 30 days ago
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deepWebResult = await db
    .update(leads)
    .set({ severity: "expired" })
    .where(
      and(
        sql`${leads.sourceType} = 'deep-web'`,
        lt(leads.scrapedAt, thirtyDaysAgo),
        notAlreadyExpired
      )
    )
    .returning({ id: leads.id });
  totalExpired += deepWebResult.length;

  return { expired: totalExpired };
}
