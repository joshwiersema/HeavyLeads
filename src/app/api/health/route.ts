import { stripeClient, PRICES } from "@/lib/stripe";

/**
 * GET /api/health
 *
 * Diagnostic endpoint to verify Stripe connectivity and configuration
 * from the Vercel runtime. Returns config status without exposing secrets.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY
        ? `${process.env.STRIPE_SECRET_KEY.substring(0, 7)}...${process.env.STRIPE_SECRET_KEY.substring(process.env.STRIPE_SECRET_KEY.length - 4)}`
        : "MISSING",
      STRIPE_MONTHLY_PRICE_ID: PRICES.monthlySubscription || "MISSING",
      STRIPE_SETUP_FEE_PRICE_ID: PRICES.setupFee || "MISSING",
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
        ? "SET"
        : "MISSING",
      CRON_SECRET: process.env.CRON_SECRET ? "SET" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? "SET" : "MISSING",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "MISSING",
    },
  };

  // Test Stripe connectivity
  try {
    const balance = await stripeClient.balance.retrieve();
    checks.stripe = {
      connected: true,
      mode: balance.livemode ? "LIVE" : "TEST",
    };
  } catch (err) {
    checks.stripe = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test Stripe customer creation (the operation that's failing)
  try {
    const customer = await stripeClient.customers.create({
      name: "Health Check Test",
      email: "healthcheck@test.com",
      metadata: { test: "true" },
    });
    checks.customerCreation = {
      success: true,
      customerId: customer.id,
    };
    // Clean up
    await stripeClient.customers.del(customer.id);
  } catch (err) {
    checks.customerCreation = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      type: err instanceof Error ? err.constructor.name : "unknown",
    };
  }

  // Test that price IDs are valid
  if (PRICES.monthlySubscription) {
    try {
      const price = await stripeClient.prices.retrieve(
        PRICES.monthlySubscription
      );
      checks.monthlyPrice = {
        valid: true,
        amount: price.unit_amount,
        currency: price.currency,
        active: price.active,
      };
    } catch (err) {
      checks.monthlyPrice = {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return Response.json(checks, { status: 200 });
}
