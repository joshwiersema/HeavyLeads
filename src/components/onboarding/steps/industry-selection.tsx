"use client";

import { Check, HardHat, Thermometer, Home, Sun, Zap } from "lucide-react";
import { INDUSTRIES, type WizardState, type WizardAction } from "@/lib/onboarding/types";
import type { Industry } from "@/lib/onboarding/types";
import type { LucideIcon } from "lucide-react";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

/** Map lucide icon name string to component. */
const ICON_MAP: Record<string, LucideIcon> = {
  "hard-hat": HardHat,
  thermometer: Thermometer,
  home: Home,
  sun: Sun,
  zap: Zap,
};

export function IndustrySelection({ state, dispatch }: WizardStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">What industry are you in?</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll tailor your experience based on your industry
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((industry) => {
          const isSelected = state.industry === industry.id;
          const Icon = ICON_MAP[industry.icon];

          return (
            <button
              key={industry.id}
              type="button"
              onClick={() =>
                dispatch({
                  type: "SET_FIELD",
                  field: "industry",
                  value: industry.id as Industry,
                })
              }
              className={`relative flex cursor-pointer flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
            >
              {isSelected && (
                <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />
              )}
              {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
              <div>
                <p className="font-medium">{industry.label}</p>
                <p className="text-sm text-muted-foreground">
                  {industry.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
