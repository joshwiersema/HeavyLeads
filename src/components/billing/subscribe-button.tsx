"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ensureStripeCustomer } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SubscribeButtonProps {
  organizationId: string;
  variant?: "trial" | "subscribe";
}

export function SubscribeButton({
  organizationId,
  variant = "trial",
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Pre-create Stripe customer on the org if one doesn't exist.
      // This bypasses the plugin's fragile customers.search path.
      const customerResult = await ensureStripeCustomer();
      if (customerResult.error) {
        console.error("[checkout] Customer creation failed:", customerResult.error);
        toast.error(`Billing setup failed: ${customerResult.error}`);
        return;
      }

      const { data, error } = await authClient.subscription.upgrade({
        plan: "standard",
        successUrl: `${window.location.origin}/dashboard`,
        cancelUrl: `${window.location.origin}/billing`,
        referenceId: organizationId,
        customerType: "organization",
      });

      if (error) {
        console.error("[checkout] Upgrade error:", error);
        toast.error(error.message || "Failed to start checkout. Please try again.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      console.error("[checkout] No URL returned from upgrade call");
      toast.error("Unable to create checkout session. Please try again.");
    } catch (err) {
      console.error("[checkout] Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const label = variant === "trial" ? "Start Free Trial" : "Subscribe Now";
  const loadingLabel = "Redirecting to checkout...";

  return (
    <Button size="lg" disabled={loading} onClick={handleSubscribe}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? loadingLabel : label}
    </Button>
  );
}
