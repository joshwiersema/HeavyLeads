import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { user, organization } from "@/lib/db/schema/auth";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import {
  getFilteredLeads,
  applyInMemoryFilters,
  filterByEquipment,
} from "@/lib/leads/queries";
import { sendDigest } from "./send-digest";
import type { DigestLead } from "./send-digest";
import {
  isSubscribed,
  generateUnsubscribeToken,
} from "./unsubscribe";

/** Summary of a digest generation run */
export interface DigestSummary {
  sent: number;
  skipped: number;
  errors: number;
}

/**
 * Generates and sends daily digest emails for all users with
 * digest-enabled saved searches.
 *
 * Process:
 * 1. Query all saved searches where isDigestEnabled = true, joined with user data
 * 2. Group by userId + organizationId
 * 3. For each user: check notification preferences, look up company profile,
 *    query matching leads from last 24h
 * 4. Merge and deduplicate leads across multiple saved searches
 * 5. Send digest email if matching leads exist; skip if none
 *
 * Returns a summary with counts of sent, skipped, and errored digests.
 * Wrapped in try/catch -- will not crash the process on failure.
 */
export async function generateDigests(): Promise<DigestSummary> {
  const summary: DigestSummary = { sent: 0, skipped: 0, errors: 0 };

  try {
    // 1. Get all digest-enabled saved searches with user info
    const searchesWithUsers = await db
      .select({
        saved_searches: savedSearches,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(savedSearches)
      .where(eq(savedSearches.isDigestEnabled, true))
      .innerJoin(user, eq(user.id, savedSearches.userId));

    if (searchesWithUsers.length === 0) {
      console.log("[digest] No digest-enabled saved searches found.");
      return summary;
    }

    // 2. Group by userId + organizationId
    const userGroups = new Map<
      string,
      {
        userId: string;
        organizationId: string;
        userName: string;
        email: string;
        searches: (typeof searchesWithUsers)[number]["saved_searches"][];
      }
    >();

    for (const row of searchesWithUsers) {
      const key = `${row.saved_searches.userId}:${row.saved_searches.organizationId}`;
      if (!userGroups.has(key)) {
        userGroups.set(key, {
          userId: row.saved_searches.userId,
          organizationId: row.saved_searches.organizationId,
          userName: row.user.name,
          email: row.user.email,
          searches: [],
        });
      }
      userGroups.get(key)!.searches.push(row.saved_searches);
    }

    const dashboardUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // 3. Process each user
    for (const [, group] of userGroups) {
      try {
        // Check notification preferences before processing
        const subscribed = await isSubscribed(
          group.userId,
          "daily_digest"
        );
        if (!subscribed) {
          console.log(
            `[digest] Skipping user ${group.userId}: unsubscribed from daily digest`
          );
          summary.skipped++;
          continue;
        }

        // Look up company profile for geo params
        const profile = await db.query.companyProfiles.findFirst({
          where: eq(companyProfiles.organizationId, group.organizationId),
        });

        if (!profile || profile.hqLat == null || profile.hqLng == null) {
          console.log(
            `[digest] Skipping user ${group.userId}: no company profile or HQ coordinates`
          );
          summary.skipped++;
          continue;
        }

        // Look up organization for industry
        let industry: string | undefined;
        try {
          const org = await db.query.organization.findFirst({
            where: eq(organization.id, group.organizationId),
          });
          industry = org?.industry ?? undefined;
        } catch {
          // Non-fatal: proceed without industry
        }

        // 24-hour window for "new" leads
        const twentyFourHoursAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        );

        const serviceRadius = profile.serviceRadiusMiles ?? 50;

        // Compute the widest filter envelope across all saved searches
        // so we can fetch all candidate leads in a single query
        const widest = {
          radiusMiles: Math.max(
            serviceRadius,
            ...group.searches.map((s) => s.radiusMiles ?? serviceRadius)
          ),
          dateFrom: group.searches.reduce((earliest, s) => {
            const d = s.dateFrom ?? twentyFourHoursAgo;
            return d < earliest ? d : earliest;
          }, twentyFourHoursAgo),
          dateTo: group.searches.reduce(
            (latest: Date | null, s) => {
              if (!s.dateTo) return null; // null = no upper bound = widest
              if (latest === null) return null;
              return s.dateTo > latest ? s.dateTo : latest;
            },
            new Date(0)
          ),
          minProjectSize: Math.min(
            ...group.searches.map((s) => s.minProjectSize ?? 0)
          ),
          maxProjectSize: Math.max(
            ...group.searches.map(
              (s) => s.maxProjectSize ?? Number.MAX_SAFE_INTEGER
            )
          ),
        };

        // Single query with widest params to fetch all candidate leads
        const allCandidates = await getFilteredLeads({
          hqLat: profile.hqLat,
          hqLng: profile.hqLng,
          serviceRadiusMiles: serviceRadius,
          dealerEquipment: profile.equipmentTypes ?? [],
          radiusMiles: widest.radiusMiles,
          dateFrom: widest.dateFrom,
          dateTo: widest.dateTo ?? undefined,
          minProjectSize:
            widest.minProjectSize > 0 ? widest.minProjectSize : undefined,
          maxProjectSize:
            widest.maxProjectSize < Number.MAX_SAFE_INTEGER
              ? widest.maxProjectSize
              : undefined,
          userId: group.userId,
          organizationId: group.organizationId,
          limit: 500,
        });

        // For each search, apply per-search filters in memory and collect unique leads
        const allLeadIds = new Set<string>();
        const allLeads: DigestLead[] = [];

        for (const search of group.searches) {
          let filtered = applyInMemoryFilters(allCandidates, {
            keyword: search.keyword ?? undefined,
            dateFrom: search.dateFrom ?? twentyFourHoursAgo,
            dateTo: search.dateTo ?? undefined,
            minProjectSize: search.minProjectSize ?? undefined,
            maxProjectSize: search.maxProjectSize ?? undefined,
          });

          filtered = filterByEquipment(
            filtered,
            search.equipmentFilter ?? undefined
          );

          const searchRadius = search.radiusMiles ?? serviceRadius;
          filtered = filtered.filter(
            (lead) =>
              lead.distance === null || lead.distance <= searchRadius
          );

          for (const lead of filtered) {
            if (!allLeadIds.has(lead.id)) {
              allLeadIds.add(lead.id);
              allLeads.push({
                id: lead.id,
                title: lead.title ?? "Untitled Lead",
                address: lead.address ?? lead.formattedAddress ?? "Unknown",
                score: lead.score,
                projectType: lead.projectType,
                distance: lead.distance,
              });
            }
          }
        }

        // 4. Send or skip
        if (allLeads.length === 0) {
          summary.skipped++;
          continue;
        }

        // Sort by score descending
        allLeads.sort((a, b) => b.score - a.score);

        // Generate unsubscribe URL for this user
        const unsubscribeUrl = `${dashboardUrl}/api/unsubscribe?token=${generateUnsubscribeToken(group.userId, "daily_digest")}`;

        await sendDigest(
          group.email,
          group.userName,
          allLeads,
          dashboardUrl,
          industry,
          unsubscribeUrl
        );
        summary.sent++;
      } catch (userError) {
        console.error(
          `[digest] Error processing user ${group.userId}:`,
          userError instanceof Error ? userError.message : userError
        );
        summary.errors++;
      }
    }

    console.log(
      `[digest] Complete: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.errors} errors`
    );
  } catch (error) {
    console.error(
      "[digest] Fatal error in generateDigests:",
      error instanceof Error ? error.message : error
    );
  }

  return summary;
}
