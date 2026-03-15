import { describe, it, expect } from "vitest";

/**
 * Tests for getTrialStatus utility (BILL-03 foundation).
 * Pure function -- no mocks needed.
 */

describe("getTrialStatus", () => {
  it("returns isTrialing: true and correct daysRemaining for active trial", async () => {
    const { getTrialStatus } = await import("@/lib/billing");

    const trialEnd = new Date(Date.now() + 5 * 86400000); // 5 days from now
    const result = getTrialStatus({
      status: "trialing",
      trialStart: new Date(),
      trialEnd,
    });

    expect(result.isTrialing).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(5);
    expect(result.trialEnd).toEqual(trialEnd);
  });

  it("returns isExpired: true and daysRemaining: 0 for expired trial", async () => {
    const { getTrialStatus } = await import("@/lib/billing");

    const result = getTrialStatus({
      status: "past_due",
      trialStart: new Date(Date.now() - 14 * 86400000),
      trialEnd: new Date(Date.now() - 7 * 86400000), // ended 7 days ago
    });

    expect(result.isTrialing).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it("returns isTrialing: false for null subscription", async () => {
    const { getTrialStatus } = await import("@/lib/billing");

    const result = getTrialStatus(null);

    expect(result.isTrialing).toBe(false);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.trialEnd).toBeNull();
  });

  it("returns isTrialing: false for subscription without trialEnd", async () => {
    const { getTrialStatus } = await import("@/lib/billing");

    const result = getTrialStatus({
      status: "active",
      trialStart: null,
      trialEnd: null,
    });

    expect(result.isTrialing).toBe(false);
    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.trialEnd).toBeNull();
  });

  it("returns daysRemaining: 1 when less than 24 hours remain (Math.ceil)", async () => {
    const { getTrialStatus } = await import("@/lib/billing");

    const trialEnd = new Date(Date.now() + 5 * 3600000); // 5 hours from now
    const result = getTrialStatus({
      status: "trialing",
      trialStart: new Date(Date.now() - 6 * 86400000),
      trialEnd,
    });

    expect(result.isTrialing).toBe(true);
    expect(result.daysRemaining).toBe(1);
  });
});
