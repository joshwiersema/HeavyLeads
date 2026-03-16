"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { INDUSTRY_CONFIG } from "@/lib/onboarding/config";
import type { WizardState, WizardAction } from "@/lib/onboarding/types";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Reusable checkbox grid for an array-valued wizard field
// ---------------------------------------------------------------------------

function CheckboxGrid({
  label,
  options,
  selected,
  field,
  dispatch,
  required,
}: {
  label: string;
  options: string[];
  selected: string[];
  field: keyof WizardState;
  dispatch: React.Dispatch<WizardAction>;
  required?: boolean;
}) {
  function toggle(option: string) {
    const next = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    dispatch({ type: "SET_FIELD", field, value: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">{label}</h3>
        {required ? (
          <span className="text-xs text-muted-foreground">
            ({selected.length} selected)
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">(optional)</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const isChecked = selected.includes(option);

          return (
            <div
              key={option}
              className={`flex cursor-pointer items-center space-x-2 rounded-md border p-3 transition hover:bg-accent ${
                isChecked ? "border-primary bg-primary/5" : ""
              }`}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest("[data-slot='checkbox']") ||
                  target.tagName === "INPUT"
                )
                  return;
                toggle(option);
              }}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggle(option)}
              />
              <span className="cursor-pointer text-sm font-normal">
                {option}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Specializations step -- main export
// ---------------------------------------------------------------------------

export function Specializations({ state, dispatch }: WizardStepProps) {
  if (!state.industry) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Please go back and select your industry first.
        </p>
      </div>
    );
  }

  const config = INDUSTRY_CONFIG[state.industry];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Specializations</h2>
        <p className="text-sm text-muted-foreground">
          Tell us what you specialize in so we can find the most relevant leads
        </p>
      </div>

      <CheckboxGrid
        label="Specializations"
        options={config.specializations}
        selected={state.specializations}
        field="specializations"
        dispatch={dispatch}
        required
      />

      <CheckboxGrid
        label="Service Types"
        options={config.serviceTypes}
        selected={state.serviceTypes}
        field="serviceTypes"
        dispatch={dispatch}
      />

      <CheckboxGrid
        label="Certifications"
        options={config.certifications}
        selected={state.certifications}
        field="certifications"
        dispatch={dispatch}
      />
    </div>
  );
}
