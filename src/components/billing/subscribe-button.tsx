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
        successUrl: "/dashboard",
        cancelUrl: "/billing",
        referenceId: organizationId,
        customerType: "organization",
      });

      if (error) {
        toast.error("Failed to start checkout. Please try again.");
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button size="lg" disabled={loading} onClick={handleSubscribe}>
      {loading ? "Redirecting..." : "Subscribe Now"}
    </Button>
  );
}
