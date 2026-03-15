import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSubscription, getTrialStatus } from "@/lib/billing";
import { db } from "@/lib/db";
import { subscription as subscriptionTable } from "@/lib/db/schema/subscriptions";
import { eq, desc } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SubscribeButton } from "@/components/billing/subscribe-button";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { BillingStatus } from "@/components/billing/billing-status";
import { TrialEndedCard } from "@/components/billing/trial-ended-card";
import { DevSkipButton } from "@/components/billing/dev-skip-button";

export const metadata = {
  title: "Billing | HeavyLeads",
};

export default async function BillingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    redirect("/sign-in");
  }

  const organizationId = session.session.activeOrganizationId;
  const activeSubscription = await getActiveSubscription(organizationId);

  // Check for any subscription (including expired trials) if no active one exists
  let showTrialEnded = false;
  if (!activeSubscription) {
    const latestSubscription = await db.query.subscription.findFirst({
      where: eq(subscriptionTable.referenceId, organizationId),
      orderBy: desc(subscriptionTable.createdAt),
    });
    if (latestSubscription) {
      const trialStatus = getTrialStatus(latestSubscription);
      showTrialEnded = trialStatus.isExpired;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and payment details
        </p>
      </div>

      {activeSubscription ? (
        <div className="space-y-4">
          <BillingStatus
            subscription={{
              plan: activeSubscription.plan,
              status: activeSubscription.status ?? "unknown",
              periodEnd: activeSubscription.periodEnd,
              cancelAtPeriodEnd:
                activeSubscription.cancelAtPeriodEnd ?? false,
            }}
          />
          <ManageBillingButton />
        </div>
      ) : showTrialEnded ? (
        <TrialEndedCard organizationId={organizationId} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Get Started with HeavyLeads</CardTitle>
            <CardDescription>
              Subscribe to access your daily lead feed and equipment matching
              intelligence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                Standard Plan
              </p>
              <p className="text-sm text-muted-foreground">
                Monthly subscription + one-time setup fee
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-primary">&#10003;</span>
                Daily lead feed from multiple sources
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">&#10003;</span>
                Multi-source intelligence aggregation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">&#10003;</span>
                Equipment matching and relevance scoring
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">&#10003;</span>
                Email digests for saved searches
              </li>
            </ul>

            <div className="flex items-center gap-3">
              <SubscribeButton organizationId={organizationId} />
              {process.env.NODE_ENV === "development" && <DevSkipButton />}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
