import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { organization } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { getFilteredLeadsCursor } from "@/lib/leads/queries";
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
import { StormAlertBanner } from "@/components/dashboard/storm-alert-banner";
import { getActiveStormAlertsForOrg } from "@/lib/storm-alerts/queries";
import { Pagination } from "./pagination";
import Link from "next/link";
import type { Industry } from "@/lib/onboarding/types";

export const metadata = {
  title: "Lead Feed | LeadForge",
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

  // Query org industry
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
    columns: { industry: true },
  });
  const industry = (org?.industry ?? "heavy_equipment") as Industry;

  // Fetch active storm alerts for this org (only for roofing industry)
  const stormAlerts =
    industry === "roofing" ? await getActiveStormAlertsForOrg(orgId) : [];

  // Parse filter and pagination params from URL
  const params = await searchParams;

  const cursor =
    typeof params.cursor === "string" ? params.cursor : undefined;

  const sourceTypesParam =
    typeof params.sourceTypes === "string" ? params.sourceTypes : "";
  const parsedSourceTypes = sourceTypesParam
    ? sourceTypesParam.split(",").filter(Boolean)
    : undefined;

  const maxDistanceParam =
    typeof params.maxDistance === "string"
      ? parseInt(params.maxDistance, 10)
      : undefined;
  const parsedMaxDistance =
    maxDistanceParam && !isNaN(maxDistanceParam) && maxDistanceParam >= 10 && maxDistanceParam <= 500
      ? maxDistanceParam
      : undefined;

  const projectTypesParam =
    typeof params.projectTypes === "string" ? params.projectTypes : "";
  const parsedProjectTypes = projectTypesParam
    ? projectTypesParam.split(",").filter(Boolean)
    : undefined;

  const keyword =
    typeof params.keyword === "string" && params.keyword
      ? params.keyword
      : undefined;

  const dateFrom =
    typeof params.dateFrom === "string" && params.dateFrom
      ? new Date(params.dateFrom)
      : undefined;
  const dateTo =
    typeof params.dateTo === "string" && params.dateTo
      ? new Date(params.dateTo)
      : undefined;

  const minValue =
    typeof params.minValue === "string"
      ? parseInt(params.minValue, 10)
      : undefined;
  const maxValue =
    typeof params.maxValue === "string"
      ? parseInt(params.maxValue, 10)
      : undefined;

  const sortBy =
    typeof params.sortBy === "string" &&
    ["score", "distance", "value", "date"].includes(params.sortBy)
      ? (params.sortBy as "score" | "distance" | "value" | "date")
      : undefined;

  const matchingSpecializationsOnly = params.matchOnly === "true";

  const serviceRadius = profile.serviceRadiusMiles ?? 50;

  // Check for active filters early (needed for nationwide fallback)
  const hasFilters = !!(
    keyword ||
    dateFrom ||
    dateTo ||
    (minValue != null && !isNaN(minValue)) ||
    (maxValue != null && !isNaN(maxValue)) ||
    (parsedSourceTypes && parsedSourceTypes.length > 0) ||
    (parsedProjectTypes && parsedProjectTypes.length > 0) ||
    matchingSpecializationsOnly
  );

  // Fetch scored leads with cursor-based pagination
  let { leads, nextCursor, hasMore } = await getFilteredLeadsCursor({
    orgId,
    userId: session.user.id,
    cursor,
    sourceTypes: parsedSourceTypes,
    maxDistanceMiles: parsedMaxDistance,
    minValue: minValue != null && !isNaN(minValue) ? minValue : undefined,
    maxValue: maxValue != null && !isNaN(maxValue) ? maxValue : undefined,
    projectTypes: parsedProjectTypes,
    dateFrom: dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined,
    dateTo: dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined,
    matchingSpecializationsOnly,
    sortBy,
    keyword,
  });

  // If no leads and no filters active, expand to nationwide
  // so new users always see something instead of an empty dashboard.
  let expandedNationwide = false;
  if (leads.length === 0 && !hasFilters && !cursor) {
    const nationwide = await getFilteredLeadsCursor({
      orgId,
      userId: session.user.id,
      maxDistanceMiles: 99999,
      limit: 50,
    });
    if (nationwide.leads.length > 0) {
      leads = nationwide.leads;
      nextCursor = nationwide.nextCursor;
      hasMore = nationwide.hasMore;
      expandedNationwide = true;
    }
  }

  // Get pipeline status for progress indicator and empty state context
  const pipelineStatus = await getOrgPipelineStatus(orgId);

  // Check if we should auto-trigger the pipeline (first-login detection)
  const needsAutoTrigger =
    await shouldAutoTrigger(orgId, leads.length) && !pipelineStatus.isRunning;

  // Industry label for header
  const industryLabels: Record<Industry, string> = {
    heavy_equipment: "heavy equipment",
    hvac: "HVAC",
    roofing: "roofing",
    solar: "solar",
    electrical: "electrical",
  };
  const industryLabel = industryLabels[industry];

  return (
    <div className="space-y-6">
      {/* Auto-trigger pipeline for first-login */}
      {needsAutoTrigger && <AutoTrigger />}

      {/* Page header with Refresh Leads button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Feed</h1>
          <p className="text-muted-foreground">
            {expandedNationwide
              ? `No nearby leads -- showing ${leads.length} nationwide`
              : `${leads.length} leads scored for your ${industryLabel} profile`}
          </p>
        </div>
        <RefreshLeadsButton />
      </div>

      {/* Pipeline progress indicator */}
      {pipelineStatus.isRunning && <PipelineProgress />}

      {/* Storm alert banner (roofing only) */}
      {stormAlerts.length > 0 && <StormAlertBanner alerts={stormAlerts} />}

      {/* Two-column layout: filters + cards */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar */}
        <aside className="w-full shrink-0 lg:w-[280px]">
          <Suspense fallback={null}>
            <LeadFilters
              defaultRadius={serviceRadius}
              industry={industry}
              specializations={profile.specializations ?? []}
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
              <Pagination nextCursor={nextCursor} hasMore={hasMore} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
