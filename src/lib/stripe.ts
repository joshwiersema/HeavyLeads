import Stripe from "stripe";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  maxNetworkRetries: 3,
  timeout: 30000,
});

/**
 * Price IDs from Stripe Dashboard.
 * Create a "HeavyLeads Standard" product with two prices:
 * - A recurring monthly price (e.g. $199/mo)
 * - A one-time setup fee price (e.g. $499)
 */
export const PRICES = {
  monthlySubscription: process.env.STRIPE_MONTHLY_PRICE_ID!,
  setupFee: process.env.STRIPE_SETUP_FEE_PRICE_ID!,
} as const;
