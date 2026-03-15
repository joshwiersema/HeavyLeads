/**
 * Stripe Product & Price Seed Script
 *
 * Creates all required Stripe objects for HeavyLeads. Idempotent — safe to
 * run multiple times. Checks for existing objects before creating.
 *
 * Creates:
 *   1. Product: "HeavyLeads Standard"
 *   2. Price: Monthly recurring subscription (default $199/mo)
 *   3. Price: One-time setup fee (default $499)
 *
 * Usage:
 *   npx tsx scripts/stripe-seed.ts
 *   npx tsx scripts/stripe-seed.ts --monthly=9900 --setup=24900
 *
 * After running, copy the output Price IDs to your .env.local:
 *   STRIPE_MONTHLY_PRICE_ID=price_...
 *   STRIPE_SETUP_FEE_PRICE_ID=price_...
 *
 * Requires STRIPE_SECRET_KEY in .env.local
 */

import "dotenv/config";
import Stripe from "stripe";

// Parse CLI args for custom pricing (in cents)
const monthlyAmount = parseInt(
  process.argv.find((a) => a.startsWith("--monthly="))?.split("=")[1] ?? "19900"
);
const setupAmount = parseInt(
  process.argv.find((a) => a.startsWith("--setup="))?.split("=")[1] ?? "49900"
);

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("ERROR: STRIPE_SECRET_KEY not set. Add it to .env.local");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith("sk_test_");

  console.log("=== HeavyLeads Stripe Seed ===");
  console.log(`Mode: ${isTestMode ? "TEST" : "LIVE"}\n`);

  // 1. Find or create product
  let product: Stripe.Product | null = null;

  const existingProducts = await stripe.products.list({ limit: 100 });
  product = existingProducts.data.find(
    (p) => p.name === "HeavyLeads Standard" && p.active
  ) ?? null;

  if (product) {
    console.log(`Product exists: ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: "HeavyLeads Standard",
      description:
        "Daily construction lead intelligence — multi-source scraping, equipment matching, and relevance scoring for heavy machinery sales teams.",
    });
    console.log(`Product created: ${product.id} (${product.name})`);
  }

  // 2. Find or create monthly recurring price
  let monthlyPrice: Stripe.Price | null = null;

  const existingPrices = await stripe.prices.list({
    product: product.id,
    limit: 100,
  });

  monthlyPrice = existingPrices.data.find(
    (p) =>
      p.active &&
      p.type === "recurring" &&
      p.recurring?.interval === "month" &&
      p.unit_amount === monthlyAmount
  ) ?? null;

  if (monthlyPrice) {
    console.log(
      `Monthly price exists: ${monthlyPrice.id} ($${(monthlyAmount / 100).toFixed(2)}/mo)`
    );
  } else {
    monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: monthlyAmount,
      recurring: { interval: "month" },
      lookup_key: "heavyleads_standard_monthly",
    });
    console.log(
      `Monthly price created: ${monthlyPrice.id} ($${(monthlyAmount / 100).toFixed(2)}/mo)`
    );
  }

  // 3. Find or create one-time setup fee price
  let setupPrice: Stripe.Price | null = null;

  setupPrice = existingPrices.data.find(
    (p) =>
      p.active &&
      p.type === "one_time" &&
      p.unit_amount === setupAmount
  ) ?? null;

  if (setupPrice) {
    console.log(
      `Setup fee exists: ${setupPrice.id} ($${(setupAmount / 100).toFixed(2)} one-time)`
    );
  } else {
    setupPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: setupAmount,
      lookup_key: "heavyleads_setup_fee",
    });
    console.log(
      `Setup fee created: ${setupPrice.id} ($${(setupAmount / 100).toFixed(2)} one-time)`
    );
  }

  // 4. Output env vars
  console.log("\n=== Add these to your .env.local ===\n");
  console.log(`STRIPE_MONTHLY_PRICE_ID=${monthlyPrice.id}`);
  console.log(`STRIPE_SETUP_FEE_PRICE_ID=${setupPrice.id}`);

  // 5. Webhook reminder
  console.log("\n=== Webhook Setup ===\n");
  console.log("In Stripe Dashboard → Webhooks → Add Endpoint:");
  console.log("  URL: https://your-domain.com/api/auth/stripe/webhook");
  console.log("  Events: checkout.session.completed, customer.subscription.updated,");
  console.log("          customer.subscription.deleted, invoice.paid, invoice.payment_failed");
  console.log("\nCopy the signing secret to: STRIPE_WEBHOOK_SECRET=whsec_...");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
