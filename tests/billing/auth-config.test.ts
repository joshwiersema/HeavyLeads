import { describe, it, expect } from "vitest";

/**
 * Tests for BILL-01 (createCustomerOnSignUp: false) and BILL-02 (freeTrial: { days: 7 }).
 * Verifies auth.ts exports testable config constants.
 */

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
