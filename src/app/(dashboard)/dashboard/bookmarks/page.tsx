import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { getBookmarkedLeads } from "@/actions/bookmarks";
import { getLeadsByIds } from "@/lib/leads/queries";
import { LeadCard } from "../lead-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bookmark } from "lucide-react";

export const metadata = {
  title: "Bookmarks | HeavyLeads",
};

export default async function BookmarksPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    notFound();
  }

  const orgId = session.session.activeOrganizationId;

  // Get company profile for lead enrichment context
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(companyProfiles.organizationId, orgId),
  });

  // Get bookmarked lead IDs
  const bookmarkedIds = await getBookmarkedLeads();

  // Fetch enriched lead data in a single batch query (replaces N+1 getLeadById calls)
  const enrichedLeads = await getLeadsByIds(bookmarkedIds, {
    hqLat: profile?.hqLat ?? undefined,
    hqLng: profile?.hqLng ?? undefined,
    serviceRadiusMiles: profile?.serviceRadiusMiles ?? undefined,
    dealerEquipment: profile?.equipmentTypes ?? undefined,
  });

  // Mark all as bookmarked (they came from the bookmarks list)
  const validLeads = enrichedLeads.map((lead) => ({
    ...lead,
    isBookmarked: true,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookmarked Leads</h1>
        <p className="text-muted-foreground">
          {validLeads.length} bookmarked lead{validLeads.length !== 1 ? "s" : ""}
        </p>
      </div>

      {validLeads.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bookmark className="size-5 text-muted-foreground" />
              <CardTitle>No bookmarked leads yet</CardTitle>
            </div>
            <CardDescription>
              Bookmark leads from the detail page to save them here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Browse the{" "}
              <a
                href="/dashboard"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                lead feed
              </a>{" "}
              and click the bookmark button on any lead to save it for quick
              access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {validLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
