import type { ScoreDimension } from "./types";

/**
 * Scores how recently a lead was discovered.
 *
 * Tiers (max 15 pts):
 *   < 24h   = 15pts  "Discovered today"
 *   < 3d    = 12pts  "Discovered N days ago"
 *   < 7d    = 9pts
 *   < 14d   = 6pts
 *   < 30d   = 3pts
 *   >= 30d  = 0pts   "Over 30 days old"
 */
export function scoreFreshness(scrapedAt: Date): ScoreDimension {
  const dim: ScoreDimension = {
    name: "freshness",
    score: 0,
    maxScore: 15,
    reasons: [],
  };

  const now = new Date();
  const diffMs = now.getTime() - scrapedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) {
    dim.score = 15;
    dim.reasons.push("Discovered today");
  } else if (diffDays < 3) {
    dim.score = 12;
    dim.reasons.push(`Discovered ${Math.floor(diffDays)} days ago`);
  } else if (diffDays < 7) {
    dim.score = 9;
    dim.reasons.push(`Discovered ${Math.floor(diffDays)} days ago`);
  } else if (diffDays < 14) {
    dim.score = 6;
    dim.reasons.push(`Discovered ${Math.floor(diffDays)} days ago`);
  } else if (diffDays < 30) {
    dim.score = 3;
    dim.reasons.push(`Discovered ${Math.floor(diffDays)} days ago`);
  } else {
    dim.score = 0;
    dim.reasons.push("Over 30 days old");
  }

  return dim;
}
