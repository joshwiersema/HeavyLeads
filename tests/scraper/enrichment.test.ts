import { describe, it, expect } from "vitest";
import {
  inferApplicableIndustries,
  inferValueTier,
} from "@/lib/scraper/enrichment";

describe("inferApplicableIndustries", () => {
  it("tags lead with 'hvac' when text contains HVAC keywords", () => {
    const result = inferApplicableIndustries({
      title: "HVAC System Installation",
      description: "Install new heating and cooling system",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("hvac");
  });

  it("tags lead with 'roofing' when text contains roof keywords", () => {
    const result = inferApplicableIndustries({
      title: "Roof Replacement",
      description: "Replace shingle roof on commercial building",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("roofing");
  });

  it("tags lead with 'solar' when text contains solar keywords", () => {
    const result = inferApplicableIndustries({
      title: "Solar Panel Installation",
      description: "Install photovoltaic system on roof",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("solar");
  });

  it("tags lead with 'electrical' when text contains electrical keywords", () => {
    const result = inferApplicableIndustries({
      title: "Electrical Panel Upgrade",
      description: "Replace wiring and transformer",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("electrical");
  });

  it("tags lead with 'heavy_equipment' when text contains heavy equipment keywords", () => {
    const result = inferApplicableIndustries({
      title: "Demolition Project",
      description: "Excavation and crane work required",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("heavy_equipment");
  });

  it("defaults permit leads with no keyword matches to heavy_equipment", () => {
    const result = inferApplicableIndustries({
      title: "General Construction",
      description: "Miscellaneous building work",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toEqual(["heavy_equipment"]);
  });

  it("returns empty array for non-permit leads with no keyword matches", () => {
    const result = inferApplicableIndustries({
      title: "General News Article",
      description: "Some news about construction",
      projectType: null,
      sourceType: "news",
    });
    expect(result).toEqual([]);
  });

  it("can match multiple industries", () => {
    const result = inferApplicableIndustries({
      title: "Solar Panel and HVAC Installation",
      description: "Install photovoltaic system with heating upgrade",
      projectType: null,
      sourceType: "permit",
    });
    expect(result).toContain("solar");
    expect(result).toContain("hvac");
  });
});

describe("inferValueTier", () => {
  it("returns null for null estimated value", () => {
    expect(inferValueTier(null)).toBeNull();
  });

  it("returns 'low' for estimated value < 50000", () => {
    expect(inferValueTier(25000)).toBe("low");
  });

  it("returns 'medium' for estimated value 50000-500000", () => {
    expect(inferValueTier(50000)).toBe("medium");
    expect(inferValueTier(250000)).toBe("medium");
    expect(inferValueTier(500000)).toBe("medium");
  });

  it("returns 'high' for estimated value > 500000", () => {
    expect(inferValueTier(500001)).toBe("high");
    expect(inferValueTier(1000000)).toBe("high");
  });
});
