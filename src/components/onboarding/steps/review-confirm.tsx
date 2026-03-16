"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDUSTRIES } from "@/lib/onboarding/types";
import { ALERT_FREQUENCIES } from "@/lib/onboarding/config";
import type { WizardState, WizardAction } from "@/lib/onboarding/types";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Section wrapper with an edit button
// ---------------------------------------------------------------------------

function Section({
  title,
  stepIndex,
  dispatch,
  children,
}: {
  title: string;
  stepIndex: number;
  dispatch: React.Dispatch<WizardAction>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => dispatch({ type: "SET_STEP", step: stepIndex })}
        >
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: format a list for display
// ---------------------------------------------------------------------------

function ListDisplay({ items, fallback }: { items: string[]; fallback: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{fallback}</p>;
  return <p className="text-sm">{items.join(", ")}</p>;
}

// ---------------------------------------------------------------------------
// Review & Confirm step -- main export
// ---------------------------------------------------------------------------

export function ReviewConfirm({ state, dispatch }: WizardStepProps) {
  const industryOption = INDUSTRIES.find((i) => i.id === state.industry);
  const alertFreq = ALERT_FREQUENCIES.find(
    (f) => f.value === state.alertFrequency,
  );

  const fullAddress = [state.street, state.city, state.state, state.zip]
    .filter(Boolean)
    .join(", ");

  const valueRange =
    state.minProjectValue != null || state.maxProjectValue != null
      ? `$${(state.minProjectValue ?? 0).toLocaleString()} - ${
          state.maxProjectValue != null
            ? `$${state.maxProjectValue.toLocaleString()}`
            : "No limit"
        }`
      : "Any";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Review & Confirm</h2>
        <p className="text-sm text-muted-foreground">
          Make sure everything looks right before completing setup
        </p>
      </div>

      {/* Industry */}
      <Section title="Industry" stepIndex={0} dispatch={dispatch}>
        <p className="text-sm font-medium">
          {industryOption?.label ?? state.industry ?? "Not selected"}
        </p>
      </Section>

      {/* Company Details */}
      <Section title="Company Details" stepIndex={1} dispatch={dispatch}>
        <p className="text-sm font-medium">{state.companyName || "Not set"}</p>
        <p className="text-sm text-muted-foreground">
          {state.companySize || "Size not set"}
          {state.yearsInBusiness != null
            ? ` | ${state.yearsInBusiness} years in business`
            : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {fullAddress || "Address not set"}
        </p>
      </Section>

      {/* Service Area */}
      <Section title="Service Area" stepIndex={2} dispatch={dispatch}>
        <p className="text-sm">
          {state.serviceRadiusMiles} mile radius
          {state.serviceAreaLat != null && state.serviceAreaLng != null
            ? ` centered on ${fullAddress || "your location"}`
            : ""}
        </p>
      </Section>

      {/* Specializations */}
      <Section title="Specializations" stepIndex={3} dispatch={dispatch}>
        <ListDisplay
          items={state.specializations}
          fallback="None selected"
        />
        {state.serviceTypes.length > 0 && (
          <div className="mt-1">
            <span className="text-xs font-medium text-muted-foreground">
              Service Types:{" "}
            </span>
            <span className="text-xs">{state.serviceTypes.join(", ")}</span>
          </div>
        )}
        {state.certifications.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Certifications:{" "}
            </span>
            <span className="text-xs">{state.certifications.join(", ")}</span>
          </div>
        )}
      </Section>

      {/* Lead Preferences */}
      <Section title="Lead Preferences" stepIndex={4} dispatch={dispatch}>
        <p className="text-sm">
          <span className="font-medium">Value range:</span> {valueRange}
        </p>
        <ListDisplay
          items={state.preferredLeadTypes}
          fallback="No lead types selected"
        />
        <p className="text-sm text-muted-foreground">
          Alerts: {alertFreq?.label ?? state.alertFrequency}
        </p>
      </Section>
    </div>
  );
}
