"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EQUIPMENT_TYPES, type OnboardingFormData } from "@/lib/validators/onboarding";

export function StepEquipment() {
  const {
    control,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Equipment Types</h2>
        <p className="text-sm text-muted-foreground">
          Select the equipment types you sell or rent
        </p>
      </div>

      <Controller
        name="equipmentTypes"
        control={control}
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {EQUIPMENT_TYPES.map((type) => {
              const isChecked = field.value?.includes(type) ?? false;
              return (
                <label
                  key={type}
                  className="flex cursor-pointer items-center space-x-2 rounded-md border p-3 hover:bg-accent"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const current = field.value ?? [];
                      if (checked) {
                        field.onChange([...current, type]);
                      } else {
                        field.onChange(
                          current.filter((t: string) => t !== type)
                        );
                      }
                    }}
                  />
                  <Label className="cursor-pointer text-sm font-normal">
                    {type}
                  </Label>
                </label>
              );
            })}
          </div>
        )}
      />

      {errors.equipmentTypes && (
        <p className="text-sm text-destructive">
          {errors.equipmentTypes.message}
        </p>
      )}
    </div>
  );
}
