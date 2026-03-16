// ---------------------------------------------------------------------------
// Industry-specific configuration for the onboarding wizard
// ---------------------------------------------------------------------------

import type { Industry } from "./types";

export interface IndustryConfig {
  specializations: string[];
  serviceTypes: string[];
  certifications: string[];
  leadTypes: string[];
}

export const INDUSTRY_CONFIG: Record<Industry, IndustryConfig> = {
  heavy_equipment: {
    specializations: [
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
    serviceTypes: ["Sales", "Rental", "Parts & Service", "Leasing"],
    certifications: [
      "OSHA Certified",
      "Factory Authorized Dealer",
      "ISO 9001",
    ],
    leadTypes: [
      "Building Permits",
      "Bid Boards",
      "News & Press",
      "Government Contracts",
    ],
  },

  hvac: {
    specializations: [
      "Residential HVAC",
      "Commercial HVAC",
      "Industrial Refrigeration",
      "Ductwork",
      "Boilers",
      "Heat Pumps",
      "Geothermal",
      "VRF Systems",
    ],
    serviceTypes: [
      "Installation",
      "Repair & Maintenance",
      "Design & Engineering",
      "Energy Audits",
    ],
    certifications: ["EPA 608", "NATE Certified", "LEED AP"],
    leadTypes: [
      "Building Permits",
      "Code Violations",
      "Energy Benchmarking",
      "Government Contracts",
    ],
  },

  roofing: {
    specializations: [
      "Asphalt Shingles",
      "Metal Roofing",
      "Flat/TPO/EPDM",
      "Tile Roofing",
      "Slate",
      "Cedar Shake",
      "Storm Restoration",
      "Commercial Roofing",
    ],
    serviceTypes: [
      "New Installation",
      "Replacement",
      "Repair",
      "Inspection",
      "Emergency/Storm",
    ],
    certifications: [
      "GAF Certified",
      "CertainTeed SELECT",
      "Owens Corning Preferred",
    ],
    leadTypes: [
      "Building Permits",
      "Storm Alerts",
      "Insurance Claims",
      "Government Contracts",
    ],
  },

  solar: {
    specializations: [
      "Residential Solar",
      "Commercial Solar",
      "Community Solar",
      "Solar + Storage",
      "EV Charging",
      "Ground Mount",
      "Carport",
    ],
    serviceTypes: [
      "Design & Install",
      "Maintenance",
      "Consulting",
      "Financing Assistance",
    ],
    certifications: ["NABCEP Certified", "Tesla Certified", "SunPower Dealer"],
    leadTypes: [
      "Building Permits",
      "Incentive Programs",
      "Utility Rate Changes",
      "Government Contracts",
    ],
  },

  electrical: {
    specializations: [
      "Residential Wiring",
      "Commercial Electrical",
      "Industrial Power",
      "EV Charger Installation",
      "Solar Electrical",
      "Fire Alarm Systems",
      "Data/Low Voltage",
      "Generator Installation",
    ],
    serviceTypes: [
      "New Construction",
      "Renovation",
      "Repair & Service",
      "Code Compliance",
    ],
    certifications: [
      "Master Electrician",
      "Journeyman License",
      "IBEW Member",
    ],
    leadTypes: [
      "Building Permits",
      "Code Violations",
      "EV Infrastructure",
      "Government Contracts",
    ],
  },
};

// ---------------------------------------------------------------------------
// Shared options (not industry-specific)
// ---------------------------------------------------------------------------

export const COMPANY_SIZES = [
  { value: "1-5", label: "1-5 employees" },
  { value: "6-20", label: "6-20 employees" },
  { value: "21-50", label: "21-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201+", label: "201+ employees" },
] as const;

export const ALERT_FREQUENCIES = [
  {
    value: "realtime" as const,
    label: "Real-time",
    description: "Get notified immediately for high-priority leads",
  },
  {
    value: "daily" as const,
    label: "Daily Digest",
    description: "One email per day with new leads",
  },
  {
    value: "weekly" as const,
    label: "Weekly Summary",
    description: "Weekly roundup of all new leads",
  },
] as const;
