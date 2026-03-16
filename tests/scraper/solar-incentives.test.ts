import { describe, it, expect } from "vitest";
import {
  getSolarIncentives,
  getAllSolarIncentives,
  SOLAR_INCENTIVES,
  type SolarIncentive,
} from "@/lib/scraper/adapters/solar-incentives";

describe("Solar incentives lookup table", () => {
  describe("SOLAR_INCENTIVES", () => {
    it("contains exactly 15 entries", () => {
      expect(SOLAR_INCENTIVES).toHaveLength(15);
    });

    it("covers all 15 target states", () => {
      const stateCodes = SOLAR_INCENTIVES.map((i) => i.stateCode);
      const expectedStates = [
        "CA", "TX", "NY", "FL", "AZ",
        "MA", "NJ", "CO", "NC", "CT",
        "MD", "MN", "IL", "NV", "OR",
      ];
      for (const state of expectedStates) {
        expect(stateCodes).toContain(state);
      }
    });

    it("each entry has all required fields", () => {
      for (const incentive of SOLAR_INCENTIVES) {
        expect(incentive.state).toBeTruthy();
        expect(incentive.stateCode).toMatch(/^[A-Z]{2}$/);
        expect(incentive.programName).toBeTruthy();
        expect(incentive.incentiveType).toBeTruthy();
        expect(incentive.description).toBeTruthy();
        expect(incentive.maxValue).toBeTruthy();
        expect(incentive.url).toMatch(/^https?:\/\//);
        expect(incentive.lastUpdated).toMatch(/^\d{4}-\d{2}/);
      }
    });

    it("incentiveType is one of the valid enum values", () => {
      const validTypes: SolarIncentive["incentiveType"][] = [
        "tax_credit",
        "rebate",
        "net_metering",
        "srec",
        "grant",
      ];
      for (const incentive of SOLAR_INCENTIVES) {
        expect(validTypes).toContain(incentive.incentiveType);
      }
    });
  });

  describe("getSolarIncentives", () => {
    it("returns incentives for California (CA)", () => {
      const results = getSolarIncentives("CA");
      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const r of results) {
        expect(r.stateCode).toBe("CA");
      }
    });

    it("returns incentives for Texas (TX)", () => {
      const results = getSolarIncentives("TX");
      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const r of results) {
        expect(r.stateCode).toBe("TX");
      }
    });

    it("returns empty array for unknown state code", () => {
      const results = getSolarIncentives("XX");
      expect(results).toEqual([]);
    });

    it("is case-insensitive for state code lookup", () => {
      const upper = getSolarIncentives("CA");
      const lower = getSolarIncentives("ca");
      expect(upper).toEqual(lower);
    });

    it("returns empty array for empty string", () => {
      const results = getSolarIncentives("");
      expect(results).toEqual([]);
    });
  });

  describe("getAllSolarIncentives", () => {
    it("returns all 15 entries", () => {
      const all = getAllSolarIncentives();
      expect(all).toHaveLength(15);
    });

    it("returns the same data as SOLAR_INCENTIVES", () => {
      const all = getAllSolarIncentives();
      expect(all).toEqual(SOLAR_INCENTIVES);
    });
  });
});
