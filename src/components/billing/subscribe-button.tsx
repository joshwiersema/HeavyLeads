"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SubscribeButton({
  organizationId,
}: {
  organizationId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.subscription.upgrade({
        plan: "standard",
        successUrl: `${window.location.origin}/dashboard`,
        cancelUrl: `${window.location.origin}/billing`,
        referenceId: organizationId,
        customerType: "organization",
      });

      if (error) {
        toast.error(error.message || "Failed to start checkout. Please try again.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      // If we get here, the API returned successfully but without a
      // checkout URL — something is misconfigured on the Stripe side.
      toast.error("Unable to create checkout session. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="lg" disabled={loading} onClick={handleSubscribe}>
      {loading ? "Redirecting..." : "Subscribe Now"}
    </Button>
  );
}
