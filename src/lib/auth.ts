import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { member } from "./db/schema/auth";
import { eq, and } from "drizzle-orm";
import { stripeClient, PRICES } from "./stripe";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 50,
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
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
            name: "standard",
            priceId: PRICES.monthlySubscription,
          },
        ],
        getCheckoutSessionParams: async ({ plan, subscription }) => {
          // Only charge setup fee for first-time subscribers.
          // IMPORTANT: params.line_items OVERRIDES the plugin's line_items
          // (due to object spread order in the plugin source), so we must
          // include the recurring subscription price alongside the setup fee.
          const isFirstTime = !subscription?.stripeSubscriptionId;

          if (isFirstTime) {
            return {
              params: {
                line_items: [
                  { price: plan.priceId, quantity: 1 },
                  { price: PRICES.setupFee, quantity: 1 },
                ],
              },
            };
          }
          return {};
        },
      },
      organization: { enabled: true },
    }),
    nextCookies(), // MUST be last plugin
  ],
});
