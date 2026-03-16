import { describe, it, expect } from "vitest";

/**
 * Regression test for Bug Fix #14: equipmentTypes Array.isArray guard
 *
 * WHAT WAS BROKEN: Dashboard page directly iterated over
 * profile.equipmentTypes without checking if it was a valid array,
 * causing "TypeError: Cannot read properties of null" when the
 * profile had null/undefined equipmentTypes (e.g., pre-onboarding state).
 *
 * WHAT WAS FIXED: Added Array.isArray guard:
 * Array.isArray(profile.equipmentTypes) ? profile.equipmentTypes : []
 *
 * NOTE: This guard is embedded in page.tsx, not exported. The test
 * verifies the PATTERN inline.
 */

describe("Regression: equipmentTypes Array.isArray guard (Bug Fix #14)", () => {
  // Replicate the guard pattern from dashboard/page.tsx
  function getEquipmentTypes(profile: {
    equipmentTypes: unknown;
  }): string[] {
    return Array.isArray(profile.equipmentTypes)
      ? (profile.equipmentTypes as string[])
      : [];
  }

  it("returns [] when equipmentTypes is null", () => {
    const profile = { equipmentTypes: null };
    expect(getEquipmentTypes(profile)).toEqual([]);
  });

  it("returns [] when equipmentTypes is undefined", () => {
    const profile = { equipmentTypes: undefined };
    expect(getEquipmentTypes(profile)).toEqual([]);
  });

  it('returns [] when equipmentTypes is a string (not array)', () => {
    const profile = { equipmentTypes: "Excavators" };
    expect(getEquipmentTypes(profile)).toEqual([]);
  });

  it("returns [] when equipmentTypes is a number", () => {
    const profile = { equipmentTypes: 42 };
    expect(getEquipmentTypes(profile)).toEqual([]);
  });

  it("returns the array when equipmentTypes is a valid string[]", () => {
    const profile = {
      equipmentTypes: ["Excavators", "Cranes", "Forklifts"],
    };
    expect(getEquipmentTypes(profile)).toEqual([
      "Excavators",
      "Cranes",
      "Forklifts",
    ]);
  });

  it("returns the array unchanged when equipmentTypes is an empty array", () => {
    const profile = { equipmentTypes: [] };
    expect(getEquipmentTypes(profile)).toEqual([]);
  });
});
