"use client";

import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubscribeButton } from "@/components/billing/subscribe-button";

const FEATURES = [
  "Daily lead feed from multiple sources",
  "Multi-source intelligence aggregation",
  "Equipment matching and relevance scoring",
  "Email digests for saved searches",
];

export function PlanSelector({
  organizationId,
  monthlyPrice,
  setupFee,
}: {
  organizationId: string;
  monthlyPrice?: string;
  setupFee?: string;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Free Trial Option */}
      <Card className="relative">
        <CardHeader>
          <CardTitle>Free Trial</CardTitle>
          <CardDescription>
            Try GroundPulse risk-free for 7 days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-3xl font-bold">
              $0 <span className="text-sm font-normal text-muted-foreground">for 7 days</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Then standard pricing applies
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="size-4 text-primary flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <SubscribeButton
            organizationId={organizationId}
            variant="trial"
          />
        </CardContent>
      </Card>

      {/* Subscribe Now Option */}
      <Card className="relative border-primary">
        <div className="absolute -top-3 left-4">
          <Badge>Best Value</Badge>
        </div>
        <CardHeader>
          <CardTitle>Subscribe Now</CardTitle>
          <CardDescription>
            Get started immediately with full access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-3xl font-bold">
              {monthlyPrice ? `${monthlyPrice}/mo` : "Standard Plan"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {setupFee
                ? `${setupFee} one-time setup fee`
                : "Monthly subscription + one-time setup fee"}
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="size-4 text-primary flex-shrink-0" />
                {feature}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Check className="size-4 text-primary flex-shrink-0" />
              Skip the trial — immediate full access
            </li>
          </ul>

          <SubscribeButton
            organizationId={organizationId}
            variant="subscribe"
          />
        </CardContent>
      </Card>
    </div>
  );
}
