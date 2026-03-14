import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { eq, or, and } from "drizzle-orm";

/**
 * Query the subscription table for an active or trialing subscription
 * belonging to the given organization.
 *
 * @returns The subscription row or null if none found.
 */
export async function getActiveSubscription(organizationId: string) {
  const sub = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, organizationId),
      or(
        eq(subscription.status, "active"),
        eq(subscription.status, "trialing")
      )
    ),
  });
  return sub ?? null;
}
