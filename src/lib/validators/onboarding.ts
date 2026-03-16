import { z } from "zod";
import { EQUIPMENT_TYPES } from "@/types";

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility (old wizard + completeOnboarding)
// ---------------------------------------------------------------------------

export { EQUIPMENT_TYPES };

export const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
] as const;

// ---- Legacy per-step schemas (old 3-step wizard) ----

export const locationSchema = z.object({
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "Select a state"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
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
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "Select a state"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  equipmentTypes: z
    .array(z.string())
    .min(1, "Select at least one equipment type"),
  serviceRadius: z
    .number()
    .min(10, "Minimum 10 miles")
    .max(500, "Maximum 500 miles"),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

/** Compose structured address fields into a single geocoding string. */
export function composeAddress(fields: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): string {
  return `${fields.street}, ${fields.city}, ${fields.state} ${fields.zip}`;
}

// ---------------------------------------------------------------------------
// New per-step schemas for the 6-step industry-aware wizard
// ---------------------------------------------------------------------------

export const industrySchema = z.object({
  industry: z.enum(
    ["heavy_equipment", "hvac", "roofing", "solar", "electrical"],
    { message: "Please select your industry" },
  ),
});

export const companyBasicsSchema = z.object({
  companyName: z.string().min(2, "Company name is required").max(100),
  companySize: z.string().min(1, "Select company size"),
  yearsInBusiness: z.coerce.number().int().min(0).max(200).nullable(),
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "Select a state"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
});

export const serviceAreaSchema = z.object({
  serviceRadiusMiles: z
    .number()
    .min(10, "Minimum 10 miles")
    .max(500, "Maximum 500 miles"),
  serviceAreaLat: z.number().nullable(),
  serviceAreaLng: z.number().nullable(),
});

export const specializationsSchema = z.object({
  specializations: z
    .array(z.string())
    .min(1, "Select at least one specialization"),
  serviceTypes: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

export const leadPreferencesSchema = z.object({
  minProjectValue: z.coerce.number().int().min(0).nullable(),
  maxProjectValue: z.coerce.number().int().min(0).nullable(),
  preferredLeadTypes: z
    .array(z.string())
    .min(1, "Select at least one lead type"),
  alertFrequency: z.enum(["realtime", "daily", "weekly"]),
});

// Review step has no additional fields -- it just shows a summary.
// We still export a schema so getStepSchema can return one uniformly.
export const reviewSchema = z.object({});

// ---------------------------------------------------------------------------
// Step-index to schema mapping
// ---------------------------------------------------------------------------

const STEP_SCHEMAS: Record<number, z.ZodTypeAny> = {
  0: industrySchema,
  1: companyBasicsSchema,
  2: serviceAreaSchema,
  3: specializationsSchema,
  4: leadPreferencesSchema,
  5: reviewSchema,
};

/** Return the Zod schema for the given step index (0-based). */
export function getStepSchema(step: number): z.ZodTypeAny {
  return STEP_SCHEMAS[step] ?? reviewSchema;
}
