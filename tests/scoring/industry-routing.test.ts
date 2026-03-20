import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scoreLeadForOrg } from "@/lib/scoring/engine";
import type { LeadScoringInput, OrgScoringContext } from "@/lib/scoring/types";
import type { Industry } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Creates an org fixture for a given industry. All orgs share the same
 * geographic position so distance is constant and only
 * relevance/value/freshness vary.
 */
function makeOrg(
  industry: Industry,
  specializations: string[]
): OrgScoringContext {
  return {
    industry,
    hqLat: 32.78,
    hqLng: -96.8,
    serviceRadiusMiles: 50,
    specializations,
    preferredLeadTypes: ["Building Permits"],
    targetProjectValueMin: 5000,
    targetProjectValueMax: 500000,
  };
}

const ORGS: Record<string, OrgScoringContext> = {
  hvac: makeOrg("hvac", ["Heat Pumps", "Commercial HVAC", "Ductwork"]),
  roofing: makeOrg("roofing", [
    "Asphalt Shingles",
    "Metal Roofs",
    "Flat Roofs",
  ]),
  solar: makeOrg("solar", ["Solar Panels", "Battery Storage", "EV Charging"]),
  electrical: makeOrg("electrical", [
    "Panel Upgrades",
    "Wiring",
    "Lighting",
  ]),
  heavy_equipment: makeOrg("heavy_equipment", [
    "Excavation",
    "Grading",
    "Demolition",
  ]),
};

const ALL_ORG_KEYS = Object.keys(ORGS);

/**
 * Creates a lead that is clearly tagged for a specific industry.
 */
function makeIndustryLead(
  projectType: string,
  industries: string[],
  valueTier: string
): LeadScoringInput {
  return {
    lat: 32.79,
    lng: -96.79,
    projectType,
    sourceType: "permit",
    applicableIndustries: industries,
    estimatedValue: null,
    valueTier,
    severity: null,
    deadline: null,
    scrapedAt: new Date(), // Fresh -- same for all
  };
}

// ---------------------------------------------------------------------------
// Industry routing specs
// ---------------------------------------------------------------------------

const INDUSTRY_LEADS: Record<
  string,
  { projectType: string; industries: string[]; valueTier: string }
> = {
  hvac: {
    projectType: "HVAC Installation",
    industries: ["hvac"],
    valueTier: "low",
  },
  roofing: {
    projectType: "Roof Replacement",
    industries: ["roofing"],
    valueTier: "low",
  },
  solar: {
    projectType: "Solar Panel Installation",
    industries: ["solar"],
    valueTier: "low",
  },
  electrical: {
    projectType: "Panel Upgrade",
    industries: ["electrical"],
    valueTier: "low",
  },
  heavy_equipment: {
    projectType: "New Commercial Construction - Demolition",
    industries: ["heavy_equipment"],
    valueTier: "high",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Industry routing verification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Per-industry: lead scores highest for its matching org
  // -----------------------------------------------------------------------

  for (const [industry, spec] of Object.entries(INDUSTRY_LEADS)) {
    it(`${industry} lead scores highest for ${industry} org`, () => {
      const lead = makeIndustryLead(
        spec.projectType,
        spec.industries,
        spec.valueTier
      );

      // Use a small constant distance for all orgs (same location)
      const DISTANCE = 2; // 2 miles

      const scores: Record<string, number> = {};
      for (const orgKey of ALL_ORG_KEYS) {
        scores[orgKey] = scoreLeadForOrg(lead, ORGS[orgKey], DISTANCE).total;
      }

      // The matching org must have the strictly highest score
      const matchingScore = scores[industry];
      for (const orgKey of ALL_ORG_KEYS) {
        if (orgKey !== industry) {
          expect(
            matchingScore,
            `Expected ${industry} org (${matchingScore}) to score higher than ${orgKey} org (${scores[orgKey]}) for ${spec.projectType}`
          ).toBeGreaterThan(scores[orgKey]);
        }
      }
    });
  }

  // -----------------------------------------------------------------------
  // Low-confidence lead with HVAC projectType still routes correctly
  // -----------------------------------------------------------------------

  it("low-confidence lead with HVAC projectType routes to HVAC over roofing", () => {
    const lead = makeIndustryLead("HVAC Installation", [
      "heavy_equipment",
      "hvac",
      "roofing",
      "solar",
      "electrical",
    ], "low");

    const DISTANCE = 2;

    const hvacScore = scoreLeadForOrg(lead, ORGS["hvac"], DISTANCE).total;
    const roofingScore = scoreLeadForOrg(
      lead,
      ORGS["roofing"],
      DISTANCE
    ).total;

    expect(
      hvacScore,
      `HVAC org (${hvacScore}) should score higher than roofing org (${roofingScore}) for an HVAC-named low-confidence lead`
    ).toBeGreaterThan(roofingScore);
  });

  // -----------------------------------------------------------------------
  // Minimum differentiation: >= 10 point difference
  // -----------------------------------------------------------------------

  it("score difference between matching and non-matching industry is >= 10 points", () => {
    // Use HVAC lead against HVAC org vs roofing org
    const lead = makeIndustryLead("HVAC Installation", ["hvac"], "low");
    const DISTANCE = 2;

    const hvacScore = scoreLeadForOrg(lead, ORGS["hvac"], DISTANCE).total;
    const roofingScore = scoreLeadForOrg(
      lead,
      ORGS["roofing"],
      DISTANCE
    ).total;

    const difference = hvacScore - roofingScore;
    expect(
      difference,
      `Expected >= 10 point difference, got ${difference} (HVAC: ${hvacScore}, Roofing: ${roofingScore})`
    ).toBeGreaterThanOrEqual(10);
  });
});
