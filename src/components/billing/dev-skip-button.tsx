"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDevSubscription } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DevSkipButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSkip = async () => {
    setLoading(true);
    try {
      await createDevSubscription();
      toast.success("Dev subscription created. Redirecting...");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to create dev subscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={handleSkip}
      className="border-dashed"
    >
      {loading ? "Creating..." : "Skip (Dev Only)"}
    </Button>
  );
}
