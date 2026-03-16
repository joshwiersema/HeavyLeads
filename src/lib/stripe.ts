import Stripe from "stripe";

/**
 * Stripe client instance.
 *
 * Note: .trim() on the API key is critical — Vercel env vars sometimes
 * include trailing newlines when pasted into the dashboard, which causes
 * every Stripe API call to fail with a connection error.
 */
export const stripeClient = new Stripe(
  (process.env.STRIPE_SECRET_KEY ?? "").trim(),
  {
    maxNetworkRetries: 3,
    timeout: 30000,
  }
);

/**
 * Price IDs from Stripe Dashboard.
 * Create a "HeavyLeads Standard" product with two prices:
 * - A recurring monthly price (e.g. $199/mo)
 * - A one-time setup fee price (e.g. $499)
 */
export const PRICES = {
  monthlySubscription: (process.env.STRIPE_MONTHLY_PRICE_ID ?? "").trim(),
  setupFee: (process.env.STRIPE_SETUP_FEE_PRICE_ID ?? "").trim(),
} as const;
