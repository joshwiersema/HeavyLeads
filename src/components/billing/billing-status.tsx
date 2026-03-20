import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BillingStatusProps {
  subscription: {
    plan: string;
    status: string;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "default" as const;
    case "trialing":
      return "secondary" as const;
    case "past_due":
      return "destructive" as const;
    case "canceled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past Due";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

export function BillingStatus({ subscription }: BillingStatusProps) {
  const planName =
    subscription.plan === "standard" ? "GroundPulse Standard" : subscription.plan;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Plan</CardTitle>
        <CardDescription>Your subscription details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Plan</span>
          <span className="text-sm">{planName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <Badge
            data-testid="status-badge"
            variant={statusBadgeVariant(subscription.status)}
          >
            {statusLabel(subscription.status)}
          </Badge>
        </div>
        {subscription.periodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {subscription.cancelAtPeriodEnd ? "Access until" : "Next renewal"}
            </span>
            <span className="text-sm">
              {new Date(subscription.periodEnd).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
        {subscription.cancelAtPeriodEnd && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Your subscription has been canceled and will not renew. You will
            retain access until the end of your current billing period.
          </p>
        )}
        {subscription.status === "past_due" && (
          <p className="text-sm text-destructive">
            Your payment failed. Please update your payment method.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
