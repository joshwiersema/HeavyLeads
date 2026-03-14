import { describe, it, expect } from "vitest";
import { EQUIPMENT_TYPES } from "@/types";
import { createTestCompanyProfile, createTestOrgId } from "./helpers/db";
import { createMockSession, createMockSessionNoOrg } from "./helpers/auth";

describe("smoke tests", () => {
  it("equipment types are defined", () => {
    expect(EQUIPMENT_TYPES).toHaveLength(12);
    expect(EQUIPMENT_TYPES).toContain("Excavators");
    expect(EQUIPMENT_TYPES).toContain("Boom Lifts");
  });

  it("test company profile helper creates valid data", () => {
    const profile = createTestCompanyProfile();
    expect(profile.organizationId).toBeTruthy();
    expect(profile.hqAddress).toBeTruthy();
    expect(profile.equipmentTypes).toHaveLength(3);
    expect(profile.onboardingCompleted).toBe(true);
  });

  it("test org id helper creates unique ids", () => {
    const id1 = createTestOrgId();
    const id2 = createTestOrgId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^test-org-/);
  });

  it("mock session helper creates valid session", () => {
    const session = createMockSession();
    expect(session.user.id).toBeTruthy();
    expect(session.session.activeOrganizationId).toBeTruthy();
    expect(session.session.token).toBeTruthy();
  });

  it("mock session without org has null activeOrganizationId", () => {
    const session = createMockSessionNoOrg();
    expect(session.session.activeOrganizationId).toBeNull();
  });
});
