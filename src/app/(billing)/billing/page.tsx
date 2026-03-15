import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSubscription } from "@/lib/billing";
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
  const subscription = await getActiveSubscription(organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and payment details
        </p>
      </div>

      {subscription ? (
        <div className="space-y-4">
          <BillingStatus
            subscription={{
              plan: subscription.plan,
              status: subscription.status ?? "unknown",
              periodEnd: subscription.periodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
            }}
          />
          <ManageBillingButton />
        </div>
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
