import type { NewCompanyProfile } from "@/types";

/**
 * Create a mock company profile for testing.
 * Does NOT insert into database -- returns an object matching the schema shape.
 */
export function createTestCompanyProfile(
  overrides: Partial<NewCompanyProfile> = {}
): NewCompanyProfile {
  return {
    organizationId: `test-org-${Date.now()}`,
    hqAddress: "123 Test Street, Sioux Center, IA 51250",
    hqLat: 43.0831,
    hqLng: -96.1756,
    serviceRadiusMiles: 50,
    equipmentTypes: ["Excavators", "Boom Lifts", "Forklifts"],
    onboardingCompleted: true,
    ...overrides,
  };
}

/**
 * Generate a unique test organization ID.
 */
export function createTestOrgId(): string {
  return `test-org-${Math.random().toString(36).substring(2, 10)}`;
}
