import { describe, it, expect } from "vitest";
import { scoreLead } from "@/lib/leads/scoring";
import type { ScoringInput } from "@/lib/leads/types";

describe("scoreLead", () => {
  it("returns score near 100 for full equipment match + close distance + high value", () => {
    const input: ScoringInput = {
      inferredEquipment: ["Excavators", "Boom Lifts", "Forklifts"],
      dealerEquipment: ["Excavators", "Boom Lifts", "Forklifts"],
      distanceMiles: 0,
      serviceRadiusMiles: 100,
      estimatedValue: 1_000_000,
    };
    const score = scoreLead(input);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns score near 0 for no equipment match + far distance + no value", () => {
    const input: ScoringInput = {
      inferredEquipment: ["Generators"],
      dealerEquipment: ["Excavators", "Boom Lifts"],
      distanceMiles: 200,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBeLessThanOrEqual(10);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("gives 50 points max for full equipment match", () => {
    const input: ScoringInput = {
      inferredEquipment: ["Excavators", "Boom Lifts", "Forklifts"],
      dealerEquipment: ["Excavators", "Boom Lifts", "Forklifts"],
      distanceMiles: 200, // outside radius -> 0 geo
      serviceRadiusMiles: 100,
      estimatedValue: null, // no value -> 0 value
    };
    const score = scoreLead(input);
    expect(score).toBe(50);
  });

  it("gives ~17 points for 1/3 equipment match", () => {
    const input: ScoringInput = {
      inferredEquipment: ["Excavators", "Boom Lifts", "Forklifts"],
      dealerEquipment: ["Excavators"],
      distanceMiles: 200,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBeCloseTo(17, 0);
  });

  it("gives 30 points max for 0 miles distance", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 0,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBe(30);
  });

  it("gives 0 geo points at radius boundary", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 100,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBe(0);
  });

  it("gives 0 geo points beyond radius", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 150,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBe(0);
  });

  it("gives 20 points max for $1M+ value", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 200,
      serviceRadiusMiles: 100,
      estimatedValue: 1_000_000,
    };
    const score = scoreLead(input);
    expect(score).toBe(20);
  });

  it("gives ~13 points for $100K value", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 200,
      serviceRadiusMiles: 100,
      estimatedValue: 100_000,
    };
    const score = scoreLead(input);
    // log10(100000) / 6 * 20 = 5/6 * 20 = ~16.67
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(18);
  });

  it("gives 0 value points for null estimatedValue", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: [],
      distanceMiles: 200,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    expect(score).toBe(0);
  });

  it("returns an integer between 0 and 100", () => {
    const input: ScoringInput = {
      inferredEquipment: ["Excavators", "Boom Lifts"],
      dealerEquipment: ["Excavators"],
      distanceMiles: 30,
      serviceRadiusMiles: 100,
      estimatedValue: 250_000,
    };
    const score = scoreLead(input);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles empty inferred equipment gracefully", () => {
    const input: ScoringInput = {
      inferredEquipment: [],
      dealerEquipment: ["Excavators"],
      distanceMiles: 10,
      serviceRadiusMiles: 100,
      estimatedValue: null,
    };
    const score = scoreLead(input);
    // Should only get geo score (~27)
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });
});
