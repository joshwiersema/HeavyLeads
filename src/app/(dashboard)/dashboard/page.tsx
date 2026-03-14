import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { getFilteredLeads } from "@/lib/leads/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadCard } from "./lead-card";
import { LeadCardSkeleton } from "./lead-card-skeleton";
import { LeadFilters } from "./lead-filters";
import Link from "next/link";

export const metadata = {
  title: "Lead Feed | HeavyLeads",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  // Get company profile for active org
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId!
    ),
  });

  // Guard: missing HQ coordinates
  if (!profile?.hqLat || !profile?.hqLng) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Feed</h1>
          <p className="text-muted-foreground">
            Set up your headquarters location to see leads.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Location Required</CardTitle>
            <CardDescription>
              We need your HQ coordinates to calculate lead distances and filter
              by radius.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings"
              className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Update your company settings
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse filter params from URL
  const params = await searchParams;

  const equipmentParam =
    typeof params.equipment === "string" ? params.equipment : "";
  const parsedEquipment = equipmentParam
    ? equipmentParam.split(",").filter(Boolean)
    : undefined;

  const radiusParam =
    typeof params.radius === "string" ? parseInt(params.radius, 10) : undefined;
  const parsedRadius =
    radiusParam && !isNaN(radiusParam) && radiusParam >= 10 && radiusParam <= 500
      ? radiusParam
      : undefined;

  // New filter params
  const keyword =
    typeof params.keyword === "string" && params.keyword ? params.keyword : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" && params.dateFrom
      ? new Date(params.dateFrom)
      : undefined;
  const dateTo =
    typeof params.dateTo === "string" && params.dateTo
      ? new Date(params.dateTo)
      : undefined;
  const minProjectSize =
    typeof params.minProjectSize === "string"
      ? parseInt(params.minProjectSize, 10)
      : undefined;
  const maxProjectSize =
    typeof params.maxProjectSize === "string"
      ? parseInt(params.maxProjectSize, 10)
      : undefined;

  const serviceRadius = profile.serviceRadiusMiles ?? 50;
  const dealerEquipment = (profile.equipmentTypes as string[]) ?? [];

  // Fetch filtered leads with user context for status/bookmark enrichment
  const leads = await getFilteredLeads({
    hqLat: profile.hqLat,
    hqLng: profile.hqLng,
    serviceRadiusMiles: serviceRadius,
    dealerEquipment,
    radiusMiles: parsedRadius,
    equipmentFilter: parsedEquipment,
    keyword,
    dateFrom: dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined,
    dateTo: dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined,
    minProjectSize:
      minProjectSize != null && !isNaN(minProjectSize)
        ? minProjectSize
        : undefined,
    maxProjectSize:
      maxProjectSize != null && !isNaN(maxProjectSize)
        ? maxProjectSize
        : undefined,
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId!,
  });

  const effectiveRadius = parsedRadius ?? serviceRadius;

  // Count active filters for display
  const activeFilterParts: string[] = [];
  if (keyword) activeFilterParts.push(`keyword "${keyword}"`);
  if (dateFrom) activeFilterParts.push("date from");
  if (dateTo) activeFilterParts.push("date to");
  if (minProjectSize != null && !isNaN(minProjectSize)) activeFilterParts.push("min size");
  if (maxProjectSize != null && !isNaN(maxProjectSize)) activeFilterParts.push("max size");
  if (parsedEquipment && parsedEquipment.length > 0) activeFilterParts.push(`${parsedEquipment.length} equipment`);
  const filterSummary = activeFilterParts.length > 0 ? ` (filtered by ${activeFilterParts.join(", ")})` : "";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Feed</h1>
        <p className="text-muted-foreground">
          {leads.length} lead{leads.length !== 1 ? "s" : ""} within{" "}
          {effectiveRadius} miles{filterSummary}
        </p>
      </div>

      {/* Two-column layout: filters + cards */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar */}
        <aside className="w-full shrink-0 lg:w-[280px]">
          <Suspense fallback={null}>
            <LeadFilters
              defaultRadius={serviceRadius}
              dealerEquipment={dealerEquipment}
            />
          </Suspense>
        </aside>

        {/* Lead card feed */}
        <div className="flex-1">
          {leads.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No leads found</CardTitle>
                <CardDescription>
                  No leads match your current filters. Try adjusting your search
                  to see more results.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Expand your search radius</li>
                  <li>Clear equipment filters to see all lead types</li>
                  <li>
                    Check your{" "}
                    <Link
                      href="/settings"
                      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      company settings
                    </Link>{" "}
                    to verify your service area
                  </li>
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Suspense fallback={<LeadCardSkeleton />}>
              <div className="space-y-4">
                {leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
