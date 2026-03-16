import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { member } from "./db/schema/auth";
import { eq, and } from "drizzle-orm";
import { stripeClient, PRICES } from "./stripe";
import { buildCheckoutSessionParams } from "./billing";

/**
 * Exported config constants for testability.
 * These mirror the values passed to the stripe plugin below.
 */
export const STRIPE_PLUGIN_CONFIG = {
  createCustomerOnSignUp: false,
} as const;

export const SUBSCRIPTION_PLANS = [
  {
    name: "standard",
    priceId: PRICES.monthlySubscription,
    freeTrial: { days: 7 },
  },
] as const;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  baseURL: (process.env.BETTER_AUTH_URL ?? "").trim(),
  trustedOrigins: [(process.env.BETTER_AUTH_URL ?? "").trim()],
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 50,
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim(),
      createCustomerOnSignUp: STRIPE_PLUGIN_CONFIG.createCustomerOnSignUp,
      subscription: {
        enabled: true,
        authorizeReference: async ({ user, referenceId, action }) => {
          // Verify the user is a member of the organization they're
          // trying to manage a subscription for.
          const membership = await db.query.member.findFirst({
            where: and(
              eq(member.userId, user.id),
              eq(member.organizationId, referenceId)
            ),
          });
          return !!membership;
        },
        plans: [
          {
            name: SUBSCRIPTION_PLANS[0].name,
            priceId: SUBSCRIPTION_PLANS[0].priceId,
            freeTrial: { days: SUBSCRIPTION_PLANS[0].freeTrial.days },
          },
        ],
        getCheckoutSessionParams: async ({ plan, subscription }) => {
          return buildCheckoutSessionParams(plan, subscription);
        },
      },
      organization: { enabled: true },
    }),
    nextCookies(), // MUST be last plugin
  ],
});
