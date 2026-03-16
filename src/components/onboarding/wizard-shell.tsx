"use client";

import { useReducer, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { wizardReducer, initialWizardState } from "@/lib/onboarding/reducer";
import { useWizardPersistence } from "@/lib/onboarding/use-wizard-persistence";
import { WIZARD_STEPS, type WizardState, type WizardAction } from "@/lib/onboarding/types";
import { getStepSchema } from "@/lib/validators/onboarding";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { IndustrySelection } from "./steps/industry-selection";
import { CompanyBasics } from "./steps/company-basics";

// ---------------------------------------------------------------------------
// Step props interface (shared by all step components)
// ---------------------------------------------------------------------------

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Placeholder for steps 3-6 (built in Plan 02)
// ---------------------------------------------------------------------------

function StepPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-muted-foreground/70">Coming in next plan</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map step index to fields required by that step's schema.
// Used to extract the right slice of WizardState for validation.
// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<number, (keyof WizardState)[]> = {
  0: ["industry"],
  1: ["companyName", "companySize", "yearsInBusiness", "street", "city", "state", "zip"],
  2: ["serviceRadiusMiles", "serviceAreaLat", "serviceAreaLng"],
  3: ["specializations", "serviceTypes", "certifications"],
  4: ["minProjectValue", "maxProjectValue", "preferredLeadTypes", "alertFrequency"],
  5: [], // Review step -- no validation needed
};

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, { ...initialWizardState });
  const { isHydrated } = useWizardPersistence(state, dispatch);

  const isLastStep = state.currentStep === WIZARD_STEPS.length - 1;
  const currentStepDef = WIZARD_STEPS[state.currentStep];

  // Build the data slice for validation from state fields
  const validationData = useMemo(() => {
    const fields = STEP_FIELD_MAP[state.currentStep] ?? [];
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      data[f] = state[f];
    }
    return data;
  }, [state]);

  function handleNext() {
    const schema = getStepSchema(state.currentStep);
    const result = schema.safeParse(validationData);

    if (!result.success) {
      const firstError = result.error.issues[0]?.message ?? "Please complete this step";
      toast.error(firstError);
      return;
    }

    dispatch({ type: "NEXT_STEP" });
  }

  function handleBack() {
    dispatch({ type: "PREV_STEP" });
  }

  function handleComplete() {
    // Full completion wired in Plan 02. For now, show a toast and redirect.
    toast.success("Onboarding complete!");
    router.push("/billing");
  }

  // ---- Loading skeleton until sessionStorage hydration completes ----
  if (!isHydrated) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // ---- Render step component ----
  function renderStep() {
    switch (state.currentStep) {
      case 0:
        return <IndustrySelection state={state} dispatch={dispatch} />;
      case 1:
        return <CompanyBasics state={state} dispatch={dispatch} />;
      case 2:
        return <StepPlaceholder label={WIZARD_STEPS[2].label} />;
      case 3:
        return <StepPlaceholder label={WIZARD_STEPS[3].label} />;
      case 4:
        return <StepPlaceholder label={WIZARD_STEPS[4].label} />;
      case 5:
        return <StepPlaceholder label={WIZARD_STEPS[5].label} />;
      default:
        return null;
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Set up your company</CardTitle>
            <CardDescription>
              Step {state.currentStep + 1} of {WIZARD_STEPS.length}:{" "}
              {currentStepDef.label}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {WIZARD_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i <= state.currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {renderStep()}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={state.currentStep === 0}
            >
              Back
            </Button>

            {isLastStep ? (
              <Button type="button" onClick={handleComplete}>
                Complete Setup
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
