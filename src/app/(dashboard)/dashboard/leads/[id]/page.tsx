import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { getLeadById, getLeadSources } from "@/lib/leads/queries";
import { getLeadStatus } from "@/actions/lead-status";
import { getBookmarkedLeads } from "@/actions/bookmarks";
import type { LeadSource } from "@/lib/leads/queries";
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
import { LeadTimeline } from "./lead-timeline";
import { LeadMap } from "./lead-map-dynamic";
import { LeadStatusSelect } from "./lead-status-select";
import { BookmarkButton } from "./bookmark-button";
import type { EnrichedLead, InferredEquipment } from "@/lib/leads/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) {
    return { title: "Lead Not Found | HeavyLeads" };
  }
  return { title: `${lead.address} | HeavyLeads` };
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

  // Get company profile for scoring context
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(companyProfiles.organizationId, orgId),
  });

  const lead = await getLeadById(id, {
    hqLat: profile?.hqLat ?? undefined,
    hqLng: profile?.hqLng ?? undefined,
    serviceRadiusMiles: profile?.serviceRadiusMiles ?? undefined,
    dealerEquipment: profile?.equipmentTypes ?? undefined,
  });

  if (!lead) {
    notFound();
  }

  // Fetch status, bookmark state, and sources in parallel
  const [status, bookmarkedIds, sources] = await Promise.all([
    getLeadStatus(lead.id),
    getBookmarkedLeads(),
    getLeadSources(lead.id),
  ]);

  const isBookmarked = bookmarkedIds.includes(lead.id);

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
          {lead.address}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <FreshnessBadge freshness={lead.freshness} />
          <Badge variant="secondary">Score: {lead.score}</Badge>
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
                  title={lead.formattedAddress ?? lead.address ?? "Unknown location"}
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
              </dl>
            </CardContent>
          </Card>

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
          {/* Equipment Needs card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Equipment Needs</CardTitle>
              <CardDescription>
                Inferred from project type and description
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lead.inferredEquipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No specific equipment needs inferred
                </p>
              ) : (
                <div className="space-y-3">
                  {lead.inferredEquipment.map((eq) => (
                    <EquipmentNeedItem key={eq.type} equipment={eq} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline card */}
          {lead.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Equipment Timeline</CardTitle>
                <CardDescription>
                  Projected equipment needs by phase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeadTimeline timeline={lead.timeline} />
              </CardContent>
            </Card>
          )}

          {/* Score Breakdown card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold">{lead.score}</div>
                <div className="text-sm text-muted-foreground">/ 100</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Based on equipment match, geographic proximity, and project
                value.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// -- Helper components --

function FreshnessBadge({
  freshness,
}: {
  freshness: EnrichedLead["freshness"];
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

function EquipmentNeedItem({ equipment }: { equipment: InferredEquipment }) {
  return (
    <div className="flex items-start gap-2">
      <ConfidenceDot confidence={equipment.confidence} />
      <div>
        <div className="text-sm font-medium">{equipment.type}</div>
        <div className="text-xs text-muted-foreground">{equipment.reason}</div>
      </div>
    </div>
  );
}

function ConfidenceDot({
  confidence,
}: {
  confidence: InferredEquipment["confidence"];
}) {
  const colorClass =
    confidence === "high"
      ? "bg-green-500"
      : confidence === "medium"
        ? "bg-yellow-500"
        : "bg-gray-400";

  return (
    <div
      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colorClass}`}
      title={`${confidence} confidence`}
    />
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
