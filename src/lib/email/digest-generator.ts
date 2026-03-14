import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { user } from "@/lib/db/schema/auth";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { getFilteredLeads } from "@/lib/leads/queries";
import { sendDigest } from "./send-digest";
import type { DigestLead } from "./send-digest";

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
 * 3. For each user: look up company profile, query matching leads from last 24h
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

        // 24-hour window for "new" leads
        const twentyFourHoursAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        );

        // Collect leads across all digest-enabled saved searches
        const allLeadIds = new Set<string>();
        const allLeads: DigestLead[] = [];

        for (const search of group.searches) {
          // Use the more restrictive of: 24h ago or the search's own dateFrom
          let dateFrom = twentyFourHoursAgo;
          if (search.dateFrom && search.dateFrom > twentyFourHoursAgo) {
            dateFrom = search.dateFrom;
          }

          const leads = await getFilteredLeads({
            hqLat: profile.hqLat,
            hqLng: profile.hqLng,
            serviceRadiusMiles: profile.serviceRadiusMiles ?? 50,
            dealerEquipment: profile.equipmentTypes ?? [],
            radiusMiles: search.radiusMiles ?? undefined,
            equipmentFilter: search.equipmentFilter ?? undefined,
            keyword: search.keyword ?? undefined,
            dateFrom,
            dateTo: search.dateTo ?? undefined,
            minProjectSize: search.minProjectSize ?? undefined,
            maxProjectSize: search.maxProjectSize ?? undefined,
            userId: group.userId,
            organizationId: group.organizationId,
          });

          // Deduplicate and map to DigestLead
          for (const lead of leads) {
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

        await sendDigest(group.email, group.userName, allLeads, dashboardUrl);
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
