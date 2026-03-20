import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scoreLeadForOrg } from "@/lib/scoring/engine";
import type { LeadScoringInput, OrgScoringContext } from "@/lib/scoring/types";

// ---------------------------------------------------------------------------
// Representative org for standard deviation testing
// ---------------------------------------------------------------------------

const testOrg: OrgScoringContext = {
  industry: "hvac",
  hqLat: 32.78,
  hqLng: -96.8,
  serviceRadiusMiles: 50,
  specializations: ["Heat Pumps", "Commercial HVAC"],
  preferredLeadTypes: ["Building Permits", "Code Violations"],
  targetProjectValueMin: 10000,
  targetProjectValueMax: 200000,
};

// ---------------------------------------------------------------------------
// Synthetic lead generator
// ---------------------------------------------------------------------------

/**
 * Generates diverse synthetic leads that vary across all scoring dimensions:
 * - projectType: 16 variations including null
 * - sourceType: 6 variations (permit, bid, storm, violation, news, incentive)
 * - applicableIndustries: 7 patterns (single-industry to all-5 low-confidence)
 * - valueTier: 4 patterns (high, medium, low, null)
 * - freshness: 0-35 days ago
 * - distance: 1-120 miles (with 2% null)
 * - estimatedValue: present for every 3rd lead
 * - deadline: present for bids and storms
 */
function generateLeads(
  count: number
): Array<{ lead: LeadScoringInput; distance: number | null }> {
  const results: Array<{ lead: LeadScoringInput; distance: number | null }> =
    [];
  const now = new Date("2026-03-20T12:00:00Z");

  const projectTypes = [
    "HVAC Installation",
    "Heat Pump Replacement",
    "Commercial HVAC",
    "Roof Replacement",
    "Solar Panel Installation",
    "Panel Upgrade",
    "New Commercial Construction",
    "Residential Remodel",
    "Demolition",
    "Plumbing Repair",
    "Foundation Repair",
    "Pool Construction",
    "Electrical Wiring",
    "Tenant Improvement",
    "Addition",
    null, // some leads have no projectType
  ];

  const sourceTypes = [
    "permit",
    "bid",
    "storm",
    "violation",
    "news",
    "incentive",
  ];

  const industryOptions: string[][] = [
    ["hvac"],
    ["roofing"],
    ["solar"],
    ["electrical"],
    ["heavy_equipment"],
    ["hvac", "electrical"],
    ["heavy_equipment", "hvac", "roofing", "solar", "electrical"], // low confidence
  ];

  const valueTiers = ["high", "medium", "low", null];

  for (let i = 0; i < count; i++) {
    const projectType = projectTypes[i % projectTypes.length];
    const sourceType = sourceTypes[i % sourceTypes.length];
    const industries = industryOptions[i % industryOptions.length];
    const valueTier = valueTiers[i % valueTiers.length];

    // Vary freshness: 0 to 35 days ago
    const daysAgo = (i * 37) % 36; // pseudo-random spread
    const scrapedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Vary distance: 1 to 120 miles
    const distance = ((i * 13) % 120) + 1;

    // Some leads have estimated values, some don't
    const estimatedValue =
      i % 3 === 0 ? ((i * 7919) % 1_000_000) + 1000 : null;

    // Some leads have deadlines
    const deadline =
      sourceType === "bid"
        ? new Date(now.getTime() + ((i % 30) + 1) * 24 * 60 * 60 * 1000)
        : sourceType === "storm"
          ? new Date(now.getTime() + ((i % 3) + 1) * 24 * 60 * 60 * 1000)
          : null;

    results.push({
      lead: {
        lat: 32.78 + (i % 100) * 0.01,
        lng: -96.8 + (i % 100) * 0.01,
        projectType,
        sourceType,
        applicableIndustries: industries,
        estimatedValue,
        valueTier,
        severity: sourceType === "violation" ? "violation" : null,
        deadline,
        scrapedAt,
      },
      distance: i % 50 === 0 ? null : distance, // 2% have null distance
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function computeStats(scores: number[]) {
  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  // Count distribution across quartiles
  const low = scores.filter((s) => s <= 25).length;
  const mid = scores.filter((s) => s > 25 && s <= 50).length;
  const midHigh = scores.filter((s) => s > 50 && s <= 75).length;
  const high = scores.filter((s) => s > 75).length;

  // Find most common score and its frequency
  const freq: Record<number, number> = {};
  for (const s of scores) {
    const rounded = Math.round(s);
    freq[rounded] = (freq[rounded] ?? 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(freq));
  const maxFreqPct = maxFreq / n;

  return { mean, stdDev, min, max, low, mid, midHigh, high, maxFreqPct, n };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Score standard deviation and differentiation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1200 synthetic leads produce standard deviation > 15", () => {
    const leads = generateLeads(1200);
    const scores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, testOrg, distance).total
    );

    const stats = computeStats(scores);
    console.log("Score stats:", stats);

    expect(stats.stdDev).toBeGreaterThan(15);
  });

  it("score range spans at least 50 points (max - min >= 50)", () => {
    const leads = generateLeads(1200);
    const scores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, testOrg, distance).total
    );

    const stats = computeStats(scores);
    expect(stats.max - stats.min).toBeGreaterThanOrEqual(50);
  });

  it("no single integer score captures more than 30% of leads (anti-clustering)", () => {
    const leads = generateLeads(1200);
    const scores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, testOrg, distance).total
    );

    const stats = computeStats(scores);
    expect(stats.maxFreqPct).toBeLessThan(0.3);
  });

  it("scores are distributed across low, mid, mid-high, and high ranges", () => {
    const leads = generateLeads(1200);
    const scores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, testOrg, distance).total
    );

    const stats = computeStats(scores);

    // All four quartile ranges must have at least some leads
    expect(stats.low).toBeGreaterThan(0); // 0-25 range
    expect(stats.mid).toBeGreaterThan(0); // 26-50 range
    expect(stats.midHigh).toBeGreaterThan(0); // 51-75 range
    expect(stats.high).toBeGreaterThan(0); // 76-100 range
  });

  // -----------------------------------------------------------------------
  // Per-org differentiation: same leads produce different rank orders
  // -----------------------------------------------------------------------

  it("same leads produce different rank orders for different orgs", () => {
    const roofingOrg: OrgScoringContext = {
      industry: "roofing",
      hqLat: 32.78,
      hqLng: -96.8,
      serviceRadiusMiles: 50,
      specializations: ["Asphalt Shingles", "Storm Restoration"],
      preferredLeadTypes: ["Storm Alerts"],
      targetProjectValueMin: 5000,
      targetProjectValueMax: 50000,
    };

    const leads = generateLeads(200);
    const hvacScores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, testOrg, distance).total
    );
    const roofingScores = leads.map(({ lead, distance }) =>
      scoreLeadForOrg(lead, roofingOrg, distance).total
    );

    // Count how many leads have different scores between the two orgs
    let diffCount = 0;
    for (let i = 0; i < leads.length; i++) {
      if (hvacScores[i] !== roofingScores[i]) diffCount++;
    }

    // At least 20% of leads should score differently between orgs
    expect(diffCount / leads.length).toBeGreaterThan(0.2);
  });
});
