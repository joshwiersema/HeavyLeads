import { describe, it, expect, vi } from "vitest";

/**
 * Tests for BILL-01 (createCustomerOnSignUp: false) and BILL-02 (freeTrial: { days: 7 }).
 * Verifies auth.ts exports testable config constants.
 *
 * Mocks heavy dependencies (DB, betterAuth, stripe plugin) so we can import
 * the exported config constants without side effects.
 */

// Mock DB to prevent real connection
vi.mock("@/lib/db", () => ({
  db: { query: { member: { findFirst: vi.fn() } } },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
}));

// Mock DB schema
vi.mock("@/lib/db/schema/auth", () => ({
  member: { userId: "userId", organizationId: "organizationId" },
}));

vi.mock("@/lib/db/schema/subscriptions", () => ({
  subscription: { referenceId: "referenceId", status: "status" },
}));

// Mock betterAuth to avoid full server instantiation
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({})),
}));

vi.mock("better-auth/plugins", () => ({
  organization: vi.fn(() => ({})),
}));

vi.mock("@better-auth/stripe", () => ({
  stripe: vi.fn(() => ({})),
}));

vi.mock("better-auth/next-js", () => ({
  nextCookies: vi.fn(() => ({})),
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn(() => ({})),
}));

describe("Stripe plugin config (BILL-01)", () => {
  it("has createCustomerOnSignUp set to false", async () => {
    const { STRIPE_PLUGIN_CONFIG } = await import("@/lib/auth");
    expect(STRIPE_PLUGIN_CONFIG.createCustomerOnSignUp).toBe(false);
  });
});

describe("Subscription plan config (BILL-02)", () => {
  it("standard plan has freeTrial with days: 7", async () => {
    const { SUBSCRIPTION_PLANS } = await import("@/lib/auth");
    const standardPlan = SUBSCRIPTION_PLANS.find(
      (p: { name: string }) => p.name === "standard"
    );
    expect(standardPlan).toBeDefined();
    expect(standardPlan!.freeTrial).toEqual({ days: 7 });
  });

  it("standard plan has correct priceId from PRICES", async () => {
    const { SUBSCRIPTION_PLANS } = await import("@/lib/auth");
    const { PRICES } = await import("@/lib/stripe");
    const standardPlan = SUBSCRIPTION_PLANS.find(
      (p: { name: string }) => p.name === "standard"
    );
    expect(standardPlan!.priceId).toBe(PRICES.monthlySubscription);
  });
});
