import Link from "next/link";
import {
  FileText,
  Gavel,
  Newspaper,
  CloudLightning,
  AlertTriangle,
  MapPin,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import type { BookmarkWithLead, PipelineStatus } from "@/actions/bookmark-types";
import { PipelineStatusSelect } from "./pipeline-status-select";
import { InlineNotes } from "./inline-notes";

/** Source type badge styling (matching lead-card.tsx pattern) */
const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  permit: {
    label: "Permit",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  bid: {
    label: "Bid",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  news: {
    label: "News",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  storm: {
    label: "Storm",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  violation: {
    label: "Violation",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "deep-web": {
    label: "Gov Contract",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

const SOURCE_ICON: Record<string, typeof FileText> = {
  permit: FileText,
  bid: Gavel,
  news: Newspaper,
  storm: CloudLightning,
  violation: AlertTriangle,
  "deep-web": FileText,
};

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

interface BookmarkCardProps {
  bookmark: BookmarkWithLead;
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const displayTitle =
    bookmark.title ?? bookmark.formattedAddress ?? bookmark.address ?? "Untitled Lead";

  const sourceBadge = SOURCE_BADGE[bookmark.sourceType] ?? SOURCE_BADGE.permit;
  const SourceIcon = SOURCE_ICON[bookmark.sourceType] ?? FileText;

  const formattedValue = formatValue(bookmark.estimatedValue);

  const locationParts = [bookmark.city, bookmark.state].filter(Boolean);
  const locationText =
    locationParts.length > 0 ? locationParts.join(", ") : null;

  const pipelineStatus = (bookmark.pipelineStatus ?? "saved") as PipelineStatus;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          {/* Left: Title and meta */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadge.className}`}
              >
                {sourceBadge.label}
              </span>
            </div>
            <Link
              href={`/dashboard/leads/${bookmark.leadId}`}
              className="block text-base font-medium leading-snug hover:underline"
            >
              {displayTitle}
            </Link>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {formattedValue && (
                <span className="flex items-center gap-1">
                  <DollarSign className="size-3" />
                  {formattedValue}
                </span>
              )}
              {locationText && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {locationText}
                </span>
              )}
              <span className="flex items-center gap-1">
                <SourceIcon className="size-3" />
                {sourceBadge.label}
              </span>
            </div>
          </div>

          {/* Right: Pipeline status dropdown */}
          <div className="shrink-0">
            <PipelineStatusSelect
              bookmarkId={bookmark.id}
              currentStatus={pipelineStatus}
            />
          </div>
        </div>
      </CardHeader>

      {/* Notes section */}
      <CardContent className="pt-0">
        <InlineNotes
          bookmarkId={bookmark.id}
          initialNotes={bookmark.notes}
        />
      </CardContent>
    </Card>
  );
}
