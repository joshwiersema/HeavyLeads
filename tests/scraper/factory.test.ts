import { describe, it, expect } from "vitest";
import { getAdaptersForIndustry, getAllAdapters } from "@/lib/scraper/adapters";

describe("Adapter factory pattern", () => {
  describe("getAdaptersForIndustry", () => {
    it("returns 9 adapters for heavy_equipment (violations NOT included)", () => {
      const adapters = getAdaptersForIndustry("heavy_equipment");
      expect(adapters).toHaveLength(9);

      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("atlanta-ga-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("construction-dive-news");
      expect(sourceIds).toContain("prnewswire-news");
      expect(sourceIds).toContain("google-dorking");
      expect(sourceIds).toContain("fema-disaster-declarations");

      // Violation adapters should NOT be in heavy_equipment
      expect(sourceIds).not.toContain("austin-tx-violations");
      expect(sourceIds).not.toContain("dallas-tx-violations");
      expect(sourceIds).not.toContain("houston-tx-violations");
    });

    it("returns adapters including violations for hvac", () => {
      const adapters = getAdaptersForIndustry("hvac");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");

      // Violation adapters should be included for HVAC
      expect(sourceIds).toContain("austin-tx-violations");
      expect(sourceIds).toContain("dallas-tx-violations");
      expect(sourceIds).toContain("houston-tx-violations");
    });

    it("returns adapters including violations for roofing", () => {
      const adapters = getAdaptersForIndustry("roofing");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("nws-storm-alerts");
      expect(sourceIds).toContain("fema-disaster-declarations");

      // Violation adapters should be included for roofing
      expect(sourceIds).toContain("austin-tx-violations");
      expect(sourceIds).toContain("dallas-tx-violations");
      expect(sourceIds).toContain("houston-tx-violations");
    });

    it("returns adapters including EIA but NOT violations for solar", () => {
      const adapters = getAdaptersForIndustry("solar");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("eia-utility-rates");

      // Violation adapters should NOT be in solar
      expect(sourceIds).not.toContain("austin-tx-violations");
      expect(sourceIds).not.toContain("dallas-tx-violations");
      expect(sourceIds).not.toContain("houston-tx-violations");
    });

    it("returns adapters including violations for electrical", () => {
      const adapters = getAdaptersForIndustry("electrical");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");

      // Violation adapters should be included for electrical
      expect(sourceIds).toContain("austin-tx-violations");
      expect(sourceIds).toContain("dallas-tx-violations");
      expect(sourceIds).toContain("houston-tx-violations");
    });

    it("returns fresh adapter instances on each call (no shared mutable state)", () => {
      const first = getAdaptersForIndustry("heavy_equipment");
      const second = getAdaptersForIndustry("heavy_equipment");

      // Same count
      expect(first).toHaveLength(second.length);

      // But different object references
      for (let i = 0; i < first.length; i++) {
        expect(first[i]).not.toBe(second[i]);
      }
    });
  });

  describe("getAllAdapters", () => {
    it("returns superset including all adapter types", () => {
      const adapters = getAllAdapters();
      const sourceIds = adapters.map((a) => a.sourceId);

      // Original heavy_equipment adapters
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("atlanta-ga-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("construction-dive-news");
      expect(sourceIds).toContain("prnewswire-news");
      expect(sourceIds).toContain("google-dorking");
      expect(sourceIds).toContain("fema-disaster-declarations");

      // Violation adapters in the superset
      expect(sourceIds).toContain("austin-tx-violations");
      expect(sourceIds).toContain("dallas-tx-violations");
      expect(sourceIds).toContain("houston-tx-violations");

      // EIA adapter in the superset
      expect(sourceIds).toContain("eia-utility-rates");
    });

    it("has no duplicate sourceIds", () => {
      const adapters = getAllAdapters();
      const sourceIds = adapters.map((a) => a.sourceId);
      const uniqueIds = new Set(sourceIds);
      expect(uniqueIds.size).toBe(sourceIds.length);
    });
  });
});
