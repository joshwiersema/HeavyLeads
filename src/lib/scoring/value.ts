import type { LeadScoringInput, OrgScoringContext, ScoreDimension } from "./types";

/**
 * Scores how well a lead's estimated value matches the subscriber's target range.
 *
 * Tiers (max 20 pts):
 *   Within target range          = 20pts
 *   Above target max             = 15pts
 *   Below 50% of target min      = 5pts
 *   Below 25% of target min      = 0pts (well below)
 *   Unknown value (null/null)    = 10pts
 *   No target range configured   = 10pts
 */
export function scoreValue(
  lead: LeadScoringInput,
  org: OrgScoringContext
): ScoreDimension {
  const dim: ScoreDimension = {
    name: "value",
    score: 0,
    maxScore: 20,
    reasons: [],
  };

  const value = lead.estimatedValue;
  const hasTarget =
    org.targetProjectValueMin != null || org.targetProjectValueMax != null;

  // No target range configured -- any value gets a baseline
  if (!hasTarget) {
    dim.score = 10;
    dim.reasons.push("No target range set");
    return dim;
  }

  // Unknown value
  if (value == null && lead.valueTier == null) {
    dim.score = 10;
    dim.reasons.push("Value unknown");
    return dim;
  }

  const min = org.targetProjectValueMin ?? 0;
  const max = org.targetProjectValueMax ?? Infinity;
  const effectiveValue = value ?? 0;

  if (effectiveValue >= min && effectiveValue <= max) {
    dim.score = 20;
    const fmtMin = min.toLocaleString();
    const fmtMax = max === Infinity ? "+" : max.toLocaleString();
    dim.reasons.push(`Within your $${fmtMin}-$${fmtMax} target range`);
  } else if (effectiveValue > max) {
    dim.score = 15;
    dim.reasons.push("Above your target range");
  } else if (effectiveValue < min * 0.25) {
    dim.score = 0;
    dim.reasons.push("Well below target range");
  } else if (effectiveValue < min * 0.5) {
    dim.score = 5;
    dim.reasons.push("Below your target range");
  } else {
    // Between 50% and 100% of min -- slightly below
    dim.score = 10;
    dim.reasons.push("Slightly below your target range");
  }

  return dim;
}
