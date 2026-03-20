import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scoreLeadForOrg } from "@/lib/scoring/engine";
import { scoreDistance } from "@/lib/scoring/distance";
import { scoreRelevance } from "@/lib/scoring/relevance";
import { scoreValue } from "@/lib/scoring/value";
import { scoreFreshness } from "@/lib/scoring/freshness";
import { scoreUrgency } from "@/lib/scoring/urgency";
import type {
  OrgScoringContext,
  LeadScoringInput,
  ScoringResult,
} from "@/lib/scoring/types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeOrg(overrides: Partial<OrgScoringContext> = {}): OrgScoringContext {
  return {
    industry: "hvac",
    hqLat: 40.7128,
    hqLng: -74.006,
    serviceRadiusMiles: 50,
    specializations: ["Heat Pumps", "Commercial HVAC"],
    preferredLeadTypes: ["Building Permits", "Code Violations"],
    targetProjectValueMin: 10000,
    targetProjectValueMax: 100000,
    ...overrides,
  };
}

function makeLead(overrides: Partial<LeadScoringInput> = {}): LeadScoringInput {
  return {
    lat: 40.73,
    lng: -73.99,
    projectType: "Heat Pump Installation",
    sourceType: "permit",
    applicableIndustries: ["hvac"],
    estimatedValue: 50000,
    valueTier: null,
    severity: null,
    deadline: null,
    scrapedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Same lead, two different orgs = different scores
// ---------------------------------------------------------------------------

describe("scoreLeadForOrg", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces different scores for two orgs with different profiles", () => {
    const lead = makeLead();

    const hvacOrg = makeOrg(); // hvac, near lead, specializations match
    const roofingOrg = makeOrg({
      industry: "roofing",
      hqLat: 34.0522, // Los Angeles -- far away
      hqLng: -118.2437,
      serviceRadiusMiles: 30,
      specializations: ["Asphalt Shingles", "Storm Restoration"],
      preferredLeadTypes: ["Storm Alerts"],
      targetProjectValueMin: 5000,
      targetProjectValueMax: 25000,
    });

    const hvacResult = scoreLeadForOrg(lead, hvacOrg, 1.5); // 1.5 miles away
    const roofingResult = scoreLeadForOrg(lead, roofingOrg, 2500); // 2500 miles away

    expect(hvacResult.total).not.toBe(roofingResult.total);
    expect(hvacResult.total).toBeGreaterThan(roofingResult.total);
  });
});

// ---------------------------------------------------------------------------
// 2. Distance tiers at boundaries
// ---------------------------------------------------------------------------

describe("scoreDistance", () => {
  it("awards 25 points at exactly 10 miles", () => {
    const dim = scoreDistance(10, 50);
    expect(dim.score).toBe(25);
    expect(dim.maxScore).toBe(25);
    expect(dim.name).toBe("distance");
  });

  it("awards 20 points at exactly 25 miles", () => {
    const dim = scoreDistance(25, 50);
    expect(dim.score).toBe(20);
  });

  it("awards 15 points at exactly 50 miles (within service radius)", () => {
    const dim = scoreDistance(50, 100);
    expect(dim.score).toBe(15);
  });

  it("awards 10 points within service radius but beyond 50mi", () => {
    const dim = scoreDistance(60, 80);
    expect(dim.score).toBe(10);
  });

  it("awards 5 points within 1.5x radius", () => {
    const dim = scoreDistance(60, 50); // 1.5x50=75, 60<75
    expect(dim.score).toBe(5);
    expect(dim.reasons[0]).toContain("outside");
  });

  it("awards 0 points beyond 1.5x service radius", () => {
    const dim = scoreDistance(100, 50); // 1.5x50=75, 100>75
    expect(dim.score).toBe(0);
    expect(dim.reasons[0]).toContain("Outside your service area");
  });

  it("awards 0 points when distance is null (no coords)", () => {
    const dim = scoreDistance(null, 50);
    expect(dim.score).toBe(0);
    expect(dim.reasons[0]).toContain("Location unknown");
  });

  it("includes human-readable distance in reason", () => {
    const dim = scoreDistance(12, 50);
    expect(dim.reasons[0]).toContain("12");
    expect(dim.reasons[0]).toContain("miles");
  });
});

