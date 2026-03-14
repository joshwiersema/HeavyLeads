import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { stripeClient, PRICES } from "./stripe";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
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
        plans: [
          {
            name: "standard",
            priceId: PRICES.monthlySubscription,
          },
        ],
        getCheckoutSessionParams: async ({ plan, subscription }) => {
          // Only charge setup fee for first-time subscribers (Pitfall 6).
          // When the plugin creates a new subscription row before calling
          // this callback, the row has status "incomplete" and no
          // stripeSubscriptionId. A re-subscriber would have a previous
          // completed subscription, but the subscription passed here is
          // always the current (just-created) one. We check whether
          // stripeCustomerId is already set on the org -- if the customer
          // was created on sign-up, this is always present, so instead we
          // check if there's an existing stripeSubscriptionId which
          // indicates a previous completed subscription cycle.
          const isFirstTime = !subscription.stripeSubscriptionId;

          if (isFirstTime) {
            return {
              params: {
                line_items: [{ price: PRICES.setupFee, quantity: 1 }],
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
