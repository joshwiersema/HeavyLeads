/**
 * Industry-specific pricing configuration.
 *
 * Each industry can have its own Stripe price IDs for setup fee and monthly
 * subscription. Falls back to the generic STRIPE_MONTHLY_PRICE_ID /
 * STRIPE_SETUP_FEE_PRICE_ID env vars when industry-specific ones are not set.
 * This means the existing single-price setup continues working until
 * industry-specific Stripe prices are created.
 */

export interface IndustryPricing {
  setupFeeId: string;
  monthlyPriceId: string;
  setupFeeAmount: number;
  monthlyAmount: number;
  trialDays: number;
}

export const INDUSTRY_PRICING: Record<string, IndustryPricing> = {
  heavy_equipment: {
    setupFeeId: (
      process.env.STRIPE_HEAVY_EQUIP_SETUP_ID ??
      process.env.STRIPE_SETUP_FEE_PRICE_ID ??
      ""
    ).trim(),
    monthlyPriceId: (
      process.env.STRIPE_HEAVY_EQUIP_MONTHLY_ID ??
      process.env.STRIPE_MONTHLY_PRICE_ID ??
      ""
    ).trim(),
    setupFeeAmount: 499,
    monthlyAmount: 199,
    trialDays: 7,
  },
  hvac: {
    setupFeeId: (
      process.env.STRIPE_HVAC_SETUP_ID ??
      process.env.STRIPE_SETUP_FEE_PRICE_ID ??
      ""
    ).trim(),
    monthlyPriceId: (
      process.env.STRIPE_HVAC_MONTHLY_ID ??
      process.env.STRIPE_MONTHLY_PRICE_ID ??
      ""
    ).trim(),
    setupFeeAmount: 399,
    monthlyAmount: 149,
    trialDays: 7,
  },
  roofing: {
    setupFeeId: (
      process.env.STRIPE_ROOFING_SETUP_ID ??
      process.env.STRIPE_SETUP_FEE_PRICE_ID ??
      ""
    ).trim(),
    monthlyPriceId: (
      process.env.STRIPE_ROOFING_MONTHLY_ID ??
      process.env.STRIPE_MONTHLY_PRICE_ID ??
      ""
    ).trim(),
    setupFeeAmount: 399,
    monthlyAmount: 149,
    trialDays: 7,
  },
  solar: {
    setupFeeId: (
      process.env.STRIPE_SOLAR_SETUP_ID ??
      process.env.STRIPE_SETUP_FEE_PRICE_ID ??
      ""
    ).trim(),
    monthlyPriceId: (
      process.env.STRIPE_SOLAR_MONTHLY_ID ??
      process.env.STRIPE_MONTHLY_PRICE_ID ??
      ""
    ).trim(),
    setupFeeAmount: 499,
    monthlyAmount: 179,
    trialDays: 7,
  },
  electrical: {
    setupFeeId: (
      process.env.STRIPE_ELECTRICAL_SETUP_ID ??
      process.env.STRIPE_SETUP_FEE_PRICE_ID ??
      ""
    ).trim(),
    monthlyPriceId: (
      process.env.STRIPE_ELECTRICAL_MONTHLY_ID ??
      process.env.STRIPE_MONTHLY_PRICE_ID ??
      ""
    ).trim(),
    setupFeeAmount: 399,
    monthlyAmount: 149,
    trialDays: 7,
  },
};

/**
 * Get pricing configuration for a given industry.
 * Falls back to heavy_equipment pricing if the industry is not recognized.
 */
export function getIndustryPricing(industry: string): IndustryPricing {
  return INDUSTRY_PRICING[industry] ?? INDUSTRY_PRICING.heavy_equipment;
}
