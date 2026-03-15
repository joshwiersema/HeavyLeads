"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/**
 * Pipeline progress indicator.
 *
 * Displays a card with a spinner and status message while the
 * scraping pipeline is running. Polls /api/scraper/status every
 * 10 seconds and triggers a page refresh when the pipeline completes.
 */
export function PipelineProgress() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scraper/status");
        if (!res.ok) return;

        const data = await res.json();
        if (!data.isRunning) {
          // Pipeline completed -- refresh the page to show new leads
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          router.refresh();
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 10_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="size-5 animate-spin text-primary" />
          Searching for leads in your area...
        </CardTitle>
        <CardDescription>
          This usually takes 2-3 minutes. The page will refresh automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/50" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