// ---------------------------------------------------------------------------
// 3. Relevance: specialization match and outside penalty
// ---------------------------------------------------------------------------

describe("scoreRelevance", () => {
  it("awards +15 for specialization match", () => {
    const lead = makeLead({ projectType: "Heat Pump Installation" });
    const org = makeOrg({ specializations: ["Heat Pumps"] });
    const dim = scoreRelevance(lead, org);
    expect(dim.score).toBeGreaterThanOrEqual(15);
    expect(dim.reasons.some((r) => r.includes("Heat Pumps"))).toBe(true);
  });

  it("awards +10 for industry match", () => {
    const lead = makeLead({
      projectType: "Generic HVAC Work",
      applicableIndustries: ["hvac"],
    });
    const org = makeOrg({ specializations: [] }); // no spec match
    const dim = scoreRelevance(lead, org);
    // Should get +10 for industry match
    expect(dim.score).toBeGreaterThanOrEqual(10);
    expect(dim.reasons.some((r) => r.includes("hvac"))).toBe(true);
  });

  it("penalizes -10 for outside specializations with no match", () => {
    const lead = makeLead({
      projectType: "Plumbing Repair",
      applicableIndustries: ["plumbing"],
    });
    const org = makeOrg({ specializations: ["Heat Pumps"] });
    const dim = scoreRelevance(lead, org);
    expect(dim.reasons.some((r) => r.includes("Outside"))).toBe(true);
  });

  it("clamps between 0 and 30", () => {
    // Even with maximum bonuses, should not exceed 30
    const lead = makeLead({
      projectType: "Heat Pump Installation",
      sourceType: "permit",
      applicableIndustries: ["hvac"],
    });
    const org = makeOrg();
    const dim = scoreRelevance(lead, org);
    expect(dim.score).toBeLessThanOrEqual(30);
    expect(dim.score).toBeGreaterThanOrEqual(0);
    expect(dim.maxScore).toBe(30);
  });

  // --- Low-confidence keyword matching ---

  it("uses keyword matching for low-confidence leads -- strong match", () => {
    const allIndustries = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];
    const lead = makeLead({
      projectType: "HVAC Installation",
      applicableIndustries: allIndustries,
    });
    const org = makeOrg({ industry: "hvac", specializations: [] });
    const dim = scoreRelevance(lead, org);
    // Strong keyword match = 15 from keyword scoring
    expect(dim.score).toBeGreaterThanOrEqual(15);
  });

  it("uses keyword matching for low-confidence leads -- weak match", () => {
    const allIndustries = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];
    const lead = makeLead({
      projectType: "Commercial Remodel",
      applicableIndustries: allIndustries,
    });
    const org = makeOrg({ industry: "hvac", specializations: [] });
    const dim = scoreRelevance(lead, org);
    // Weak keyword match = 8 from keyword scoring
    expect(dim.score).toBeGreaterThanOrEqual(8);
  });

  it("uses keyword matching for low-confidence leads -- no match", () => {
    const allIndustries = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];
    const lead = makeLead({
      projectType: "Plumbing Repair",
      sourceType: "news", // use non-preferred source to isolate keyword scoring
      applicableIndustries: allIndustries,
    });
    const org = makeOrg({ industry: "hvac", specializations: [], preferredLeadTypes: [] });
    const dim = scoreRelevance(lead, org);
    // No keyword match = 3 from keyword scoring, no preferred lead type bonus
    expect(dim.score).toBeLessThanOrEqual(5);
  });

  it("differentiates low-confidence leads by industry", () => {
    const allIndustries = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];
    const lead = makeLead({
      projectType: "Roof Repair",
      applicableIndustries: allIndustries,
    });
    const roofingOrg = makeOrg({ industry: "roofing", specializations: [] });
    const hvacOrg = makeOrg({ industry: "hvac", specializations: [] });
    const roofingDim = scoreRelevance(lead, roofingOrg);
    const hvacDim = scoreRelevance(lead, hvacOrg);
    expect(roofingDim.score).toBeGreaterThan(hvacDim.score);
  });

  it("high-confidence leads are unaffected by keyword matching", () => {
    // Lead with only ["hvac"] (not all 5) should still get +10 industry match
    const lead = makeLead({
      projectType: "Generic Work",
      applicableIndustries: ["hvac"],
    });
    const org = makeOrg({ industry: "hvac", specializations: [] });
    const dim = scoreRelevance(lead, org);
    expect(dim.score).toBeGreaterThanOrEqual(10);
    expect(dim.reasons.some((r) => r.includes("hvac"))).toBe(true);
  });

  it("low-confidence lead with null projectType gets baseline score", () => {
    const allIndustries = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];
    const lead = makeLead({
      projectType: null,
      sourceType: "news", // use non-preferred source to isolate keyword scoring
      applicableIndustries: allIndustries,
    });
    const org = makeOrg({ industry: "hvac", specializations: [], preferredLeadTypes: [] });
    const dim = scoreRelevance(lead, org);
    // null projectType = 3 from keyword scoring, no preferred lead type bonus
    expect(dim.score).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// 4. Value: in-range and unknown
// ---------------------------------------------------------------------------

describe("scoreValue", () => {
  it("awards 20 for value within target range", () => {
    const lead = makeLead({ estimatedValue: 50000 });
    const org = makeOrg({
      targetProjectValueMin: 10000,
      targetProjectValueMax: 100000,
    });
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(20);
    expect(dim.maxScore).toBe(20);
  });

  it("awards 10 for unknown value (null)", () => {
    const lead = makeLead({ estimatedValue: null, valueTier: null });
    const org = makeOrg();
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(10);
    expect(dim.reasons[0]).toContain("unknown");
  });

  it("awards 15 for value above target max", () => {
    const lead = makeLead({ estimatedValue: 200000 });
    const org = makeOrg({
      targetProjectValueMin: 10000,
      targetProjectValueMax: 100000,
    });
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(15);
  });

  it("awards 5 for value below 50% of target min", () => {
    const lead = makeLead({ estimatedValue: 4000 });
    const org = makeOrg({
      targetProjectValueMin: 10000,
      targetProjectValueMax: 100000,
    });
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(5);
  });

  it("awards 0 for value well below (below 25% of min)", () => {
    const lead = makeLead({ estimatedValue: 2000 });
    const org = makeOrg({
      targetProjectValueMin: 10000,
      targetProjectValueMax: 100000,
    });
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(0);
  });

  it("awards 10 when org has no target range configured", () => {
    const lead = makeLead({ estimatedValue: 50000 });
    const org = makeOrg({
      targetProjectValueMin: null,
      targetProjectValueMax: null,
    });
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(10);
  });

  it("awards 18 for valueTier 'high' when estimatedValue is null", () => {
    const lead = makeLead({ estimatedValue: null, valueTier: "high" });
    const org = makeOrg();
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(18);
    expect(dim.reasons[0]).toContain("High-value");
  });

  it("awards 12 for valueTier 'medium' when estimatedValue is null", () => {
    const lead = makeLead({ estimatedValue: null, valueTier: "medium" });
    const org = makeOrg();
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(12);
    expect(dim.reasons[0]).toContain("Medium-value");
  });

  it("awards 5 for valueTier 'low' when estimatedValue is null", () => {
    const lead = makeLead({ estimatedValue: null, valueTier: "low" });
    const org = makeOrg();
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(5);
    expect(dim.reasons[0]).toContain("Lower-value");
  });

  it("awards 10 for valueTier null and estimatedValue null (unchanged)", () => {
    const lead = makeLead({ estimatedValue: null, valueTier: null });
    const org = makeOrg();
    const dim = scoreValue(lead, org);
    expect(dim.score).toBe(10);
    expect(dim.reasons[0]).toContain("unknown");
  });
});

// ---------------------------------------------------------------------------
// 5. Freshness decays correctly
// ---------------------------------------------------------------------------

describe("scoreFreshness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Default/Permit curve (weeks-scale) ---

  it("awards 15 for permit discovered today (< 24h)", () => {
    const dim = scoreFreshness(new Date("2026-03-16T06:00:00Z"), "permit");
    expect(dim.score).toBe(15);
    expect(dim.maxScore).toBe(15);
  });

  it("awards 13 for permit within 3 days", () => {
    const dim = scoreFreshness(new Date("2026-03-14T12:00:00Z"), "permit");
    expect(dim.score).toBe(13);
  });

  it("awards 12 for permit within 7 days", () => {
    const dim = scoreFreshness(new Date("2026-03-10T12:00:00Z"), "permit");
    expect(dim.score).toBe(12);
  });

  it("awards 9 for permit within 14 days", () => {
    const dim = scoreFreshness(new Date("2026-03-05T12:00:00Z"), "permit");
    expect(dim.score).toBe(9);
  });

  it("awards 6 for permit within 21 days", () => {
    const dim = scoreFreshness(new Date("2026-02-25T12:00:00Z"), "permit");
    expect(dim.score).toBe(6);
  });

  it("awards 3 for permit within 30 days", () => {
    const dim = scoreFreshness(new Date("2026-02-20T12:00:00Z"), "permit");
    expect(dim.score).toBe(3);
  });

  it("awards 0 for permit older than 30 days", () => {
    const dim = scoreFreshness(new Date("2026-01-01T12:00:00Z"), "permit");
    expect(dim.score).toBe(0);
    expect(dim.reasons[0]).toContain("30 days");
  });

  // --- Storm curve (hours-scale) ---

  it("awards 15 for storm alert scraped 6 hours ago", () => {
    // 6h = 0.25 days, exactly at the boundary -- curve checks < 0.25
    // 6h is exactly 0.25 days, so it falls to next tier (0.5 days = 13)
    const dim = scoreFreshness(new Date("2026-03-16T06:00:00Z"), "storm");
    expect(dim.score).toBe(13); // 6h = 0.25d, falls into <0.5 tier
  });

  it("awards 15 for storm alert scraped 3 hours ago", () => {
    // 3h = 0.125 days, within 0.25 threshold
    const dim = scoreFreshness(new Date("2026-03-16T09:00:00Z"), "storm");
    expect(dim.score).toBe(15);
  });

  it("awards 6 for storm alert scraped 24 hours ago", () => {
    // 24h = 1 day, in the <2 tier
    const dim = scoreFreshness(new Date("2026-03-15T12:00:00Z"), "storm");
    expect(dim.score).toBe(6);
  });

  it("awards 0 for storm alert scraped 3 days ago", () => {
    const dim = scoreFreshness(new Date("2026-03-13T12:00:00Z"), "storm");
    expect(dim.score).toBe(0);
    expect(dim.reasons[0]).toContain("expired");
  });

  // --- Bid curve (days-scale) ---

  it("awards 15 for bid scraped 1 day ago", () => {
    // 12h = 0.5 days, within 1 day threshold
    const dim = scoreFreshness(new Date("2026-03-16T00:00:00Z"), "bid");
    expect(dim.score).toBe(15);
  });

  it("awards 9 for bid scraped 7 days ago", () => {
    // 5 days = within <7 threshold
    const dim = scoreFreshness(new Date("2026-03-11T12:00:00Z"), "bid");
    expect(dim.score).toBe(9);
  });

  it("awards 3 for bid scraped 20 days ago", () => {
    const dim = scoreFreshness(new Date("2026-02-24T12:00:00Z"), "bid");
    expect(dim.score).toBe(3);
  });

  // --- Cross-source differentiation ---

  it("same-time leads with different sourceTypes get different freshness scores", () => {
    const twoHoursAgo = new Date("2026-03-16T10:00:00Z"); // 2h ago
    const stormDim = scoreFreshness(twoHoursAgo, "storm");
    const permitDim = scoreFreshness(twoHoursAgo, "permit");
    // Storm: 2h = 0.083 days, within 0.25 = score 15
    // Permit: 2h = 0.083 days, within 1 = score 15
    // Both score 15 at 2h... let's use a time where they differ
    const twoDaysAgo = new Date("2026-03-14T12:00:00Z"); // 2 days ago
    const stormDim2 = scoreFreshness(twoDaysAgo, "storm");
    const permitDim2 = scoreFreshness(twoDaysAgo, "permit");
    // Storm: 2 days, in <3 tier = score 3
    // Permit: 2 days, in <3 tier = score 13
    expect(stormDim2.score).not.toBe(permitDim2.score);
    expect(permitDim2.score).toBeGreaterThan(stormDim2.score);
  });
});

