import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Clock, Sparkles, Search } from "lucide-react";
import Link from "next/link";
import { RefreshLeadsButton } from "@/components/dashboard/refresh-leads-button";

interface EmptyStateProps {
  hasFilters: boolean;
  pipelineRunning: boolean;
  hasEverHadLeads: boolean;
}

/**
 * Context-aware empty state for the dashboard.
 *
 * Displays different messaging depending on why no leads are showing:
 * 1. Pipeline is running -- show progress message
 * 2. New user, never had leads -- welcome message with refresh button
 * 3. Filters are active -- suggest adjusting filters
 * 4. Default -- no leads available, show next scheduled run
 */
export function DashboardEmptyState({
  hasFilters,
  pipelineRunning,
  hasEverHadLeads,
}: EmptyStateProps) {
  if (pipelineRunning) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            Finding leads for you...
          </CardTitle>
          <CardDescription>
            We are searching for construction projects, permits, and bids in
            your area. This usually takes 2-3 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The page will refresh automatically when new leads are found.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasEverHadLeads) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Welcome to GroundPulse!
          </CardTitle>
          <CardDescription>
            Your lead pipeline is being set up. Click the button below to start
            searching for leads in your area, or wait for the next automatic
            update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RefreshLeadsButton />
          <p className="text-sm text-muted-foreground">
            Leads are automatically updated daily at 6:00 AM UTC.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (hasFilters) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-muted-foreground" />
            No leads match your filters
          </CardTitle>
          <CardDescription>
            Try adjusting your search criteria to see more results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Expand your search radius</li>
            <li>Clear equipment filters to see all lead types</li>
            <li>
              Check your{" "}
              <Link
                href="/settings"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                company settings
              </Link>{" "}
              to verify your service area
            </li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Default: no leads available
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          No leads available yet
        </CardTitle>
        <CardDescription>
          New leads are discovered automatically every day. Check back soon!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Daily automatic updates run at 6:00 AM UTC. You can also use the
          Refresh Leads button to search for leads now.
        </p>
      </CardContent>
    </Card>
  );
}
