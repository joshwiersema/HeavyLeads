/**
 * Factory functions for creating mock lead and company profile objects in tests.
 */

/** Creates a mock lead object with sensible defaults (Austin TX area). */
export function createMockLead(overrides?: Record<string, unknown>) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    permitNumber: "BLDG-2026-001",
    description: "New commercial warehouse with excavation and grading",
    address: "123 Main St, Austin, TX",
    formattedAddress: "123 Main Street, Austin, TX 78701",
    lat: 30.2672,
    lng: -97.7431,
    projectType: "Commercial New Construction",
    estimatedValue: 500000,
    applicantName: "ABC Construction Co",
    permitDate: new Date("2026-03-01"),
    sourceId: "austin",
    sourceJurisdiction: "Austin, TX",
    sourceUrl: "https://permits.austin.gov/BLDG-2026-001",
    scrapedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

/** Creates a mock company profile with defaults (Austin TX HQ). */
export function createMockCompanyProfile(overrides?: Record<string, unknown>) {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    organizationId: "org_test_123",
    hqAddress: "500 Congress Ave, Austin, TX",
    hqLat: 30.2672,
    hqLng: -97.7431,
    serviceRadiusMiles: 100,
    equipmentTypes: ["Excavators", "Boom Lifts", "Forklifts"] as string[],
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
