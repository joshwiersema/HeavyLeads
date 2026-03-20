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

  // Low-confidence: use keyword matching instead of flat +5
  if (industryMatch && isLowConfidence) {
    const keywordScore = scoreProjectTypeForIndustry(
      lead.projectType,
      org.industry,
      org.specializations
    );
    raw += keywordScore;
    if (keywordScore >= 12) {
      dim.reasons.push(`Project type likely relevant to ${org.industry}`);
    } else if (keywordScore >= 8) {
      dim.reasons.push("Possible match for your industry");
    } else {
      dim.reasons.push("Industry match uncertain");
    }
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

/**
 * Scores how well a projectType matches an industry via keyword analysis.
 * Used when industry classification is low-confidence (all 5 industries tagged).
 * Returns 0-15 to replace the flat +5 fallback.
 */
function scoreProjectTypeForIndustry(
  projectType: string | null,
  industry: string,
  specializations: string[]
): number {
  if (!projectType) return 3; // Unknown project type -> small baseline

  const pt = projectType.toLowerCase();

  const INDUSTRY_KEYWORDS: Record<string, { strong: string[]; weak: string[] }> = {
    heavy_equipment: {
      strong: ["demolition", "grading", "excavation", "foundation", "structural",
               "site work", "new construction", "paving", "concrete"],
      weak: ["commercial", "industrial", "multi-family", "renovation", "addition"],
    },
    hvac: {
      strong: ["hvac", "mechanical", "heating", "cooling", "air conditioning",
               "heat pump", "furnace", "boiler", "ductwork"],
      weak: ["commercial", "tenant improvement", "remodel", "new construction"],
    },
    roofing: {
      strong: ["roofing", "roof", "re-roof", "reroof", "shingle", "membrane",
               "tpo", "epdm", "flat roof", "metal roof"],
      weak: ["residential", "repair", "storm damage", "insurance", "waterproofing"],
    },
    solar: {
      strong: ["solar", "photovoltaic", "pv system", "renewable", "ev charging",
               "battery storage", "inverter"],
      weak: ["electrical", "residential", "commercial", "energy"],
    },
    electrical: {
      strong: ["electrical", "wiring", "panel upgrade", "service upgrade",
               "transformer", "switchgear", "circuit"],
      weak: ["commercial", "residential", "tenant improvement", "lighting"],
    },
  };

  const keywords = INDUSTRY_KEYWORDS[industry];
  if (!keywords) return 3;

  // Strong keyword match = 15
  if (keywords.strong.some(kw => pt.includes(kw))) return 15;

  // Specialization match = 12
  for (const spec of specializations) {
    if (pt.includes(spec.toLowerCase())) return 12;
  }

  // Weak keyword match = 8
  if (keywords.weak.some(kw => pt.includes(kw))) return 8;

  return 3; // No match
}
