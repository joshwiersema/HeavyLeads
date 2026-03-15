"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-trigger component for first-login pipeline fire.
 *
 * Renders nothing visible. On mount, fires a POST request to
 * /api/scraper/run with triggerType "first-login" to kick off
 * the scraping pipeline. Then refreshes the page so the server
 * component picks up the running pipeline and shows the progress
 * indicator.
 *
 * This is a fire-and-forget pattern -- the pipeline runs in the
 * background and the PipelineProgress component handles polling.
 */
export function AutoTrigger() {
  const router = useRouter();
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    fetch("/api/scraper/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggerType: "first-login" }),
    })
      .then(() => {
        // Refresh the page to show the progress indicator
        router.refresh();
      })
      .catch(() => {
        // Silently fail -- worst case the user can click Refresh Leads
      });
  }, [router]);

  return null;
}
