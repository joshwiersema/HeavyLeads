import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSubscription, getTrialStatus } from "@/lib/billing";
import { db } from "@/lib/db";
import { subscription as subscriptionTable } from "@/lib/db/schema/subscriptions";
import { eq, desc } from "drizzle-orm";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { BillingStatus } from "@/components/billing/billing-status";
import { TrialEndedCard } from "@/components/billing/trial-ended-card";
import { PlanSelector } from "@/components/billing/plan-selector";
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
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Get Started with HeavyLeads</h2>
            <p className="text-muted-foreground">
              Choose the plan that works best for you
            </p>
          </div>
          <PlanSelector
            organizationId={organizationId}
            monthlyPrice={process.env.NEXT_PUBLIC_MONTHLY_PRICE}
            setupFee={process.env.NEXT_PUBLIC_SETUP_FEE}
          />
          {/* DEV_ACCESS: skip billing for demo/testing — remove this block for production */}
          {process.env.NEXT_PUBLIC_DEV_ACCESS === "true" && (
            <div className="flex justify-center">
              <DevSkipButton />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
