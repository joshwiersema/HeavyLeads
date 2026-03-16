/**
 * Solar incentive program data types and static lookup table.
 *
 * This is NOT a scraper adapter -- it's a curated reference dataset of
 * the top 15 US state solar incentive programs. Data is sourced from the
 * DSIRE (Database of State Incentives for Renewables & Efficiency) and
 * manually curated for accuracy as of early 2026.
 *
 * Solar installers use this data to quickly reference available
 * incentives during sales conversations and proposal generation.
 */

export interface SolarIncentive {
  /** Full state name */
  state: string;
  /** 2-letter state abbreviation */
  stateCode: string;
  /** Official program name */
  programName: string;
  /** Category of incentive */
  incentiveType: "tax_credit" | "rebate" | "net_metering" | "srec" | "grant";
  /** Brief description of the program */
  description: string;
  /** Maximum value or rate (human-readable) */
  maxValue: string;
  /** URL for more information */
  url: string;
  /** ISO date string for when data was last verified */
  lastUpdated: string;
}

/**
 * Top 15 US state solar incentive programs.
 *
 * Curated from DSIRE database, state energy office publications,
 * and utility program pages. Accurate as of early 2026.
 */
export const SOLAR_INCENTIVES: SolarIncentive[] = [
  {
    state: "California",
    stateCode: "CA",
    programName: "Self-Generation Incentive Program (SGIP)",
    incentiveType: "rebate",
    description:
      "Provides rebates for qualifying distributed energy resources including solar+storage systems installed on customer side of the meter.",
    maxValue: "$1,000/kWh for storage paired with solar",
    url: "https://www.selfgenca.com/",
    lastUpdated: "2026-01",
  },
  {
    state: "Texas",
    stateCode: "TX",
    programName: "Property Tax Exemption for Solar & Wind",
    incentiveType: "tax_credit",
    description:
      "Texas exempts the added value of solar energy systems from property tax assessments, reducing the effective cost of residential solar.",
    maxValue: "100% of added property value exempt",
    url: "https://comptroller.texas.gov/taxes/property-tax/exemptions/solar-wind.php",
    lastUpdated: "2026-01",
  },
  {
    state: "New York",
    stateCode: "NY",
    programName: "NY-Sun Megawatt Block Incentive",
    incentiveType: "rebate",
    description:
      "Declining block incentive program that provides upfront rebates for solar installations. Rates decrease as capacity targets are met in each utility territory.",
    maxValue: "Up to $0.20/W for residential systems",
    url: "https://www.nyserda.ny.gov/All-Programs/NY-Sun",
    lastUpdated: "2026-01",
  },
  {
    state: "Florida",
    stateCode: "FL",
    programName: "Net Metering",
    incentiveType: "net_metering",
    description:
      "Florida utilities must offer net metering for solar systems up to 2 MW. Excess generation is credited at the full retail rate.",
    maxValue: "Full retail rate credit for excess generation",
    url: "https://www.floridapsc.com/ConsumerAssistance/NetMetering",
    lastUpdated: "2026-01",
  },
  {
    state: "Arizona",
    stateCode: "AZ",
    programName: "Residential Solar Energy Tax Credit",
    incentiveType: "tax_credit",
    description:
      "Arizona offers a state income tax credit of 25% of the cost of a solar energy device, capped at $1,000.",
    maxValue: "$1,000",
    url: "https://azdor.gov/tax-credits/solar-energy-credit",
    lastUpdated: "2026-01",
  },
  {
    state: "Massachusetts",
    stateCode: "MA",
    programName: "SMART Program (Solar Massachusetts Renewable Target)",
    incentiveType: "rebate",
    description:
      "Performance-based incentive program providing fixed per-kWh payments for solar generation over 10-20 years depending on system size.",
    maxValue: "Base compensation rate varies by capacity block",
    url: "https://www.mass.gov/info-details/solar-massachusetts-renewable-target-smart",
    lastUpdated: "2026-01",
  },
  {
    state: "New Jersey",
    stateCode: "NJ",
    programName: "Successor Solar Incentive (SuSI) Program",
    incentiveType: "srec",
    description:
      "NJ's successor to SREC provides fixed incentive payments per MWh of solar generation through Administratively Determined Incentive (ADI) and Competitive Solar Incentive (CSI) segments.",
    maxValue: "Up to $90/MWh for residential ADI",
    url: "https://njcleanenergy.com/renewable-energy/programs/susi-program",
    lastUpdated: "2026-01",
  },
  {
    state: "Colorado",
    stateCode: "CO",
    programName: "Xcel Energy Solar*Rewards",
    incentiveType: "rebate",
    description:
      "Xcel Energy customers in Colorado can receive performance-based incentive payments for residential solar installations. Payments are made per kWh generated.",
    maxValue: "Varies by program year and system size",
    url: "https://co.my.xcelenergy.com/s/renewable/solar-rewards",
    lastUpdated: "2026-01",
  },
  {
    state: "North Carolina",
    stateCode: "NC",
    programName: "Duke Energy NC Solar Rebate",
    incentiveType: "rebate",
    description:
      "Duke Energy provides upfront rebates for residential solar installations in North Carolina, reducing system costs for qualifying customers.",
    maxValue: "$0.60/W up to $6,000",
    url: "https://www.duke-energy.com/home/products/renewable-energy/nc-solar-rebate",
    lastUpdated: "2026-01",
  },
  {
    state: "Connecticut",
    stateCode: "CT",
    programName: "Residential Solar Investment Program (RSIP)",
    incentiveType: "rebate",
    description:
      "CT Green Bank's incentive program provides performance-based or expected performance-based buy-all incentives for residential solar PV systems.",
    maxValue: "Up to $0.305/W (declining blocks)",
    url: "https://www.ctgreenbank.com/programs/rsip/",
    lastUpdated: "2026-01",
  },
  {
    state: "Maryland",
    stateCode: "MD",
    programName: "Maryland Solar Renewable Energy Credits (SRECs)",
    incentiveType: "srec",
    description:
      "Maryland's RPS creates a market for SRECs. Solar system owners earn one SREC per MWh generated, which can be sold to utilities for compliance.",
    maxValue: "Market rate (~$60-80/MWh)",
    url: "https://energy.maryland.gov/renewable/Pages/Solar-Renewable-Energy-Credits.aspx",
    lastUpdated: "2026-01",
  },
  {
    state: "Minnesota",
    stateCode: "MN",
    programName: "Xcel Energy Solar*Rewards Community",
    incentiveType: "rebate",
    description:
      "Community solar garden program allowing Xcel Energy customers to subscribe to local solar projects and receive credits on their electric bills.",
    maxValue: "Bill credit at applicable rate",
    url: "https://mn.my.xcelenergy.com/s/renewable/solar-rewards-community",
    lastUpdated: "2026-01",
  },
  {
    state: "Illinois",
    stateCode: "IL",
    programName: "Illinois Shines (Adjustable Block Program)",
    incentiveType: "srec",
    description:
      "Illinois Shines provides REC payments for new solar photovoltaic projects. Residential systems receive upfront REC contract payments based on system size.",
    maxValue: "Block-dependent REC pricing",
    url: "https://www.illinoisshines.com/",
    lastUpdated: "2026-01",
  },
  {
    state: "Nevada",
    stateCode: "NV",
    programName: "NV Energy Solar Generations Rebate",
    incentiveType: "rebate",
    description:
      "NV Energy offers capacity-based rebates for residential solar installations. Incentive amounts decline as program capacity blocks are filled.",
    maxValue: "Up to $0.20/W for residential",
    url: "https://www.nvenergy.com/cleanenergy/solar-generations",
    lastUpdated: "2026-01",
  },
  {
    state: "Oregon",
    stateCode: "OR",
    programName: "Oregon Solar + Storage Rebate Program",
    incentiveType: "rebate",
    description:
      "Oregon Energy Trust provides rebates for residential solar and solar+storage systems, with enhanced incentives for low-income households.",
    maxValue: "Up to $5,000 for solar; $2,500 for storage",
    url: "https://www.energytrust.org/incentives/solar-electric/",
    lastUpdated: "2026-01",
  },
];

/**
 * Get solar incentive programs for a specific US state.
 *
 * @param stateCode - 2-letter US state abbreviation (case-insensitive)
 * @returns Array of matching SolarIncentive records, or empty array if not found
 */
export function getSolarIncentives(stateCode: string): SolarIncentive[] {
  const normalized = stateCode.trim().toUpperCase();
  if (!normalized) return [];
  return SOLAR_INCENTIVES.filter((i) => i.stateCode === normalized);
}

/**
 * Get all curated solar incentive programs.
 *
 * @returns Array of all 15 SolarIncentive records
 */
export function getAllSolarIncentives(): SolarIncentive[] {
  return SOLAR_INCENTIVES;
}
