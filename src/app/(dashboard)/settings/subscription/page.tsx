import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSubscription, getTrialStatus } from "@/lib/billing";
import { BillingStatus } from "@/components/billing/billing-status";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function SubscriptionSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    redirect("/sign-in");
  }

  const organizationId = session.session.activeOrganizationId;
  const activeSubscription = await getActiveSubscription(organizationId);

  if (!activeSubscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>No active subscription found</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <CreditCard className="size-4" />
            Go to billing to subscribe
            <ExternalLink className="size-3" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const trialStatus = getTrialStatus(activeSubscription);

  return (
    <div className="space-y-6">
      <BillingStatus
        subscription={{
          plan: activeSubscription.plan,
          status: activeSubscription.status ?? "unknown",
          periodEnd: activeSubscription.periodEnd,
          cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd ?? false,
        }}
      />

      {trialStatus.isTrialing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trial Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Trialing</Badge>
              <span className="text-sm text-muted-foreground">
                {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
            {trialStatus.trialEnd && (
              <p className="text-sm text-muted-foreground">
                Trial ends:{" "}
                {trialStatus.trialEnd.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment & Invoices</CardTitle>
          <CardDescription>
            Manage your payment method, view invoices, or cancel your subscription
            through the Stripe customer portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManageBillingButton />
        </CardContent>
      </Card>
    </div>
  );
}
