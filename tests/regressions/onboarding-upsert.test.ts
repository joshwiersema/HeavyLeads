import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSession } from "../helpers/auth";

/**
 * Regression test for Bug Fix #7: Onboarding upsert (onConflictDoUpdate)
 *
 * WHAT WAS BROKEN: completeOnboarding used a plain db.insert without
 * conflict handling, so double-submitting the onboarding form caused
 * a unique constraint violation on companyProfiles.organizationId.
 *
 * WHAT WAS FIXED: Changed to db.insert().values().onConflictDoUpdate()
 * targeting companyProfiles.organizationId, making double-submit safe.
 *
 * This test would FAIL if onConflictDoUpdate were removed.
 */

// Mock handles
const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const mockValues = vi.fn();

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Mock geocoding -- returns valid coordinates
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: 30.2672,
    lng: -97.7431,
    formattedAddress: "123 Main St, Austin, TX 78701",
  }),
}));

// Mock db with insert chain
vi.mock("@/lib/db", () => {
  const insertChain = {
    values: (...args: unknown[]) => {
      mockValues(...args);
      return {
        onConflictDoUpdate: (...conflictArgs: unknown[]) => {
          mockOnConflictDoUpdate(...conflictArgs);
          return Promise.resolve(undefined);
        },
      };
    },
  };

  return {
    db: {
      insert: vi.fn().mockReturnValue(insertChain),
    },
  };
});

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
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
  composeAddress: vi.fn().mockReturnValue("123 Main St, Austin, TX 78701"),
}));

// Import after mocks
import { completeOnboarding } from "@/actions/onboarding";

describe("Regression: Onboarding uses onConflictDoUpdate for double-submit safety (Bug Fix #7)", () => {
  const testOrgId = "org_onboarding_test_123";

  beforeEach(() => {
    vi.clearAllMocks();

    const session = createMockSession({
      activeOrganizationId: testOrgId,
    });
    mockGetSession.mockResolvedValue(session);
  });

  const validOnboardingData = {
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    equipmentTypes: ["Excavators", "Boom Lifts"],
    serviceRadius: 100,
  };

  it("calls onConflictDoUpdate (not plain insert) so double-submit is safe", async () => {
    await completeOnboarding(validOnboardingData);

    // The critical assertion: onConflictDoUpdate MUST be called
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("targets companyProfiles.organizationId in onConflictDoUpdate", async () => {
    await completeOnboarding(validOnboardingData);

    expect(mockOnConflictDoUpdate).toHaveBeenCalled();

    const conflictArgs = mockOnConflictDoUpdate.mock.calls[0][0];
    expect(conflictArgs).toHaveProperty("target");

    // The target should reference the organizationId column
    const target = conflictArgs.target;
    expect(Array.isArray(target)).toBe(true);
    expect(target).toContain("organizationId");
  });

  it("includes set parameter for updating profile on conflict", async () => {
    await completeOnboarding(validOnboardingData);

    const conflictArgs = mockOnConflictDoUpdate.mock.calls[0][0];
    expect(conflictArgs).toHaveProperty("set");

    const setKeys = Object.keys(conflictArgs.set);
    expect(setKeys).toContain("hqAddress");
    expect(setKeys).toContain("hqLat");
    expect(setKeys).toContain("hqLng");
    expect(setKeys).toContain("equipmentTypes");
    expect(setKeys).toContain("serviceRadiusMiles");
    expect(setKeys).toContain("onboardingCompleted");
  });
});
