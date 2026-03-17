"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { organization } from "@/lib/db/schema/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { stripeClient } from "@/lib/stripe";
import { eq } from "drizzle-orm";

/**
 * Ensure the organization has a Stripe customer ID before attempting
 * subscription checkout. The Better Auth Stripe plugin's internal
 * customer creation uses `customers.search` which can fail on some
 * Stripe API versions or test accounts. This pre-creates the customer
 * directly via the Stripe API, bypassing that fragile path.
 */
export async function ensureStripeCustomer() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return { error: "No active organization" };
  }

  const orgId = session.session.activeOrganizationId;

  // Check if org already has a Stripe customer
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  if (!org) {
    return { error: "Organization not found" };
  }

  if (org.stripeCustomerId) {
    return { customerId: org.stripeCustomerId };
  }

  // Create Stripe customer for the org
  try {
    const customer = await stripeClient.customers.create(
      {
        name: org.name,
        email: session.user.email,
        metadata: {
          org_id: orgId,
          customerType: "organization",
        },
      },
      { idempotencyKey: `create-customer-${orgId}` }
    );

    // Save to org record so the plugin finds it on upgrade
    await db
      .update(organization)
      .set({ stripeCustomerId: customer.id })
      .where(eq(organization.id, orgId));

    console.log(
      `[billing] Created Stripe customer ${customer.id} for org ${orgId}`
    );

    return { customerId: customer.id };
  } catch (err) {
    console.error("[billing] Failed to create Stripe customer:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to create Stripe customer",
    };
  }
}

/**
 * Creates a mock active subscription so the user can explore the dashboard
 * without going through Stripe checkout.
 *
 * Gated by NEXT_PUBLIC_DEV_ACCESS=true. To disable, remove or unset the env var.
 */
export async function createDevSubscription() {
  if (process.env.NEXT_PUBLIC_DEV_ACCESS !== "true") {
    throw new Error("Dev subscriptions are not enabled");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await db.insert(subscription).values({
    id: randomUUID(),
    plan: "standard",
    referenceId: session.session.activeOrganizationId,
    stripeCustomerId: "dev_mock_customer",
    stripeSubscriptionId: "dev_mock_subscription",
    status: "active",
    periodStart: now,
    periodEnd,
    cancelAtPeriodEnd: false,
  });

  revalidatePath("/");

  return { success: true };
}
