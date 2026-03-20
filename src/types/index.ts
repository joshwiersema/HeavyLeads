import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { companyProfiles } from "@/lib/db/schema/company-profiles";
import type { Industry } from "@/lib/onboarding/types";

/** Industry-specific equipment/product type mappings */
export const EQUIPMENT_TYPES_BY_INDUSTRY: Record<Industry, readonly string[]> = {
  heavy_equipment: [
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
  ],
  solar: [
    "Solar Panels",
    "Inverters",
    "Battery Storage",
    "Racking Systems",
    "Microinverters",
    "EV Chargers",
    "Monitoring Systems",
    "Transformers",
  ],
  hvac: [
    "Furnaces",
    "Air Conditioners",
    "Heat Pumps",
    "Ductwork",
    "Thermostats",
    "Boilers",
    "Chillers",
    "RTUs",
    "VRF Systems",
    "Mini Splits",
  ],
  roofing: [
    "Shingles",
    "Metal Roofing",
    "Flat Roofing",
    "Tile",
    "Slate",
    "TPO/PVC",
    "EPDM",
    "Standing Seam",
    "Gutters",
  ],
  electrical: [
    "Panels",
    "Transformers",
    "Generators",
    "Wiring",
    "Switchgear",
    "Circuit Breakers",
    "Conduit",
    "Lighting Systems",
  ],
} as const;

/** Returns the equipment types relevant for the given industry */
export function getEquipmentTypesForIndustry(industry: Industry): readonly string[] {
  return EQUIPMENT_TYPES_BY_INDUSTRY[industry] ?? EQUIPMENT_TYPES_BY_INDUSTRY.heavy_equipment;
}

/** Legacy: flat list of heavy equipment types (backward compatibility) */
export const EQUIPMENT_TYPES = EQUIPMENT_TYPES_BY_INDUSTRY.heavy_equipment;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export type CompanyProfile = InferSelectModel<typeof companyProfiles>;
export type NewCompanyProfile = InferInsertModel<typeof companyProfiles>;
