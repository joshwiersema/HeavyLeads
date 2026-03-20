import type { ScoreDimension } from "./types";

/**
 * Source-type-specific freshness curves.
 * Each entry defines day thresholds and their corresponding scores.
 * Thresholds are checked in order (first match wins).
 *
 * Storm alerts: urgency measured in hours (decay fast)
 * Bids: urgency measured in days (deadline-driven)
 * Permits/default: urgency measured in weeks (long lifecycle)
 */
const FRESHNESS_CURVES: Record<string, Array<{ maxDays: number; score: number; label: string }>> = {
  storm: [
    { maxDays: 0.25, score: 15, label: "Just issued" },
    { maxDays: 0.5, score: 13, label: "Issued hours ago" },
    { maxDays: 1, score: 9, label: "Issued yesterday" },
    { maxDays: 2, score: 6, label: "Issued 2 days ago" },
    { maxDays: 3, score: 3, label: "Storm alert aging" },
  ],
  bid: [
    { maxDays: 1, score: 15, label: "Posted today" },
    { maxDays: 3, score: 13, label: "Posted recently" },
    { maxDays: 7, score: 9, label: "Posted this week" },
    { maxDays: 14, score: 6, label: "Posted 2 weeks ago" },
    { maxDays: 21, score: 3, label: "Bid aging" },
  ],
  default: [
    { maxDays: 1, score: 15, label: "Discovered today" },
    { maxDays: 3, score: 13, label: "Discovered recently" },
    { maxDays: 7, score: 12, label: "Discovered this week" },
    { maxDays: 14, score: 9, label: "About 2 weeks old" },
    { maxDays: 21, score: 6, label: "About 3 weeks old" },
    { maxDays: 30, score: 3, label: "About a month old" },
  ],
};

/**
 * Scores how recently a lead was discovered, using source-type-specific
 * decay curves. Storm alerts decay in hours, bids in days, permits in weeks.
 *
 * @param scrapedAt  - When the lead was discovered
 * @param sourceType - The lead's source type (storm, bid, permit, etc.)
 * @returns ScoreDimension with max 15 pts
 */
export function scoreFreshness(scrapedAt: Date, sourceType: string): ScoreDimension {
  const dim: ScoreDimension = {
    name: "freshness",
    score: 0,
    maxScore: 15,
    reasons: [],
  };

  const now = new Date();
  const diffMs = now.getTime() - scrapedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const curve = FRESHNESS_CURVES[sourceType] ?? FRESHNESS_CURVES["default"];

  for (const tier of curve) {
    if (diffDays < tier.maxDays) {
      dim.score = tier.score;
      dim.reasons.push(tier.label);
      return dim;
    }
  }

  // Beyond all tiers
  dim.score = 0;
  dim.reasons.push(sourceType === "storm" ? "Storm alert expired" : "Over 30 days old");
  return dim;
}
