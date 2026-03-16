"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDUSTRY_CONFIG, ALERT_FREQUENCIES } from "@/lib/onboarding/config";
import type { WizardState, WizardAction } from "@/lib/onboarding/types";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Lead Preferences step -- main export
// ---------------------------------------------------------------------------

export function LeadPreferences({ state, dispatch }: WizardStepProps) {
  const leadTypes = state.industry
    ? INDUSTRY_CONFIG[state.industry].leadTypes
    : [];

  function toggleLeadType(lt: string) {
    const next = state.preferredLeadTypes.includes(lt)
      ? state.preferredLeadTypes.filter((t) => t !== lt)
      : [...state.preferredLeadTypes, lt];
    dispatch({ type: "SET_FIELD", field: "preferredLeadTypes", value: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Lead Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Configure what kind of leads you want to receive
        </p>
      </div>

      {/* ---- Project Value Range ---- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Project Value Range</h3>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minProjectValue">Min Value ($)</Label>
            <Input
              id="minProjectValue"
              type="number"
              min={0}
              placeholder="0"
              value={state.minProjectValue ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                dispatch({
                  type: "SET_FIELD",
                  field: "minProjectValue",
                  value: raw === "" ? null : parseInt(raw, 10),
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxProjectValue">Max Value ($)</Label>
            <Input
              id="maxProjectValue"
              type="number"
              min={0}
              placeholder="No limit"
              value={state.maxProjectValue ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                dispatch({
                  type: "SET_FIELD",
                  field: "maxProjectValue",
                  value: raw === "" ? null : parseInt(raw, 10),
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* ---- Preferred Lead Types ---- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Preferred Lead Types</h3>
          <span className="text-xs text-muted-foreground">
            ({state.preferredLeadTypes.length} selected)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {leadTypes.map((lt) => {
            const isChecked = state.preferredLeadTypes.includes(lt);

            return (
              <div
                key={lt}
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
                  toggleLeadType(lt);
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleLeadType(lt)}
                />
                <span className="cursor-pointer text-sm font-normal">{lt}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Alert Frequency ---- */}
      <div className="space-y-3">
        <h3 className="text-base font-medium">Alert Frequency</h3>
        <div className="space-y-2">
          {ALERT_FREQUENCIES.map((freq) => {
            const isSelected = state.alertFrequency === freq.value;

            return (
              <button
                key={freq.value}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "alertFrequency",
                    value: freq.value,
                  })
                }
                className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition hover:bg-accent ${
                  isSelected ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {isSelected && (
                    <div className="m-auto mt-[3px] h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{freq.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {freq.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
