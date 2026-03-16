import type { ScoreDimension } from "./types";

/**
 * Scores a lead's geographic proximity to the subscriber's HQ.
 *
 * Tiers (max 25 pts):
 *   <= 10mi  = 25pts
 *   <= 25mi  = 20pts
 *   <= 50mi  = 15pts
 *   <= radius = 10pts
 *   <= 1.5x  = 5pts
 *   > 1.5x   = 0pts
 *   null     = 0pts (location unknown)
 */
export function scoreDistance(
  distanceMiles: number | null,
  serviceRadiusMiles: number
): ScoreDimension {
  const dim: ScoreDimension = {
    name: "distance",
    score: 0,
    maxScore: 25,
    reasons: [],
  };

  if (distanceMiles == null) {
    dim.reasons.push("Location unknown");
    return dim;
  }

  const rounded = Math.round(distanceMiles);

  if (distanceMiles <= 10) {
    dim.score = 25;
    dim.reasons.push(`${rounded} miles from your HQ`);
  } else if (distanceMiles <= 25) {
    dim.score = 20;
    dim.reasons.push(`${rounded} miles from your HQ`);
  } else if (distanceMiles <= 50) {
    dim.score = 15;
    dim.reasons.push(`${rounded} miles from your HQ`);
  } else if (distanceMiles <= serviceRadiusMiles) {
    dim.score = 10;
    dim.reasons.push(`${rounded} miles from your HQ`);
  } else if (distanceMiles <= serviceRadiusMiles * 1.5) {
    dim.score = 5;
    dim.reasons.push(
      `Just outside your ${serviceRadiusMiles}-mile service area`
    );
  } else {
    dim.score = 0;
    dim.reasons.push("Outside your service area");
  }

  return dim;
}
