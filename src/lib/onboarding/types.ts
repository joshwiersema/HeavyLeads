// ---------------------------------------------------------------------------
// Onboarding Wizard -- shared types & constants
// ---------------------------------------------------------------------------

/** The five industries supported by the platform. */
export type Industry =
  | "heavy_equipment"
  | "hvac"
  | "roofing"
  | "solar"
  | "electrical";

/** Metadata for each industry used in the selection step. */
export interface IndustryOption {
  id: Industry;
  label: string;
  description: string;
  /** Lucide icon name rendered via an icon map in the UI. */
  icon: string;
}

export const INDUSTRIES: IndustryOption[] = [
  {
    id: "heavy_equipment",
    label: "Heavy Equipment",
    description: "Excavators, cranes, loaders and more",
    icon: "hard-hat",
  },
  {
    id: "hvac",
    label: "HVAC",
    description: "Heating, ventilation and air conditioning",
    icon: "thermometer",
  },
  {
    id: "roofing",
    label: "Roofing",
    description: "Residential and commercial roofing",
    icon: "home",
  },
  {
    id: "solar",
    label: "Solar",
    description: "Solar panel installation and services",
    icon: "sun",
  },
  {
    id: "electrical",
    label: "Electrical",
    description: "Residential, commercial and industrial electrical",
    icon: "zap",
  },
];

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------

export interface WizardStepDef {
  id: string;
  label: string;
}

export const WIZARD_STEPS: readonly WizardStepDef[] = [
  { id: "industry", label: "Industry" },
  { id: "company", label: "Company Basics" },
  { id: "serviceArea", label: "Service Area" },
  { id: "specializations", label: "Specializations" },
  { id: "preferences", label: "Lead Preferences" },
  { id: "review", label: "Review & Confirm" },
] as const;

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

export interface WizardState {
  currentStep: number;
  industry: Industry | null;
  companyName: string;
  companySize: string;
  yearsInBusiness: number | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  serviceRadiusMiles: number;
  serviceAreaLat: number | null;
  serviceAreaLng: number | null;
  specializations: string[];
  serviceTypes: string[];
  certifications: string[];
  minProjectValue: number | null;
  maxProjectValue: number | null;
  preferredLeadTypes: string[];
  alertFrequency: "realtime" | "daily" | "weekly";
}

// ---------------------------------------------------------------------------
// Wizard actions (discriminated union)
// ---------------------------------------------------------------------------

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_FIELD"; field: keyof WizardState; value: unknown }
  | { type: "SET_FIELDS"; fields: Partial<WizardState> }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: WizardState };
