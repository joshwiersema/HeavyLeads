import { eq, and, gte, lte, sql, count, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, member, organization } from "@/lib/db/schema/auth";
import { leads } from "@/lib/db/schema/leads";
import { bookmarks } from "@/lib/db/schema/bookmarks";
import {
  isSubscribed,
  generateUnsubscribeToken,
} from "./unsubscribe";
import { sendWeeklySummary } from "./send-weekly-summary";
import type { WeeklySummaryStats } from "@/components/emails/weekly-summary";

/** Summary of a weekly summary generation run */
export interface WeeklySummarySummary {
  sent: number;
  skipped: number;
  errors: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Generates and sends weekly summary emails to all subscribed users.
 *
 * For each user with an organization membership:
 * 1. Check notification preferences (skip if unsubscribed)
 * 2. Query lead counts for current week vs prior week
 * 3. Compute top source types, top cities, bookmark count
 * 4. Send weekly summary email with trends
 *
 * Uses batch queries where possible to minimize N+1.
 */
export async function generateWeeklySummaries(): Promise<WeeklySummarySummary> {
  const summary: WeeklySummarySummary = { sent: 0, skipped: 0, errors: 0 };

  try {
    const dashboardUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Get all users with their organization memberships
    const usersWithOrgs = await db
      .select({
        userId: user.id,
        userName: user.name,
        email: user.email,
        organizationId: member.organizationId,
        industry: organization.industry,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .innerJoin(
        organization,
        eq(organization.id, member.organizationId)
      );

    if (usersWithOrgs.length === 0) {
      console.log("[weekly-summary] No users with organizations found.");
      return summary;
    }

    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    for (const userOrg of usersWithOrgs) {
      try {
        // Check notification preferences
        const subscribed = await isSubscribed(
          userOrg.userId,
          "weekly_summary"
        );
        if (!subscribed) {
          console.log(
            `[weekly-summary] Skipping user ${userOrg.userId}: unsubscribed`
          );
          summary.skipped++;
          continue;
        }

        const industry = userOrg.industry ?? undefined;

        // Query leads for this week
        const thisWeekLeads = await db
          .select({ cnt: count() })
          .from(leads)
          .where(
            and(
              gte(leads.createdAt, thisWeekStart),
              lte(leads.createdAt, now)
            )
          );

        const totalLeadsThisWeek = thisWeekLeads[0]?.cnt ?? 0;

        // Query leads for last week
        const lastWeekLeads = await db
          .select({ cnt: count() })
          .from(leads)
          .where(
            and(
              gte(leads.createdAt, lastWeekStart),
              lte(leads.createdAt, thisWeekStart)
            )
          );

        const totalLeadsLastWeek = lastWeekLeads[0]?.cnt ?? 0;

        // Top source types (this week)
        const sourceTypes = await db
          .select({
            type: leads.sourceType,
            cnt: count(),
          })
          .from(leads)
          .where(
            and(
              gte(leads.createdAt, thisWeekStart),
              lte(leads.createdAt, now)
            )
          )
          .groupBy(leads.sourceType)
          .orderBy(desc(count()))
          .limit(5);

        const topSourceTypes = sourceTypes.map((r) => ({
          type: r.type,
          count: r.cnt,
        }));

        // Top cities (this week)
        const cities = await db
          .select({
            city: leads.city,
            cnt: count(),
          })
          .from(leads)
          .where(
            and(
              gte(leads.createdAt, thisWeekStart),
              lte(leads.createdAt, now),
              sql`${leads.city} IS NOT NULL`
            )
          )
          .groupBy(leads.city)
          .orderBy(desc(count()))
          .limit(3);

        const topCities = cities.map((r) => ({
          city: r.city ?? "Unknown",
          count: r.cnt,
        }));

        // Bookmark count for user
        const bookmarkResult = await db
          .select({ cnt: count() })
          .from(bookmarks)
          .where(
            and(
              eq(bookmarks.userId, userOrg.userId),
              eq(bookmarks.organizationId, userOrg.organizationId)
            )
          );

        const bookmarkCount = bookmarkResult[0]?.cnt ?? 0;

        // Leads per day (this week)
        const newLeadsByDay: { day: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(
            now.getTime() - (i + 1) * 24 * 60 * 60 * 1000
          );
          const dayEnd = new Date(
            now.getTime() - i * 24 * 60 * 60 * 1000
          );
          const dayLabel = DAY_LABELS[dayEnd.getUTCDay()];

          const dayLeads = await db
            .select({ cnt: count() })
            .from(leads)
            .where(
              and(
                gte(leads.createdAt, dayStart),
                lte(leads.createdAt, dayEnd)
              )
            );

          newLeadsByDay.push({
            day: dayLabel,
            count: dayLeads[0]?.cnt ?? 0,
          });
        }

        const stats: WeeklySummaryStats = {
          totalLeadsThisWeek,
          totalLeadsLastWeek,
          topSourceTypes,
          topCities,
          bookmarkCount,
          newLeadsByDay,
        };

        const unsubscribeUrl = `${dashboardUrl}/api/unsubscribe?token=${generateUnsubscribeToken(userOrg.userId, "weekly_summary")}`;

        await sendWeeklySummary(
          userOrg.email,
          userOrg.userName,
          stats,
          industry,
          dashboardUrl,
          unsubscribeUrl
        );
        summary.sent++;
      } catch (userError) {
        console.error(
          `[weekly-summary] Error processing user ${userOrg.userId}:`,
          userError instanceof Error ? userError.message : userError
        );
        summary.errors++;
      }
    }

    console.log(
      `[weekly-summary] Complete: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.errors} errors`
    );
  } catch (error) {
    console.error(
      "[weekly-summary] Fatal error in generateWeeklySummaries:",
      error instanceof Error ? error.message : error
    );
  }

  return summary;
}
