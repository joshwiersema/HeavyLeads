import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { organizationProfiles } from "@/lib/db/schema/organization-profiles";
import { leadEnrichments } from "@/lib/db/schema/lead-enrichments";
import { eq } from "drizzle-orm";
import { getLeadByIdScored, getLeadSources } from "@/lib/leads/queries";
import type { LeadSource } from "@/lib/leads/queries";
import { getLeadStatus } from "@/actions/lead-status";
import { getBookmarkedLeads } from "@/actions/bookmarks";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadMap } from "./lead-map-dynamic";
import { LeadStatusSelect } from "./lead-status-select";
import { BookmarkButton } from "./bookmark-button";
import { ScoreBreakdown } from "./score-breakdown";
import { EnrichmentCards } from "./enrichment-cards";
import type { EnrichmentCardsProps } from "./enrichment-cards";
import { SimilarLeads } from "./similar-leads";
import type { FreshnessBadge as FreshnessBadgeType } from "@/lib/leads/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return { title: "Lead Not Found | LeadForge" };

  const orgId = session.session.activeOrganizationId;
  if (!orgId) return { title: "Lead Not Found | LeadForge" };

  const lead = await getLeadByIdScored(id, orgId);
  if (!lead) {
    return { title: "Lead Not Found | LeadForge" };
  }
  return {
    title: `${lead.title ?? lead.address ?? "Lead"} | LeadForge`,
  };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    notFound();
  }

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    notFound();
  }

  // Fetch org profile for HQ coords and service radius (map overlay)
  const profile = await db.query.organizationProfiles.findFirst({
    where: eq(organizationProfiles.organizationId, orgId),
  });

  // Fetch scored lead
  const lead = await getLeadByIdScored(id, orgId);
  if (!lead) {
    notFound();
  }

  // Fetch status, bookmark state, sources, and enrichments in parallel
  const [status, bookmarkedIds, sources, enrichmentRows] = await Promise.all([
    getLeadStatus(lead.id),
    getBookmarkedLeads(),
    getLeadSources(lead.id),
    db
      .select()
      .from(leadEnrichments)
      .where(eq(leadEnrichments.leadId, id)),
  ]);

  const isBookmarked = bookmarkedIds.includes(lead.id);

  // Parse enrichment data safely
  const enrichmentData = parseEnrichmentData(enrichmentRows);

  // Industry tags from applicableIndustries
  const industries = (lead.applicableIndustries as string[] | null) ?? [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </Link>

      {/* Header section */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          {lead.title ?? lead.address ?? "Untitled Lead"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <FreshnessBadge freshness={lead.freshness} />
          <ScorePill score={lead.scoring.total} />
          {industries.map((industry) => (
            <Badge
              key={industry}
              variant="outline"
              className="text-xs capitalize"
            >
              {industry.replace(/_/g, " ")}
            </Badge>
          ))}
          <LeadStatusSelect leadId={lead.id} currentStatus={status} />
          <BookmarkButton leadId={lead.id} isBookmarked={isBookmarked} />
        </div>
        <p className="text-sm text-muted-foreground">
          {[lead.projectType, lead.sourceJurisdiction, lead.permitNumber]
            .filter(Boolean)
            .join(" \u00b7 ")}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.lat != null && lead.lng != null ? (
                <LeadMap
                  lat={lead.lat}
                  lng={lead.lng}
                  title={lead.title ?? lead.address ?? "Unknown location"}
                  hqLat={profile?.hqLat ?? undefined}
                  hqLng={profile?.hqLng ?? undefined}
                  serviceRadiusMiles={
                    profile?.serviceRadiusMiles ?? undefined
                  }
                />
              ) : (
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Location not available
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Details card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {lead.description && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm">{lead.description}</dd>
                  </div>
                )}
                {lead.estimatedValue != null && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Estimated Value
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {formatCurrency(lead.estimatedValue)}
                    </dd>
                  </div>
                )}
                {lead.permitDate && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Permit Date
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(lead.permitDate)}
                    </dd>
                  </div>
                )}
                {lead.applicantName && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Applicant / Contractor
                    </dt>
                    <dd className="mt-1 text-sm">{lead.applicantName}</dd>
                  </div>
                )}
                {lead.distance != null && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Distance from HQ
                    </dt>
                    <dd className="mt-1 text-sm">
                      {Math.round(lead.distance)} miles
                    </dd>
                  </div>
                )}
                {lead.sourceType && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Source Type
                    </dt>
                    <dd className="mt-1">
                      <SourceTypeBadge sourceType={lead.sourceType} />
                    </dd>
                  </div>
                )}
                {industries.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Applicable Industries
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {industries.map((ind) => (
                        <Badge
                          key={ind}
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {ind.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
                {lead.deadline && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Deadline
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(lead.deadline)}
                    </dd>
                  </div>
                )}
                {lead.severity && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Severity
                    </dt>
                    <dd className="mt-1">
                      <Badge
                        variant={
                          lead.severity === "critical"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs capitalize"
                      >
                        {lead.severity}
                      </Badge>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Enrichment cards */}
          <EnrichmentCards
            weather={enrichmentData.weather}
            property={enrichmentData.property}
            incentives={enrichmentData.incentives}
          />

          {/* Source Attribution card -- supports single and multi-source leads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {sources.length > 1
                  ? `Sources (${sources.length})`
                  : "Source"}
              </CardTitle>
              <CardDescription>
                {sources.length > 1
                  ? "This lead was found across multiple data sources"
                  : `Data from ${lead.sourceJurisdiction ?? lead.sourceId}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sources.length > 0 ? (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <SourceEntry key={source.id} source={source} />
                  ))}
                </div>
              ) : (
                /* Fallback for leads without lead_sources entries (legacy data) */
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-mono text-xs">{lead.sourceId}</span>
                  </div>
                  {lead.sourceJurisdiction && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Jurisdiction
                      </span>
                      <span>{lead.sourceJurisdiction}</span>
                    </div>
                  )}
                  {lead.permitNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Permit #</span>
                      <span className="font-mono text-xs">
                        {lead.permitNumber}
                      </span>
                    </div>
                  )}
                  {lead.sourceUrl && (
                    <div className="pt-2">
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View original source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Score Breakdown card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Score</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreBreakdown scoring={lead.scoring} />
            </CardContent>
          </Card>

          {/* Similar Leads card */}
          {lead.lat != null && lead.lng != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Similar Leads</CardTitle>
                <CardDescription>
                  Nearby leads you may also be interested in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SimilarLeads
                  leadId={lead.id}
                  lat={lead.lat}
                  lng={lead.lng}
                  orgId={orgId}
                />
              </CardContent>
            </Card>
          )}

          {/* Bookmark & Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <LeadStatusSelect leadId={lead.id} currentStatus={status} />
              <BookmarkButton leadId={lead.id} isBookmarked={isBookmarked} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// -- Enrichment data parser --

function parseEnrichmentData(
  rows: { enrichmentType: string; data: string }[]
): EnrichmentCardsProps {
  let weather: EnrichmentCardsProps["weather"] = null;
  let property: EnrichmentCardsProps["property"] = null;
  let incentives: EnrichmentCardsProps["incentives"] = null;

  const weatherRow = rows.find((e) => e.enrichmentType === "weather");
  if (weatherRow) {
    try {
      weather = JSON.parse(weatherRow.data);
    } catch {
      // Invalid JSON -- ignore
    }
  }

  const propertyRow = rows.find((e) => e.enrichmentType === "property");
  if (propertyRow) {
    try {
      property = JSON.parse(propertyRow.data);
    } catch {
      // Invalid JSON -- ignore
    }
  }

  const incentiveRows = rows.filter((e) => e.enrichmentType === "incentive");
  if (incentiveRows.length > 0) {
    const parsed: NonNullable<EnrichmentCardsProps["incentives"]> = [];
    for (const row of incentiveRows) {
      try {
        const data = JSON.parse(row.data);
        if (data.name && data.amount) {
          parsed.push(data);
        }
      } catch {
        // Invalid JSON -- skip
      }
    }
    if (parsed.length > 0) {
      incentives = parsed;
    }
  }

  return { weather, property, incentives };
}

// -- Helper components --

function FreshnessBadge({
  freshness,
}: {
  freshness: FreshnessBadgeType;
}) {
  switch (freshness) {
    case "New":
      return (
        <Badge variant="default" className="bg-green-600">
          New
        </Badge>
      );
    case "This Week":
      return <Badge variant="outline">This Week</Badge>;
    case "Older":
      return <Badge variant="secondary">Older</Badge>;
  }
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800"
      : score >= 40
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-100 text-gray-800";

  return (
    <Badge variant="secondary" className={`${color} text-xs`}>
      Score: {score}
    </Badge>
  );
}

function SourceEntry({ source }: { source: LeadSource }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <SourceTypeBadge sourceType={source.sourceType} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium">
          {source.title || source.sourceId}
        </div>
        <div className="text-xs text-muted-foreground">
          Discovered {formatDate(source.discoveredAt)}
        </div>
        {source.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View source
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function SourceTypeBadge({ sourceType }: { sourceType: string }) {
  const config: Record<string, { label: string; className: string }> = {
    permit: { label: "Permit", className: "bg-blue-100 text-blue-800" },
    bid: { label: "Bid", className: "bg-purple-100 text-purple-800" },
    news: { label: "News", className: "bg-amber-100 text-amber-800" },
    "deep-web": {
      label: "Deep Web",
      className: "bg-emerald-100 text-emerald-800",
    },
  };

  const { label, className } = config[sourceType] ?? {
    label: sourceType,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge
      variant="secondary"
      className={`shrink-0 text-xs ${className}`}
    >
      {label}
    </Badge>
  );
}

// -- Formatting helpers --

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
