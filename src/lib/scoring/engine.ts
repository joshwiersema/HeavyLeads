import type { LeadScoringInput, OrgScoringContext, ScoringResult } from "./types";
import { scoreDistance } from "./distance";
import { scoreRelevance } from "./relevance";
import { scoreValue } from "./value";
import { scoreFreshness } from "./freshness";
import { scoreUrgency } from "./urgency";

/**
 * Scores a single lead against an organization's context across 5 dimensions:
 *   1. Distance (25 pts max)
 *   2. Relevance (30 pts max)
 *   3. Value (20 pts max)
 *   4. Freshness (15 pts max)
 *   5. Urgency (10 pts max)
 *
 * Total is clamped to 0-100. Match reasons are collected from all dimensions
 * for human-readable display.
 *
 * @param lead       - The lead data to score
 * @param org        - The subscriber's organization context
 * @param distanceMiles - Pre-computed haversine distance (null if no coords)
 * @returns ScoringResult with total, dimensions, and matchReasons
 */
export function scoreLeadForOrg(
  lead: LeadScoringInput,
  org: OrgScoringContext,
  distanceMiles: number | null
): ScoringResult {
  const dimensions = [
    scoreDistance(distanceMiles, org.serviceRadiusMiles),
    scoreRelevance(lead, org),
    scoreValue(lead, org),
    scoreFreshness(lead.scrapedAt),
    scoreUrgency(lead),
  ];

  const rawTotal = dimensions.reduce((sum, d) => sum + d.score, 0);
  const total = Math.max(0, Math.min(100, rawTotal));

  // Collect all non-empty reasons into a flat array
  const matchReasons = dimensions.flatMap((d) => d.reasons);

  return { total, dimensions, matchReasons };
}
