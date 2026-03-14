import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { companyProfiles } from "@/lib/db/schema/company-profiles";

export const EQUIPMENT_TYPES = [
  "Excavators",
  "Boom Lifts",
  "Forklifts",
  "Telehandlers",
  "Cranes",
  "Skid Steers",
  "Bulldozers",
  "Backhoes",
  "Wheel Loaders",
  "Compactors",
  "Aerial Work Platforms",
  "Generators",
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export type CompanyProfile = InferSelectModel<typeof companyProfiles>;
export type NewCompanyProfile = InferInsertModel<typeof companyProfiles>;
