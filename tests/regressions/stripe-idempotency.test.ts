import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSession } from "../helpers/auth";

/**
 * Regression test for Bug Fix #6: Stripe idempotency key
 *
 * WHAT WAS BROKEN: ensureStripeCustomer did not include an idempotencyKey
 * when calling stripeClient.customers.create, risking duplicate Stripe
 * customers on retry/double-submit.
 *
 * WHAT WAS FIXED: Added { idempotencyKey: `create-customer-${orgId}` }
 * as the second argument to customers.create, ensuring at-most-once
 * customer creation per organization.
 *
 * This test would FAIL if the idempotencyKey were removed.
 */

// Mock handles declared before vi.mock
const mockCustomersCreate = vi.fn().mockResolvedValue({
  id: "cus_test_123",
  name: "Test Org",
});

const mockOrgFindFirst = vi.fn();

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

// Mock db with query and update interfaces
const mockOrgUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      organization: {
        findFirst: (...args: unknown[]) => mockOrgFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => mockOrgUpdate(...args),
  },
}));

// Mock Stripe client
vi.mock("@/lib/stripe", () => ({
  stripeClient: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
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
}));

// Mock auth schema
vi.mock("@/lib/db/schema/auth", () => ({
  organization: { id: "id", stripeCustomerId: "stripeCustomerId" },
}));

// Mock subscriptions schema
vi.mock("@/lib/db/schema/subscriptions", () => ({
  subscription: { referenceId: "referenceId" },
}));

// Import after mocks
import { ensureStripeCustomer } from "@/actions/billing";

describe("Regression: Stripe idempotency key on customer creation (Bug Fix #6)", () => {
  const testOrgId = "org_stripe_test_123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated session with org
    const session = createMockSession({
      activeOrganizationId: testOrgId,
    });
    mockGetSession.mockResolvedValue(session);

    // Default: org exists but has no Stripe customer yet
    mockOrgFindFirst.mockResolvedValue({
      id: testOrgId,
      name: "Test Heavy Equipment Co",
      stripeCustomerId: null,
    });
  });

  it("passes idempotencyKey matching create-customer-{orgId} pattern", async () => {
    await ensureStripeCustomer();

    expect(mockCustomersCreate).toHaveBeenCalledTimes(1);

    // The second argument to customers.create should contain the idempotencyKey
    const secondArg = mockCustomersCreate.mock.calls[0][1];
    expect(secondArg).toBeDefined();
    expect(secondArg).toHaveProperty("idempotencyKey");
    expect(secondArg.idempotencyKey).toBe(`create-customer-${testOrgId}`);
  });

  it("includes orgId in the idempotencyKey for per-org uniqueness", async () => {
    await ensureStripeCustomer();

    const secondArg = mockCustomersCreate.mock.calls[0][1];
    expect(secondArg.idempotencyKey).toContain(testOrgId);
  });

  it("skips customer creation when org already has stripeCustomerId", async () => {
    mockOrgFindFirst.mockResolvedValue({
      id: testOrgId,
      name: "Already Has Customer",
      stripeCustomerId: "cus_existing_456",
    });

    const result = await ensureStripeCustomer();

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ customerId: "cus_existing_456" });
  });
});
