"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingFormData } from "@/lib/validators/onboarding";

export function StepLocation() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Company Headquarters Address
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use this to find leads near your location
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hqAddress">Address</Label>
        <Input
          id="hqAddress"
          placeholder="123 Main St, City, State, ZIP"
          {...register("hqAddress")}
        />
        {errors.hqAddress && (
          <p className="text-sm text-destructive">
            {errors.hqAddress.message}
          </p>
        )}
      </div>
    </div>
  );
}