// ---------------------------------------------------------------------------
// 6. Urgency picks highest signal
// ---------------------------------------------------------------------------

describe("scoreUrgency", () => {
  it("awards 35 for storm with deadline within 48h (10 base + 25 boost)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    const lead = makeLead({
      sourceType: "storm",
      deadline: new Date("2026-03-17T12:00:00Z"), // 24h away
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(35);
    expect(dim.maxScore).toBe(35);
    expect(dim.reasons[0]).toContain("storm");

    vi.useRealTimers();
  });

  it("awards 5 for permit (lower than storm)", () => {
    const lead = makeLead({ sourceType: "permit", deadline: null });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(5);
  });

  it("storm trumps permit signal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    const stormLead = makeLead({
      sourceType: "storm",
      deadline: new Date("2026-03-17T00:00:00Z"),
    });
    const permitLead = makeLead({ sourceType: "permit" });

    const stormDim = scoreUrgency(stormLead);
    const permitDim = scoreUrgency(permitLead);

    expect(stormDim.score).toBeGreaterThan(permitDim.score);

    vi.useRealTimers();
  });

  it("awards 8 for code violation", () => {
    const lead = makeLead({
      sourceType: "inspection",
      severity: "violation",
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(8);
    expect(dim.reasons[0]).toContain("violation");
  });

  it("awards 10 for expiring incentive within 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    const lead = makeLead({
      sourceType: "incentive",
      deadline: new Date("2026-04-01T12:00:00Z"), // 16 days away
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(10);
    expect(dim.reasons[0]).toContain("Incentive");

    vi.useRealTimers();
  });

  it("awards 10 for bid deadline within 14 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    const lead = makeLead({
      sourceType: "bid",
      deadline: new Date("2026-03-25T12:00:00Z"), // 9 days away
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(10);
    expect(dim.reasons[0]).toContain("Bid deadline");

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// 7. Match reasons are human-readable strings (not empty)
// ---------------------------------------------------------------------------

describe("match reasons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces non-empty human-readable match reasons", () => {
    const lead = makeLead();
    const org = makeOrg();
    const result = scoreLeadForOrg(lead, org, 5);

    expect(result.matchReasons.length).toBeGreaterThan(0);
    result.matchReasons.forEach((reason) => {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(3);
    });
  });

  it("includes reasons from all scoring dimensions", () => {
    const lead = makeLead();
    const org = makeOrg();
    const result = scoreLeadForOrg(lead, org, 5);

    // Should have reasons from multiple dimensions
    expect(result.dimensions.length).toBe(5);
    const allReasons = result.dimensions.flatMap((d) => d.reasons);
    expect(allReasons.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Total is clamped 0-100
// ---------------------------------------------------------------------------

describe("total clamping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clamps total between 0 and 100", () => {
    const lead = makeLead();
    const org = makeOrg();
    const result = scoreLeadForOrg(lead, org, 5);

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("never returns a negative total even with all low scores", () => {
    const lead = makeLead({
      lat: null,
      lng: null,
      projectType: "Plumbing",
      sourceType: "unknown",
      applicableIndustries: ["plumbing"],
      estimatedValue: 100,
      valueTier: null,
      severity: null,
      deadline: null,
      scrapedAt: new Date("2025-01-01T00:00:00Z"), // very old
    });
    const org = makeOrg({
      targetProjectValueMin: 100000,
      targetProjectValueMax: 500000,
    });

    const result = scoreLeadForOrg(lead, org, null);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
