import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { eq, or, and } from "drizzle-orm";
import { PRICES } from "@/lib/stripe";

/**
 * Query the subscription table for an active or trialing subscription
 * belonging to the given organization.
 *
 * @returns The subscription row or null if none found.
 */
export async function getActiveSubscription(organizationId: string) {
  const sub = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, organizationId),
      or(
        eq(subscription.status, "active"),
        eq(subscription.status, "trialing")
      )
    ),
  });
  return sub ?? null;
}

// ---------------------------------------------------------------------------
// Trial status utility
// ---------------------------------------------------------------------------

export interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEnd: Date | null;
}

/**
 * Compute trial state from a subscription record.
 * Pure function -- safe to call from server or client code.
 *
 * Uses Math.ceil so that partial days round up (e.g. 5 hours remaining = 1 day).
 */
export function getTrialStatus(
  sub: {
    status: string | null;
    trialStart: Date | null;
    trialEnd: Date | null;
  } | null
): TrialStatus {
  if (!sub || !sub.trialEnd) {
    return { isTrialing: false, isExpired: false, daysRemaining: 0, trialEnd: null };
  }

  const now = new Date();
  const trialEnd = new Date(sub.trialEnd);
  const msRemaining = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / 86400000));

  return {
    isTrialing: sub.status === "trialing",
    isExpired: daysRemaining === 0 && sub.status !== "active",
    daysRemaining,
    trialEnd,
  };
}

// ---------------------------------------------------------------------------
// Checkout session params builder
// ---------------------------------------------------------------------------

interface CheckoutPlan {
  name: string;
  priceId?: string;
  freeTrial?: { days: number };
}

interface CheckoutSubscription {
  trialStart?: Date | null;
  stripeSubscriptionId?: string | null;
}

/**
 * Build custom checkout session params for the Stripe plugin's
 * getCheckoutSessionParams callback.
 *
 * Logic:
 * - Trial checkout (plan has freeTrial AND user has no prior trial): return {}
 *   so the plugin uses its defaults (recurring price + trial_period_days).
 *   Setup fee is excluded because Stripe charges one-time items immediately.
 *
 * - Post-trial first-time paid (user had a trial but never had a paid subscription):
 *   return line_items with both the recurring price and setup fee.
 *   IMPORTANT: line_items OVERRIDES the plugin's defaults, so the recurring price
 *   must be included alongside the setup fee.
 *
 * - Existing subscriber (has stripeSubscriptionId): return {} (no setup fee).
 *
 * NOTE (BILL-02v3): The { params: { line_items: [...] } } return format looks
 * double-nested but is correct. The @better-auth/stripe plugin (v1.5.5) calls
 * getCheckoutSessionParams() and reads result.params, then spreads it into
 * stripe.checkout.sessions.create(). So { params: { line_items } } means
 * line_items gets spread into the Stripe call as intended.
 */
export function buildCheckoutSessionParams(
  plan: CheckoutPlan,
  sub: CheckoutSubscription | null | undefined
): Record<string, unknown> {
  // Trial checkout: no setup fee (Stripe charges one-time items immediately)
  const isTrialCheckout = !!plan.freeTrial && !sub?.trialStart;
  if (isTrialCheckout) {
    return {};
  }

  // Post-trial first-time paid: include setup fee
  const isFirstTimePaid = sub?.trialStart && !sub?.stripeSubscriptionId;
  if (isFirstTimePaid) {
    return {
      params: {
        line_items: [
          { price: plan.priceId, quantity: 1 },
          { price: PRICES.setupFee, quantity: 1 },
        ],
      },
    };
  }

  // Existing subscriber or other case: no setup fee
  return {};
}
