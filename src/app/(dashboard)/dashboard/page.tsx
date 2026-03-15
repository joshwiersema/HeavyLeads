import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { getFilteredLeads } from "@/lib/leads/queries";
import {
  getOrgPipelineStatus,
  shouldAutoTrigger,
} from "@/lib/leads/pipeline-status";
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
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { PipelineProgress } from "@/components/dashboard/pipeline-progress";
import { RefreshLeadsButton } from "@/components/dashboard/refresh-leads-button";
import { AutoTrigger } from "@/components/dashboard/auto-trigger";
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

  const orgId = session.session.activeOrganizationId!;

  // Get company profile for active org
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(companyProfiles.organizationId, orgId),
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
    organizationId: orgId,
  });

  // Get pipeline status for progress indicator and empty state context
  const pipelineStatus = await getOrgPipelineStatus(orgId);

  // Check if we should auto-trigger the pipeline (first-login detection)
  const needsAutoTrigger =
    await shouldAutoTrigger(orgId, leads.length) && !pipelineStatus.isRunning;

  const effectiveRadius = parsedRadius ?? serviceRadius;

  // Determine if active filters are applied (for empty state context)
  const hasFilters = !!(
    keyword ||
    dateFrom ||
    dateTo ||
    (minProjectSize != null && !isNaN(minProjectSize)) ||
    (maxProjectSize != null && !isNaN(maxProjectSize)) ||
    (parsedEquipment && parsedEquipment.length > 0)
  );

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
      {/* Auto-trigger pipeline for first-login */}
      {needsAutoTrigger && <AutoTrigger />}

      {/* Page header with Refresh Leads button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Feed</h1>
          <p className="text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} within{" "}
            {effectiveRadius} miles{filterSummary}
          </p>
        </div>
        <RefreshLeadsButton />
      </div>

      {/* Pipeline progress indicator */}
      {pipelineStatus.isRunning && <PipelineProgress />}

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
            <DashboardEmptyState
              hasFilters={hasFilters}
              pipelineRunning={pipelineStatus.isRunning}
              hasEverHadLeads={pipelineStatus.hasEverRun}
            />
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
