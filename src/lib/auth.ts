import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { member, organization as orgTable } from "./db/schema/auth";
import { eq, and } from "drizzle-orm";
import { stripeClient, PRICES } from "./stripe";
import { buildCheckoutSessionParams } from "./billing";
import { PasswordResetEmail } from "@/components/emails/password-reset";

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
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const { Resend } = await import("resend");

      const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
      if (!apiKey) {
        console.error(
          "[auth] RESEND_API_KEY not set, cannot send password reset email"
        );
        throw new Error("Email service not configured");
      }

      const resend = new Resend(apiKey);
      const from =
        (process.env.RESEND_FROM_EMAIL ?? "").trim() ||
        "HeavyLeads <onboarding@resend.dev>";

      await resend.emails.send({
        from,
        to: user.email,
        subject: "Reset your HeavyLeads password",
        react: PasswordResetEmail({ url, userName: user.name }),
      });

      console.log("[auth] Password reset email sent to", user.email);
    },
  },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 50,
      schema: {
        organization: {
          additionalFields: {
            industry: {
              type: "string",
              required: false,
              defaultValue: "heavy_equipment",
              input: true,
            },
          },
        },
      },
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
          let industry: string | undefined;
          if (subscription?.referenceId) {
            const org = await db.query.organization.findFirst({
              where: eq(orgTable.id, subscription.referenceId),
              columns: { industry: true },
            });
            industry = org?.industry ?? undefined;
          }
          return buildCheckoutSessionParams(plan, subscription, industry);
        },
      },
      organization: { enabled: true },
    }),
    nextCookies(), // MUST be last plugin
  ],
});
