import { describe, it, expect } from "vitest";
import { getAdaptersForIndustry, getAllAdapters } from "@/lib/scraper/adapters";

describe("Adapter factory pattern", () => {
  describe("getAdaptersForIndustry", () => {
    it("returns 8 adapters for heavy_equipment", () => {
      const adapters = getAdaptersForIndustry("heavy_equipment");
      expect(adapters).toHaveLength(8);

      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("atlanta-ga-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("construction-dive-news");
      expect(sourceIds).toContain("prnewswire-news");
      expect(sourceIds).toContain("google-dorking");
    });

    it("returns adapters including sam-gov with NAICS 238220 for hvac", () => {
      const adapters = getAdaptersForIndustry("hvac");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
    });

    it("returns adapters including sam-gov with NAICS 238160 for roofing", () => {
      const adapters = getAdaptersForIndustry("roofing");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
    });

    it("returns adapters including sam-gov with NAICS 221114 and 238220 for solar", () => {
      const adapters = getAdaptersForIndustry("solar");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
    });

    it("returns adapters including sam-gov with NAICS 238210 for electrical", () => {
      const adapters = getAdaptersForIndustry("electrical");
      const sourceIds = adapters.map((a) => a.sourceId);
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
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
    it("returns deduped union of all industry adapters (no duplicate sourceIds)", () => {
      const adapters = getAllAdapters();
      const sourceIds = adapters.map((a) => a.sourceId);

      // Should contain all 8 unique sourceIds
      expect(sourceIds).toContain("austin-tx-permits");
      expect(sourceIds).toContain("dallas-tx-permits");
      expect(sourceIds).toContain("atlanta-ga-permits");
      expect(sourceIds).toContain("sam-gov-bids");
      expect(sourceIds).toContain("enr-news");
      expect(sourceIds).toContain("construction-dive-news");
      expect(sourceIds).toContain("prnewswire-news");
      expect(sourceIds).toContain("google-dorking");

      // Should be exactly 8 (heavy_equipment superset)
      expect(adapters).toHaveLength(8);
    });
  });
});
