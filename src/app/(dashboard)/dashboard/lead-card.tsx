import Link from "next/link";
import {
  MapPin,
  Bookmark,
  FileText,
  Gavel,
  Newspaper,
  CloudLightning,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoredLead } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/db/schema/lead-statuses";

/** Color mapping for status indicators */
const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; className: string }
> = {
  new: { label: "New", className: "text-gray-500" },
  viewed: { label: "Viewed", className: "text-blue-600" },
  contacted: { label: "Contacted", className: "text-amber-600" },
  won: { label: "Won", className: "text-green-600" },
  lost: { label: "Lost", className: "text-red-600" },
};

const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-gray-400",
  viewed: "bg-blue-500",
  contacted: "bg-amber-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

/** Color mapping for freshness badges */
const FRESHNESS_VARIANT = {
  New: "default",
  "This Week": "secondary",
  Older: "outline",
} as const;

/** Source type badge styling */
const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  permit: {
    label: "Permit",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  bid: {
    label: "Bid",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  news: {
    label: "News",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  storm: {
    label: "Storm",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  violation: {
    label: "Violation",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "deep-web": {
    label: "Gov Contract",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

/** Source type icon mapping */
const SOURCE_ICON: Record<string, typeof FileText> = {
  permit: FileText,
  bid: Gavel,
  news: Newspaper,
  storm: CloudLightning,
  violation: AlertTriangle,
  "deep-web": FileText,
};

/** Score color based on value range */
function scoreColor(score: number): string {
  if (score >= 70)
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40)
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

/** Format estimated value as $XXK or $X.XM */
function formatValue(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function LeadCard({ lead }: { lead: ScoredLead }) {
  const displayTitle =
    lead.title ?? lead.formattedAddress ?? lead.address ?? "Untitled Lead";

  const leadStatus = (lead.status ?? "new") as LeadStatus;
  const statusInfo = STATUS_CONFIG[leadStatus];
  const statusDot = STATUS_DOT[leadStatus];

  const sourceBadge = SOURCE_BADGE[lead.sourceType] ?? SOURCE_BADGE.permit;
  const SourceIcon = SOURCE_ICON[lead.sourceType] ?? FileText;

  // Top 2 match reasons, truncated
  const matchReasons = lead.scoring.matchReasons.slice(0, 2);
  const hasMoreReasons = lead.scoring.matchReasons.length > 2;

  const formattedValue = formatValue(lead.estimatedValue);

  // Location text
  const locationParts = [lead.city, lead.state].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(", ") : null;

  return (
    <Link href={`/dashboard/leads/${lead.id}`} className="block group">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          {/* Header row: source type badge, freshness badge, bookmark */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadge.className}`}
              >
                {sourceBadge.label}
              </span>
              <Badge variant={FRESHNESS_VARIANT[lead.freshness]}>
                {lead.freshness}
              </Badge>
            </div>
            {lead.isBookmarked && (
              <Bookmark className="size-4 shrink-0 fill-current text-amber-500" />
            )}
          </div>

          {/* Title */}
          <div className="mt-1 text-base font-medium leading-snug">
            {displayTitle}
          </div>

          {/* Score row: score indicator + match reasons */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(lead.scoring.total)}`}
              data-testid="lead-score"
            >
              {lead.scoring.total}
            </span>
            {matchReasons.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">
                {matchReasons.join(", ")}
                {hasMoreReasons ? "..." : ""}
              </span>
            )}
          </div>
        </CardHeader>

        {/* Details row: value, distance, source icon */}
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {formattedValue && (
              <span className="flex items-center gap-1">
                <DollarSign className="size-3" />
                {formattedValue}
              </span>
            )}
            {lead.distance != null && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {Math.round(lead.distance)} mi
              </span>
            )}
            <span className="flex items-center gap-1">
              <SourceIcon className="size-3" />
              {sourceBadge.label}
            </span>
          </div>
        </CardContent>

        {/* Footer: status + location */}
        <CardFooter className="text-xs text-muted-foreground gap-4">
          {leadStatus !== "new" && (
            <span
              className={`inline-flex items-center gap-1 font-medium ${statusInfo.className}`}
            >
              <span
                className={`inline-block size-1.5 rounded-full ${statusDot}`}
              />
              {statusInfo.label}
            </span>
          )}
          {locationText && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {locationText}
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
