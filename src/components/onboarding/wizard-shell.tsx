"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  onboardingSchema,
  type OnboardingFormData,
} from "@/lib/validators/onboarding";
import { completeOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StepLocation } from "./step-location";
import { StepEquipment } from "./step-equipment";
import { StepRadius } from "./step-radius";

const STEPS = [
  { component: StepLocation, label: "Location", fields: ["hqAddress"] as const },
  { component: StepEquipment, label: "Equipment", fields: ["equipmentTypes"] as const },
  { component: StepRadius, label: "Radius", fields: ["serviceRadius"] as const },
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      hqAddress: "",
      equipmentTypes: [],
      serviceRadius: 50,
    },
    mode: "onTouched",
  });

  const StepComponent = STEPS[currentStep].component;
  const isLastStep = currentStep === STEPS.length - 1;

  async function handleNext() {
    const fieldsToValidate = STEPS[currentStep].fields;
    const valid = await methods.trigger(
      fieldsToValidate as unknown as (keyof OnboardingFormData)[]
    );
    if (valid) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleBack() {
    setCurrentStep((prev) => prev - 1);
  }

  async function onSubmit(data: OnboardingFormData) {
    setIsSubmitting(true);
    try {
      const result = await completeOnboarding(data);
      if (result.success) {
        toast.success("Onboarding complete! Welcome to HeavyLeads.");
        router.push("/dashboard");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Set up your company</CardTitle>
            <CardDescription>
              Step {currentStep + 1} of {STEPS.length}:{" "}
              {STEPS[currentStep].label}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            <StepComponent />

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </Button>

              {isLastStep ? (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Completing..." : "Complete Setup"}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
