import { z } from "zod";

export const accountSettingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

export const companySettingsSchema = z.object({
  hqAddress: z.string().min(5, "Please enter a valid address"),
  equipmentTypes: z
    .array(z.string())
    .min(1, "Select at least one equipment type"),
  serviceRadius: z
    .number()
    .min(10, "Minimum 10 miles")
    .max(500, "Maximum 500 miles"),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
