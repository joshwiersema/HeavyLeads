"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
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

              function toggle() {
                const current = field.value ?? [];
                field.onChange(
                  isChecked
                    ? current.filter((t: string) => t !== type)
                    : [...current, type]
                );
              }

              return (
                <div
                  key={type}
                  className="flex cursor-pointer items-center space-x-2 rounded-md border p-3 hover:bg-accent"
                  onClick={(e) => {
                    // Only handle clicks on the row background/text.
                    // Clicks on the Checkbox itself are handled by onCheckedChange.
                    const target = e.target as HTMLElement;
                    if (target.closest("[data-slot='checkbox']") || target.tagName === "INPUT") return;
                    toggle();
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle()}
                  />
                  <span className="cursor-pointer text-sm font-normal">
                    {type}
                  </span>
                </div>
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
