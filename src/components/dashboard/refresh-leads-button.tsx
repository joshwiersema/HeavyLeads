"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Refresh Leads button.
 *
 * Triggers an on-demand pipeline run via POST /api/scraper/run.
 * Shows loading state during the request, handles rate limiting
 * (429) with a cooldown timer, and provides toast feedback.
 */
export function RefreshLeadsButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null);

  const handleRefresh = useCallback(async () => {
    if (isLoading || cooldownMinutes !== null) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });

      if (res.status === 429) {
        const data = await res.json();
        if (data.nextAllowedAt) {
          const nextAllowed = new Date(data.nextAllowedAt);
          const minutesLeft = Math.max(
            1,
            Math.ceil((nextAllowed.getTime() - Date.now()) / (60 * 1000))
          );
          setCooldownMinutes(minutesLeft);
          toast.error(`Rate limited. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`);

          // Clear cooldown after the remaining time
          setTimeout(() => {
            setCooldownMinutes(null);
          }, minutesLeft * 60 * 1000);
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to start pipeline.");
        return;
      }

      toast.success("Pipeline started! New leads will appear shortly.");

      // Refresh the page after a short delay to pick up the progress indicator
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, cooldownMinutes, router]);

  const isDisabled = isLoading || cooldownMinutes !== null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isDisabled}
    >
      <RefreshCw
        className={`size-4 ${isLoading ? "animate-spin" : ""}`}
        data-icon="inline-start"
      />
      {isLoading
        ? "Refreshing..."
        : cooldownMinutes !== null
          ? `Available in ${cooldownMinutes}m`
          : "Refresh Leads"}
    </Button>
  );
}
