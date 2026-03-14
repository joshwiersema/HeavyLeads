import type { ScoringInput } from "./types";

/**
 * Scores a lead's relevance to a dealer on a 0-100 scale.
 *
 * Weighting:
 * - Equipment match: 50 points max (ratio of inferred equipment matching dealer types)
 * - Geographic proximity: 30 points max (linear decay within service radius)
 * - Project value: 20 points max (logarithmic scale, $1M+ = max)
 *
 * Returns a clamped integer 0-100.
 */
export function scoreLead(input: ScoringInput): number {
  // Equipment match: 50 points max
  let equipmentScore = 0;
  if (input.inferredEquipment.length > 0) {
    const matchCount = input.inferredEquipment.filter((e) =>
      input.dealerEquipment.includes(e)
    ).length;
    equipmentScore = (matchCount / input.inferredEquipment.length) * 50;
  }

  // Geographic proximity: 30 points max (linear decay within service radius)
  let geoScore = 0;
  if (input.distanceMiles <= input.serviceRadiusMiles) {
    geoScore = (1 - input.distanceMiles / input.serviceRadiusMiles) * 30;
  }

  // Project value: 20 points max (logarithmic scale, capped)
  let valueScore = 0;
  if (input.estimatedValue && input.estimatedValue > 0) {
    // log10(1,000,000) = 6 -> full 20 points
    valueScore = Math.min(20, (Math.log10(input.estimatedValue) / 6) * 20);
  }

  const total = equipmentScore + geoScore + valueScore;
  return Math.round(Math.min(100, Math.max(0, total)));
}
