"use client";

import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SubscribeButton } from "@/components/billing/subscribe-button";

export function TrialEndedCard({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <CardTitle>Your Trial Has Ended</CardTitle>
        </div>
        <CardDescription>
          Subscribe to continue accessing your daily lead feed and equipment
          matching intelligence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-primary">&#10003;</span>
            Daily lead feed from multiple sources
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">&#10003;</span>
            Multi-source intelligence aggregation
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">&#10003;</span>
            Equipment matching and relevance scoring
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">&#10003;</span>
            Email digests for saved searches
          </li>
        </ul>

        <SubscribeButton organizationId={organizationId} />
      </CardContent>
    </Card>
  );
}
