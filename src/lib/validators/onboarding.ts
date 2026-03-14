import { z } from "zod";
import { EQUIPMENT_TYPES } from "@/types";

export { EQUIPMENT_TYPES };

export const locationSchema = z.object({
  hqAddress: z.string().min(5, "Please enter a valid address"),
});

export const equipmentSchema = z.object({
  equipmentTypes: z
    .array(z.string())
    .min(1, "Select at least one equipment type"),
});

export const radiusSchema = z.object({
  serviceRadius: z
    .number()
    .min(10, "Minimum 10 miles")
    .max(500, "Maximum 500 miles"),
});

export const onboardingSchema = z.object({
  hqAddress: z.string().min(5, "Please enter a valid address"),
  equipmentTypes: z
    .array(z.string())
    .min(1, "Select at least one equipment type"),
  serviceRadius: z
    .number()
    .min(10, "Minimum 10 miles")
    .max(500, "Maximum 500 miles"),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
