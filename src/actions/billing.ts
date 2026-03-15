"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

/**
 * Creates a mock active subscription so the user can explore the dashboard
 * without going through Stripe checkout. Only works in development.
 */
export async function createDevSubscription() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev subscriptions are only available in development mode");
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
