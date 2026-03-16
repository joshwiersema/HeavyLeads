import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scoreUrgency } from "@/lib/scoring/urgency";
import type { LeadScoringInput } from "@/lib/scoring/types";

function makeLead(overrides: Partial<LeadScoringInput> = {}): LeadScoringInput {
  return {
    lat: 32.7,
    lng: -97.1,
    projectType: null,
    sourceType: "permit",
    applicableIndustries: ["roofing"],
    estimatedValue: null,
    valueTier: null,
    severity: null,
    deadline: null,
    scrapedAt: new Date(),
    ...overrides,
  };
}

describe("scoreUrgency -- storm boost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("storm lead with deadline <48h gets 35pts urgency (10 base + 25 boost)", () => {
    const lead = makeLead({
      sourceType: "storm",
      deadline: new Date("2026-03-17T12:00:00Z"), // 24h away
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(35);
    expect(dim.maxScore).toBe(35);
    expect(dim.reasons).toContain("Active storm alert");
    expect(dim.reasons.some((r) => r.includes("25pt"))).toBe(true);
  });

  it("storm lead without deadline gets 25pts (just the boost)", () => {
    const lead = makeLead({
      sourceType: "storm",
      deadline: null,
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(25);
    expect(dim.maxScore).toBe(35);
    expect(dim.reasons.some((r) => r.includes("25pt"))).toBe(true);
  });

  it("storm lead with expired deadline gets 25pts (boost only, no base storm signal)", () => {
    const lead = makeLead({
      sourceType: "storm",
      deadline: new Date("2026-03-14T12:00:00Z"), // 2 days ago (expired)
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(25);
    expect(dim.maxScore).toBe(35);
  });

  it("non-storm leads unchanged: permit still gets 5pts with maxScore 10", () => {
    const lead = makeLead({ sourceType: "permit" });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(5);
    expect(dim.maxScore).toBe(10);
  });

  it("non-storm leads unchanged: bid with deadline gets 10pts with maxScore 10", () => {
    const lead = makeLead({
      sourceType: "bid",
      deadline: new Date("2026-03-25T12:00:00Z"), // 9 days
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(10);
    expect(dim.maxScore).toBe(10);
  });

  it("urgency dimension maxScore is 35 for storm, 10 for non-storm", () => {
    const stormLead = makeLead({ sourceType: "storm" });
    const permitLead = makeLead({ sourceType: "permit" });

    const stormDim = scoreUrgency(stormLead);
    const permitDim = scoreUrgency(permitLead);

    expect(stormDim.maxScore).toBe(35);
    expect(permitDim.maxScore).toBe(10);
  });

  it("disaster leads do not get storm boost (separate sourceType)", () => {
    const lead = makeLead({
      sourceType: "disaster",
      deadline: null,
    });
    const dim = scoreUrgency(lead);
    expect(dim.score).toBe(0);
    expect(dim.maxScore).toBe(10);
  });
});
