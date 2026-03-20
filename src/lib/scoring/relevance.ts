import type { LeadScoringInput, OrgScoringContext, ScoreDimension } from "./types";

/**
 * Maps lead source types to the human-readable lead type names used in
 * org.preferredLeadTypes (from onboarding config).
 */
const SOURCE_TYPE_TO_LEAD_TYPE: Record<string, string> = {
  permit: "Building Permits",
  bid: "Bid Boards",
  news: "News & Press",
  government: "Government Contracts",
  storm: "Storm Alerts",
  violation: "Code Violations",
  incentive: "Incentive Programs",
  utility: "Utility Rate Changes",
  insurance: "Insurance Claims",
  ev: "EV Infrastructure",
  benchmarking: "Energy Benchmarking",
};

/**
 * Scores how relevant a lead is to the subscriber's industry and specializations.
 *
 * Signals (max 30 pts, clamped):
 *   +15  projectType matches a specialization (case-insensitive partial)
 *   +10  org.industry is in applicableIndustries
 *   +5   cross-industry opportunity (has industries, but org not in them)
 *   +5   sourceType maps to a preferred lead type
 *   -10  outside specializations (industries listed, no industry or spec match)
 */
export function scoreRelevance(
  lead: LeadScoringInput,
  org: OrgScoringContext
): ScoreDimension {
  const dim: ScoreDimension = {
    name: "relevance",
    score: 0,
    maxScore: 30,
    reasons: [],
  };

  let raw = 0;
  const projectLower = (lead.projectType ?? "").toLowerCase();
  const hasIndustries = lead.applicableIndustries.length > 0;
  const industryMatch = hasIndustries && lead.applicableIndustries.includes(org.industry);

  // Detect low-confidence classification: when ALL 5 industries are tagged,
  // the enrichment had no keyword matches and defaulted to "applicable to all"
  const ALL_INDUSTRY_COUNT = 5;
  const isLowConfidence = lead.applicableIndustries.length >= ALL_INDUSTRY_COUNT;

  // +15 specialization match (case-insensitive partial -- handles plurals)
  let specMatched = false;
  for (const spec of org.specializations) {
    const specLower = spec.toLowerCase();
    // Check both directions and handle trailing 's' for singular/plural
    const specStem = specLower.endsWith("s") ? specLower.slice(0, -1) : specLower;
    const projectStem = projectLower.endsWith("s") ? projectLower.slice(0, -1) : projectLower;
    if (
      projectLower &&
      (projectLower.includes(specLower) ||
        specLower.includes(projectLower) ||
        projectLower.includes(specStem) ||
        projectStem.includes(specLower))
    ) {
      raw += 15;
      dim.reasons.push(`Matches your ${spec} specialization`);
      specMatched = true;
      break; // only award once
    }
  }

  // +10 industry match (high confidence only)
  if (industryMatch && !isLowConfidence) {
    raw += 10;
    dim.reasons.push(`Relevant to ${org.industry} industry`);
  }

  // +5 low-confidence match: industry is technically included but inference was uncertain
  if (industryMatch && isLowConfidence) {
    raw += 5;
    dim.reasons.push("Industry match uncertain");
  }

  // +5 cross-industry opportunity (only when high confidence and org not matched)
  if (hasIndustries && !industryMatch && !isLowConfidence) {
    raw += 5;
    dim.reasons.push("Cross-industry opportunity");
  }

  // +5 preferred lead type
  const leadTypeName = SOURCE_TYPE_TO_LEAD_TYPE[lead.sourceType];
  if (leadTypeName && org.preferredLeadTypes.includes(leadTypeName)) {
    raw += 5;
    dim.reasons.push(`From your preferred ${leadTypeName} sources`);
  }

  // -10 outside specializations: only apply when high confidence that
  // the lead belongs to OTHER industries (not low-confidence defaults)
  if (hasIndustries && !industryMatch && !specMatched && !isLowConfidence) {
    raw -= 10;
    dim.reasons.push("Outside your specializations");
  }

  dim.score = Math.max(0, Math.min(30, raw));
  return dim;
}
