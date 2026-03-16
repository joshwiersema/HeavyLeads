import { describe, it, expect, vi } from "vitest";

/**
 * Tests for buildCheckoutSessionParams (BILL-05).
 * Verifies conditional setup fee inclusion/exclusion logic.
 *
 * BILL-02v3: The { params: { line_items: [...] } } format is correct per
 * @better-auth/stripe plugin source (v1.5.5). It reads result.params and
 * spreads into stripe.checkout.sessions.create().
 */

// Mock stripe.ts to avoid env var errors
vi.mock("@/lib/stripe", () => ({
  stripeClient: {},
  PRICES: {
    monthlySubscription: "price_monthly_test",
    setupFee: "price_setup_test",
  },
}));

describe("buildCheckoutSessionParams (BILL-05)", () => {
  it("trial checkout returns empty params (no setup fee)", async () => {
    const { buildCheckoutSessionParams } = await import("@/lib/billing");

    const plan = {
      name: "standard",
      priceId: "price_monthly_test",
      freeTrial: { days: 7 },
    };

    // First-time user: no trialStart yet means this is the initial trial checkout
    const subscription = null;

    const result = buildCheckoutSessionParams(plan, subscription);
    expect(result).toEqual({});
  });

  it("post-trial first-time paid checkout includes subscription price and setup fee", async () => {
    const { buildCheckoutSessionParams } = await import("@/lib/billing");

    const plan = {
      name: "standard",
      priceId: "price_monthly_test",
      freeTrial: { days: 7 },
    };

    // Post-trial: has trialStart (trial was used) but no stripeSubscriptionId (never paid)
    const subscription = {
      trialStart: new Date(),
      stripeSubscriptionId: null,
    };

    const result = buildCheckoutSessionParams(plan, subscription);
    expect(result).toEqual({
      params: {
        line_items: [
          { price: "price_monthly_test", quantity: 1 },
          { price: "price_setup_test", quantity: 1 },
        ],
      },
    });
  });

  it("regular checkout (existing subscription) returns empty params", async () => {
    const { buildCheckoutSessionParams } = await import("@/lib/billing");

    const plan = {
      name: "standard",
      priceId: "price_monthly_test",
      freeTrial: { days: 7 },
    };

    // Existing subscriber: has stripeSubscriptionId
    const subscription = {
      trialStart: new Date(),
      stripeSubscriptionId: "sub_existing",
    };

    const result = buildCheckoutSessionParams(plan, subscription);
    expect(result).toEqual({});
  });
});
