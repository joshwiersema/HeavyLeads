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
      ];

    case "roofing":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["238160"] }),
        new EnrNewsAdapter(),
        new NwsStormAdapter(),
        new FemaDisasterAdapter(),
      ];

    case "solar":
      return [
        new SamGovBidsAdapter({ naicsCodes: ["221114", "238220"] }),
        new EnrNewsAdapter(),
      ];

    case "electrical":
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ["238210"] }),
        new EnrNewsAdapter(),
      ];

    default: {
      // Exhaustiveness check
      const _exhaustive: never = industry;
      return _exhaustive;
    }
  }
}

/**
 * Returns the superset of all adapters (heavy_equipment set).
 *
 * Since heavy_equipment includes all adapter types with the broadest
 * NAICS codes, it serves as the deduped union.
 */
export function getAllAdapters(): ScraperAdapter[] {
  return getAdaptersForIndustry("heavy_equipment");
}
