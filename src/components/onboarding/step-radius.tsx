"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingFormData } from "@/lib/validators/onboarding";

export function StepRadius() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  const currentRadius = watch("serviceRadius");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Service Radius</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll show you leads within this distance from your HQ
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceRadius">Service Radius (miles)</Label>
        <Input
          id="serviceRadius"
          type="number"
          min={10}
          max={500}
          {...register("serviceRadius", { valueAsNumber: true })}
        />
        <p className="text-lg font-medium text-primary">
          {currentRadius ?? 50} miles
        </p>
        {errors.serviceRadius && (
          <p className="text-sm text-destructive">
            {errors.serviceRadius.message}
          </p>
        )}
      </div>
    </div>
  );
}
