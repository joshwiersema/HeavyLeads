"use client";

import { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import type { StormAlert } from "@/lib/storm-alerts/types";

/** Severity ranking for sorting (higher = more severe) */
const SEVERITY_RANK: Record<string, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
};

function getSeverityRank(severity: string | null): number {
  return SEVERITY_RANK[severity ?? ""] ?? 0;
}

function getSeverityBadgeClasses(severity: string | null): string {
  switch (severity) {
    case "Extreme":
      return "bg-red-100 text-red-800";
    case "Severe":
      return "bg-orange-100 text-orange-800";
    case "Moderate":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatTimeRemaining(expiresAt: Date | null): string {
  if (!expiresAt) return "";
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `Expires in ${hours}h ${minutes}m`;
  }
  return `Expires in ${minutes}m`;
}

interface StormAlertBannerProps {
  alerts: StormAlert[];
}

export function StormAlertBanner({ alerts }: StormAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0 || dismissed) {
    return null;
  }

  // Find the most severe alert
  const sortedBySeverity = [...alerts].sort(
    (a, b) => getSeverityRank(b.severity) - getSeverityRank(a.severity)
  );
  const mostSevere = sortedBySeverity[0];

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {alerts.length} active storm alert
              {alerts.length !== 1 ? "s" : ""} in your area
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Most severe: {mostSevere.title}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-amber-600 hover:bg-amber-100"
            aria-label={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-amber-600 hover:bg-amber-100"
            aria-label="Dismiss storm alerts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          {sortedBySeverity.map((alert) => (
            <div key={alert.id} className="flex items-start gap-2 text-sm">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${getSeverityBadgeClasses(alert.severity)}`}
              >
                {alert.severity ?? "Unknown"}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{alert.title}</span>
                {alert.city && alert.state && (
                  <span className="ml-1 text-amber-700">
                    ({alert.city}, {alert.state})
                  </span>
                )}
                {alert.expiresAt && (
                  <span className="ml-2 text-xs text-amber-600">
                    {formatTimeRemaining(alert.expiresAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
