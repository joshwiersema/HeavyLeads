import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSession } from "../helpers/auth";

/**
 * Regression test for Bug Fix #15: Geocoding error handling in forms
 *
 * WHAT WAS BROKEN: completeOnboarding and updateCompanyProfile did not
 * check for null coordinates from geocodeAddress, causing the profile
 * to be saved with null lat/lng which broke distance calculations.
 *
 * WHAT WAS FIXED: Both functions now check if lat or lng is null after
 * geocoding and return { success: false, error: "..." } instead of
 * proceeding with invalid coordinates.
 *
 * This test would FAIL if the null coordinate check were removed.
 */

// Mock handles
const mockGetSession = vi.fn();
const mockGetActiveMember = vi.fn();
const mockProfileFindFirst = vi.fn();

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getActiveMember: (...args: unknown[]) => mockGetActiveMember(...args),
      updateUser: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// Mock geocoding -- returns NULL coordinates to simulate geocoding failure
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: null,
    lng: null,
    formattedAddress: "Unresolved Address",
  }),
}));

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    query: {
      companyProfiles: {
        findFirst: (...args: unknown[]) => mockProfileFindFirst(...args),
      },
    },
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({
    type: "eq",
    a,
    b,
  })),
  and: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings: Array.from(strings),
    values,
  }),
}));

// Mock company-profiles schema
vi.mock("@/lib/db/schema/company-profiles", () => ({
  companyProfiles: {
    organizationId: "organizationId",
  },
}));

// Mock validators
vi.mock("@/lib/validators/onboarding", () => ({
  onboardingSchema: {
    parse: (data: unknown) => data,
  },
  composeAddress: vi
    .fn()
    .mockReturnValue("999 Unknown St, Nowhere, XX 00000"),
}));

vi.mock("@/lib/validators/settings", () => ({
  companySettingsSchema: {
    parse: (data: unknown) => data,
  },
}));

// Import after mocks
import { completeOnboarding } from "@/actions/onboarding";
import { updateCompanyProfile } from "@/actions/settings";

describe("Regression: Geocoding error handling in forms (Bug Fix #15)", () => {
  const testOrgId = "org_geocode_err_test";

  beforeEach(() => {
    vi.clearAllMocks();

    const session = createMockSession({
      activeOrganizationId: testOrgId,
    });
    mockGetSession.mockResolvedValue(session);
    mockGetActiveMember.mockResolvedValue({ role: "owner" });
    mockProfileFindFirst.mockResolvedValue({
      organizationId: testOrgId,
      hqAddress: "Old Address",
      hqLat: 30.0,
      hqLng: -97.0,
    });
  });

  const onboardingData = {
    street: "999 Unknown St",
    city: "Nowhere",
    state: "XX",
    zip: "00000",
    equipmentTypes: ["Excavators"],
    serviceRadius: 50,
  };

  const settingsData = {
    street: "999 Unknown St",
    city: "Nowhere",
    state: "XX",
    zip: "00000",
    equipmentTypes: ["Excavators"],
    serviceRadius: 50,
  };

  it("completeOnboarding returns { success: false } when geocoding returns null coords", async () => {
    const result = await completeOnboarding(onboardingData);

    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("error");
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("completeOnboarding error message mentions address verification", async () => {
    const result = await completeOnboarding(onboardingData);

    expect(result.success).toBe(false);
    // The error should guide the user to check their address
    expect(result.error!.toLowerCase()).toMatch(/address|coordinates|geocod/);
  });

  it("updateCompanyProfile returns { success: false } when geocoding returns null coords", async () => {
    const result = await updateCompanyProfile(settingsData);

    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("error");
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("updateCompanyProfile error message mentions address verification", async () => {
    const result = await updateCompanyProfile(settingsData);

    expect(result.success).toBe(false);
    expect(result.error!.toLowerCase()).toMatch(/address|coordinates|geocod/);
  });
});
