import type { ScraperAdapter } from "./base-adapter";
import type { Industry } from "@/lib/onboarding/types";
import { AustinPermitsAdapter } from "./austin-permits";
import { DallasPermitsAdapter } from "./dallas-permits";
import { AtlantaPermitsAdapter } from "./atlanta-permits";
import { SamGovBidsAdapter } from "./sam-gov-bids";
import { EnrNewsAdapter } from "./enr-news";
import { ConstructionDiveNewsAdapter } from "./construction-dive-news";
import { PrNewswireNewsAdapter } from "./prnewswire-news";
import { GoogleDorkingAdapter } from "./google-dorking";
import { NwsStormAdapter } from "./nws-storm-adapter";
import { FemaDisasterAdapter } from "./fema-disaster-adapter";
import { AustinViolationsAdapter } from "./austin-violations";
import { DallasViolationsAdapter } from "./dallas-violations";
import { HoustonViolationsAdapter } from "./houston-violations";
import { EiaUtilityRateAdapter } from "./eia-utility-rates";

/**
 * Factory function: returns fresh adapter instances for a given industry.
 *
 * Each call creates new adapter objects -- no shared mutable state between
 * invocations. This replaces the old global Map registry pattern and
 * eliminates race conditions when per-industry crons overlap.
 */
export function getAdaptersForIndustry(industry: Industry): ScraperAdapter[] {
  switch (industry) {
    case "heavy_equipment":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new AtlantaPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["236", "237", "238"] }),
        new EnrNewsAdapter(),
        new ConstructionDiveNewsAdapter(),
        new PrNewswireNewsAdapter(),
        new GoogleDorkingAdapter(),
        new FemaDisasterAdapter(),
      ];

    case "hvac":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["238220"] }),
        new EnrNewsAdapter(),
        new AustinViolationsAdapter(),
        new DallasViolationsAdapter(),
        new HoustonViolationsAdapter(),
      ];

    case "roofing":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["238160"] }),
        new EnrNewsAdapter(),
        new NwsStormAdapter(),
        new FemaDisasterAdapter(),
        new AustinViolationsAdapter(),
        new DallasViolationsAdapter(),
        new HoustonViolationsAdapter(),
      ];

    case "solar":
      return [
        new SamGovBidsAdapter({ naicsCodes: ["221114", "238220"] }),
        new EnrNewsAdapter(),
        new EiaUtilityRateAdapter(),
      ];

    case "electrical":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["238210"] }),
        new EnrNewsAdapter(),
        new AustinViolationsAdapter(),
        new DallasViolationsAdapter(),
        new HoustonViolationsAdapter(),
      ];

    default: {
      // Exhaustiveness check
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}

/**
 * Returns the superset of all unique adapters across all industries.
 *
 * Collects adapters from every industry and deduplicates by sourceId.
 * Used by admin/monitoring dashboards and the "all sources" health check.
 */
export function getAllAdapters(): ScraperAdapter[] {
  const industries: Industry[] = [
    "heavy_equipment",
    "hvac",
    "roofing",
    "solar",
    "electrical",
  ];

  const seen = new Set<string>();
  const result: ScraperAdapter[] = [];

  for (const industry of industries) {
    for (const adapter of getAdaptersForIndustry(industry)) {
      if (!seen.has(adapter.sourceId)) {
        seen.add(adapter.sourceId);
        result.push(adapter);
      }
    }
  }

  return result;
}
