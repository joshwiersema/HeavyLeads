import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { eq, sql, isNull, or } from "drizzle-orm";

// Industry keyword patterns
const INDUSTRY_PATTERNS: Record<string, RegExp> = {
  hvac: /hvac|heating|cooling|air.condition|mechanical/i,
  roofing: /roof|shingle|waterproof|membrane/i,
  solar: /solar|photovoltaic|pv.system|renewable/i,
  electrical: /electric|wiring|panel|transformer|ev.charg/i,
  heavy_equipment: /excavat|crane|loader|dozer|grading|demolit|heavy/i,
};

export function inferApplicableIndustries(lead: {
  title?: string | null;
  description?: string | null;
  projectType?: string | null;
  sourceType: string;
}): string[] {
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

  // Default: permit sources with no keyword matches default to heavy_equipment
  if (matches.length === 0 && lead.sourceType === "permit") {
    return ["heavy_equipment"];
  }

  return matches;
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
