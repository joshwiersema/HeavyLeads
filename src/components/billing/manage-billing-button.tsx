"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.subscription.billingPortal({
        returnUrl: `${window.location.origin}/billing`,
      });

      if (error) {
        toast.error("Failed to open billing portal. Please try again.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      toast.error("Unable to open billing portal. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" disabled={loading} onClick={handleManage}>
      {loading ? "Redirecting..." : "Manage Billing"}
    </Button>
  );
}
