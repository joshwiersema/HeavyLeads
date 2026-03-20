import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { eq, sql, isNull, or } from "drizzle-orm";

// Comprehensive industry keyword patterns
const INDUSTRY_PATTERNS: Record<string, RegExp> = {
  hvac: /\b(hvac|heating|cooling|air.?condition|mechanical|furnace|boiler|chiller|ductwork|thermostat|heat.?pump|refrigerant|ventilat|mini.?split|vrf|rtu|rooftop.?unit|condensing|air.?handler)\b/i,
  roofing: /\b(roof|shingle|waterproof|membrane|tpo|pvc|epdm|standing.?seam|gutter|flashing|fascia|soffit|re.?roof|tear.?off|metal.?roof|flat.?roof|tile.?roof|slate|built.?up.?roof|roofing)\b/i,
  solar: /\b(solar|photovoltaic|pv.?system|renewable|inverter|battery.?storage|net.?meter|micro.?inverter|solar.?panel|ev.?charg|racking|photovoltaics|green.?energy|clean.?energy)\b/i,
  electrical: /\b(electric|wiring|panel.?upgrade|transformer|circuit.?breaker|switchgear|conduit|lighting|outlet|receptacle|generator|power.?distribution|substation|voltage|amperage|electrical.?panel|rewir|meter.?base|load.?center|service.?entrance)\b/i,
  heavy_equipment: /\b(excavat|crane|loader|dozer|grading|demolit|heavy.?equip|bulldozer|backhoe|skid.?steer|forklift|telehandler|compactor|boom.?lift|aerial.?work|pile.?driv|earth.?mov|trenching|site.?work|land.?clear|paving|asphalt|concrete.?pour|foundation|structural.?steel|framing)\b/i,
};

/** All supported industry keys */
const ALL_INDUSTRIES = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];

export interface IndustryInference {
  industries: string[];
  /** Whether the inference was based on keyword matches (high) or defaulted (low) */
  confidence: "high" | "low";
}

/**
 * Infers which industries a lead is applicable to based on keyword analysis
 * of its title, description, and projectType.
 *
 * When no keywords match, returns ALL industries with low confidence
 * (the lead could be relevant to anyone) rather than defaulting to a
 * single industry.
 */
export function inferApplicableIndustries(lead: {
  title?: string | null;
  description?: string | null;
  projectType?: string | null;
  sourceType: string;
}): string[] {
  const result = inferApplicableIndustriesWithConfidence(lead);
  return result.industries;
}

/**
 * Same as inferApplicableIndustries but also returns confidence level.
 * Used by the scoring engine to avoid penalizing leads with uncertain
 * industry classification.
 */
