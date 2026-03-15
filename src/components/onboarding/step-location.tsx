"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OnboardingFormData } from "@/lib/validators/onboarding";
import { US_STATES } from "@/lib/validators/onboarding";

export function StepLocation() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  const stateValue = watch("state") ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Company Headquarters Address
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use this to find construction leads near your location
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="street">Street Address</Label>
          <Input
            id="street"
            placeholder="123 Main St"
            {...register("street")}
          />
          {errors.street && (
            <p className="text-sm text-destructive">
              {errors.street.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Dallas"
              {...register("city")}
            />
            {errors.city && (
              <p className="text-sm text-destructive">
                {errors.city.message}
              </p>
            )}
          </div>

          <div className="col-span-1 space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={stateValue}
              onValueChange={(val) => setValue("state", val ?? "", { shouldValidate: true })}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="TX" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && (
              <p className="text-sm text-destructive">
                {errors.state.message}
              </p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="zip">ZIP Code</Label>
            <Input
              id="zip"
              placeholder="75201"
              maxLength={10}
              {...register("zip")}
            />
            {errors.zip && (
              <p className="text-sm text-destructive">
                {errors.zip.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
