import { describe, it, expect } from "vitest";
import { inferValueTier } from "@/lib/scraper/enrichment";

describe("inferValueTier with projectType", () => {
  it("returns 'high' for 'New Commercial Construction' when estimatedValue is null", () => {
    const result = inferValueTier(null, "New Commercial Construction");
    expect(result).toBe("high");
  });

  it("returns 'low' for 'Residential Remodel' when estimatedValue is null", () => {
    const result = inferValueTier(null, "Residential Remodel");
    expect(result).toBe("low");
  });

  it("returns 'low' for 'HVAC Installation' when estimatedValue is null", () => {
    const result = inferValueTier(null, "HVAC Installation");
    expect(result).toBe("low");
  });

  it("returns 'medium' for 'Demolition' when estimatedValue is null", () => {
    const result = inferValueTier(null, "Demolition");
    expect(result).toBe("medium");
  });

  it("returns 'high' from estimatedValue when value is above 500K", () => {
    const result = inferValueTier(500001, null);
    expect(result).toBe("high");
  });

  it("returns 'medium' from estimatedValue when value is in medium range", () => {
    const result = inferValueTier(100000, null);
    expect(result).toBe("medium");
  });

  it("returns 'low' from estimatedValue when value is small", () => {
    const result = inferValueTier(10000, null);
    expect(result).toBe("low");
  });

  it("returns null when both estimatedValue and projectType are null", () => {
    const result = inferValueTier(null, null);
    expect(result).toBeNull();
  });

  it("returns null when estimatedValue is null and projectType is unrecognized", () => {
    const result = inferValueTier(null, "unknown gibberish xyz");
    expect(result).toBeNull();
  });

  it("prefers estimatedValue over projectType when both present", () => {
    // estimatedValue 10000 = "low", but projectType "New Commercial" = "high"
    // estimatedValue should win
    const result = inferValueTier(10000, "New Commercial Construction");
    expect(result).toBe("low");
  });
});