export function inferApplicableIndustriesWithConfidence(lead: {
  title?: string | null;
  description?: string | null;
  projectType?: string | null;
  sourceType: string;
}): IndustryInference {
  const text = [lead.title, lead.description, lead.projectType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matches: string[] = [];
  for (const [industry, pattern] of Object.entries(INDUSTRY_PATTERNS)) {
    if (pattern.test(text)) {
      matches.push(industry);
    }
  }

  if (matches.length > 0) {
    return { industries: matches, confidence: "high" };
  }

  // No keyword matches -- applicable to all industries with low confidence
  return { industries: [...ALL_INDUSTRIES], confidence: "low" };
}

/**
 * Maps projectType keywords (lowercase) to estimated value ranges and tiers.
 * Used to derive valueTier when estimatedValue is null.
 */
export const PROJECT_TYPE_VALUE_MAP: Record<string, { min: number; max: number; tier: string }> = {
  "new commercial": { min: 500_000, max: 5_000_000, tier: "high" },
  "commercial construction": { min: 500_000, max: 5_000_000, tier: "high" },
  "commercial building": { min: 500_000, max: 5_000_000, tier: "high" },
  "new residential": { min: 150_000, max: 500_000, tier: "medium" },
  "residential construction": { min: 150_000, max: 500_000, tier: "medium" },
  "commercial remodel": { min: 100_000, max: 1_000_000, tier: "high" },
  "commercial renovation": { min: 100_000, max: 1_000_000, tier: "high" },
  "tenant improvement": { min: 50_000, max: 500_000, tier: "medium" },
  "residential remodel": { min: 20_000, max: 100_000, tier: "low" },
  "residential renovation": { min: 20_000, max: 100_000, tier: "low" },
  "residential alteration": { min: 20_000, max: 100_000, tier: "low" },
  "demolition": { min: 50_000, max: 500_000, tier: "medium" },
  "roofing": { min: 5_000, max: 50_000, tier: "low" },
  "roof replacement": { min: 5_000, max: 50_000, tier: "low" },
  "re-roof": { min: 5_000, max: 50_000, tier: "low" },
  "hvac": { min: 3_000, max: 30_000, tier: "low" },
  "hvac installation": { min: 3_000, max: 30_000, tier: "low" },
  "mechanical": { min: 3_000, max: 30_000, tier: "low" },
  "electrical": { min: 2_000, max: 20_000, tier: "low" },
  "electrical upgrade": { min: 5_000, max: 50_000, tier: "low" },
  "panel upgrade": { min: 2_000, max: 20_000, tier: "low" },
  "solar": { min: 10_000, max: 50_000, tier: "low" },
  "solar installation": { min: 10_000, max: 50_000, tier: "low" },
  "photovoltaic": { min: 10_000, max: 50_000, tier: "low" },
  "pool": { min: 30_000, max: 100_000, tier: "medium" },
  "pool construction": { min: 30_000, max: 100_000, tier: "medium" },
  "foundation": { min: 10_000, max: 50_000, tier: "low" },
  "foundation repair": { min: 10_000, max: 50_000, tier: "low" },
  "plumbing": { min: 2_000, max: 15_000, tier: "low" },
  "addition": { min: 50_000, max: 300_000, tier: "medium" },
  "multi-family": { min: 500_000, max: 5_000_000, tier: "high" },
  "mixed use": { min: 500_000, max: 5_000_000, tier: "high" },
  "industrial": { min: 500_000, max: 10_000_000, tier: "high" },
};

export function inferValueTier(estimatedValue: number | null, projectType?: string | null): string | null {
  // When estimatedValue is provided, use existing tier logic
  if (estimatedValue !== null && estimatedValue !== undefined) {
    if (estimatedValue < 50000) return "low";
    if (estimatedValue <= 500000) return "medium";
    return "high";
  }

  // When estimatedValue is null, try to derive tier from projectType
  if (projectType) {
    const pt = projectType.toLowerCase();
    for (const [key, entry] of Object.entries(PROJECT_TYPE_VALUE_MAP)) {
      if (pt.includes(key)) {
        return entry.tier;
      }
    }
  }

  return null;
}

export async function enrichLeads(): Promise<{ enriched: number }> {
  // Query leads where applicableIndustries is empty or null
  const unenriched = await db
    .select({
      id: leads.id,
      title: leads.title,
      description: leads.description,
      projectType: leads.projectType,
      sourceType: leads.sourceType,
      estimatedValue: leads.estimatedValue,
    })
    .from(leads)
    .where(
      or(
        sql`${leads.applicableIndustries} = '{}'`,
        isNull(leads.applicableIndustries)
      )
    )
    .limit(500);

  let enriched = 0;
  for (const lead of unenriched) {
    const applicableIndustries = inferApplicableIndustries(lead);
    const valueTier = inferValueTier(lead.estimatedValue, lead.projectType);

    await db
      .update(leads)
      .set({
        applicableIndustries,
        ...(valueTier !== null ? { valueTier } : {}),
      })
      .where(eq(leads.id, lead.id));

    enriched++;
  }

  return { enriched };
}
