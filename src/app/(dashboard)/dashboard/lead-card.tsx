import Link from "next/link";
import { MapPin, Calendar, User, Bookmark } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { safeFormatDate } from "@/lib/utils";
import type { EnrichedLead } from "@/lib/leads/types";
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

/** Score color based on value range */
function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

/** Maximum number of equipment tags to show before truncating */
const MAX_EQUIPMENT_TAGS = 4;

export function LeadCard({ lead }: { lead: EnrichedLead }) {
  const displayAddress = lead.formattedAddress || lead.address;
  const equipmentToShow = lead.inferredEquipment.slice(0, MAX_EQUIPMENT_TAGS);
  const overflowCount = lead.inferredEquipment.length - MAX_EQUIPMENT_TAGS;

  const leadStatus = (lead.status ?? "new") as LeadStatus;
  const statusInfo = STATUS_CONFIG[leadStatus];
  const statusDot = STATUS_DOT[leadStatus];

  return (
    <Link href={`/dashboard/leads/${lead.id}`} className="block group">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {lead.projectType && (
                <Badge variant="secondary" className="truncate max-w-[200px]">
                  {lead.projectType}
                </Badge>
              )}
              <Badge variant={FRESHNESS_VARIANT[lead.freshness]}>
                {lead.freshness}
              </Badge>
              {leadStatus !== "new" && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusInfo.className}`}>
                  <span className={`inline-block size-1.5 rounded-full ${statusDot}`} />
                  {statusInfo.label}
                </span>
              )}
            </div>
            {lead.isBookmarked && (
              <Bookmark className="size-4 shrink-0 fill-current text-amber-500" />
            )}
          </div>
          <div className="mt-1 text-base font-medium leading-snug">
            {displayAddress}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(lead.score)}`}
              data-testid="lead-score"
            >
              {lead.score}
            </span>
            <span className="text-xs text-muted-foreground">relevance</span>
          </div>
        </CardHeader>

        {lead.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {lead.description}
            </p>
          </CardContent>
        )}

        {lead.inferredEquipment.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1">
              {equipmentToShow.map((eq) => (
                <Badge key={eq.type} variant="outline" className="text-xs">
                  {eq.type}
                </Badge>
              ))}
              {overflowCount > 0 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{overflowCount} more
                </span>
              )}
            </div>
          </CardContent>
        )}

        <CardFooter className="text-xs text-muted-foreground gap-4">
          {lead.distance != null && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {Math.round(lead.distance)} mi away
            </span>
          )}
          {lead.permitDate && safeFormatDate(lead.permitDate) && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {safeFormatDate(lead.permitDate)}
            </span>
          )}
          {lead.applicantName && (
            <span className="flex items-center gap-1">
              <User className="size-3" />
              <span className="truncate max-w-[150px]">{lead.applicantName}</span>
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
