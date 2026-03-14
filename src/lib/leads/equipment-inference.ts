import type { EquipmentType } from "@/types";
import type { InferredEquipment } from "./types";

/**
 * An inference rule that maps keywords (found in project type or description)
 * to a set of equipment categories and an optional construction phase.
 */
export interface InferenceRule {
  keywords: string[];
  equipment: EquipmentType[];
  phase?: string;
}

/**
 * Rules matched against projectType + description (case-insensitive).
 * Each rule contains keyword fragments that, when found, infer specific
 * equipment needs for the construction project.
 */
export const INFERENCE_RULES: InferenceRule[] = [
  {
    keywords: ["excavat", "earthwork", "grading", "site prep", "demolition", "trenching"],
    equipment: ["Excavators", "Bulldozers", "Compactors"],
    phase: "Site Preparation",
  },
  {
    keywords: ["foundation", "concrete", "footing", "slab"],
    equipment: ["Excavators", "Backhoes", "Compactors"],
    phase: "Foundation",
  },
  {
    keywords: ["framing", "structural", "steel", "erect"],
    equipment: ["Cranes", "Boom Lifts", "Forklifts"],
    phase: "Framing/Structural",
  },
  {
    keywords: ["roofing", "roof", "exterior", "facade", "siding"],
    equipment: ["Boom Lifts", "Aerial Work Platforms", "Cranes"],
    phase: "Exterior/Roofing",
  },
  {
    keywords: ["interior", "finish", "drywall", "painting", "hvac", "plumbing", "electrical"],
    equipment: ["Aerial Work Platforms", "Forklifts", "Telehandlers"],
    phase: "Interior Finishing",
  },
  {
    keywords: ["paving", "asphalt", "road", "parking"],
    equipment: ["Compactors", "Bulldozers", "Wheel Loaders"],
    phase: "Paving/Roadwork",
  },
  {
    keywords: ["landscap", "grade", "backfill"],
    equipment: ["Skid Steers", "Excavators", "Wheel Loaders"],
    phase: "Landscaping",
  },
  {
    keywords: ["commercial", "warehouse", "industrial", "office"],
    equipment: ["Cranes", "Boom Lifts", "Telehandlers", "Forklifts"],
    phase: "Commercial Construction",
  },
  {
    keywords: ["residential", "house", "dwelling", "apartment", "condo"],
    equipment: ["Excavators", "Skid Steers", "Telehandlers"],
    phase: "Residential Construction",
  },
  {
    keywords: ["generator", "power", "temporary"],
    equipment: ["Generators"],
  },
];

/** General Construction fallback equipment when no rules match. */
const FALLBACK_EQUIPMENT: EquipmentType[] = ["Excavators", "Forklifts", "Boom Lifts"];

/**
 * Infers equipment needs from a project's type and description using
 * keyword-based rules. Matches are case-insensitive.
 *
 * Confidence levels:
 * - "high": keyword matched in projectType field
 * - "medium": keyword matched in description field only
 * - "low": no rules matched, General Construction fallback applied
 *
 * Results are sorted by confidence (high first) and deduplicated by
 * equipment type, keeping the highest confidence entry.
 */
export function inferEquipmentNeeds(
  projectType: string | null,
  description: string | null
): InferredEquipment[] {
  const ptLower = (projectType ?? "").toLowerCase();
  const descLower = (description ?? "").toLowerCase();

  const results: InferredEquipment[] = [];

  for (const rule of INFERENCE_RULES) {
    for (const keyword of rule.keywords) {
      const inProjectType = ptLower.includes(keyword);
      const inDescription = descLower.includes(keyword);

      if (inProjectType || inDescription) {
        // Determine confidence: projectType match is "high", description-only is "medium"
        const confidence = inProjectType ? "high" : "medium";
        const source = inProjectType ? "projectType" : "description";

        for (const equipment of rule.equipment) {
          results.push({
            type: equipment,
            confidence,
            reason: `"${keyword}" found in ${source}`,
          });
        }

        // Only need one keyword to match per rule
        break;
      }
    }
  }

  // If no rules matched, use the General Construction fallback
  if (results.length === 0) {
    return FALLBACK_EQUIPMENT.map((type) => ({
      type,
      confidence: "low" as const,
      reason: "General Construction fallback (no specific keywords matched)",
    }));
  }

  // Deduplicate: keep the highest confidence per equipment type
  return deduplicateByHighestConfidence(results);
}

/**
 * Deduplicates equipment entries, keeping only the highest-confidence
 * entry per equipment type. Results are sorted by confidence: high, medium, low.
 */
function deduplicateByHighestConfidence(
  results: InferredEquipment[]
): InferredEquipment[] {
  const confidenceRank: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const bestByType = new Map<EquipmentType, InferredEquipment>();

  for (const entry of results) {
    const existing = bestByType.get(entry.type);
    if (
      !existing ||
      confidenceRank[entry.confidence] < confidenceRank[existing.confidence]
    ) {
      bestByType.set(entry.type, entry);
    }
  }

  return Array.from(bestByType.values()).sort(
    (a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence]
  );
}
