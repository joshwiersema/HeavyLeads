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

export function inferValueTier(estimatedValue: number | null): string | null {
  if (estimatedValue === null || estimatedValue === undefined) return null;
  if (estimatedValue < 50000) return "low";
  if (estimatedValue <= 500000) return "medium";
  return "high";
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
    const valueTier = inferValueTier(lead.estimatedValue);

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
