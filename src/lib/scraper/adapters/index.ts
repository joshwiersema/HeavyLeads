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
import { UsaSpendingContractsAdapter } from "./usaspending-contracts";
import { OshaInspectionsAdapter } from "./osha-inspections";
import { FercEnergyAdapter } from "./ferc-energy";
import { EpaBrownfieldsAdapter } from "./epa-brownfields";
import { GrantsGovAdapter } from "./grants-gov";
import { FccAntennaAdapter } from "./fcc-antenna";
import { getPortalAdaptersForIndustry } from "./portal-adapter-factory";

/**
 * Factory function: returns fresh adapter instances for a given industry.
 *
 * Merges hardcoded adapters (SAM.gov, news, storm, per-city) with dynamic
 * portal adapters from the data_portals table. Hardcoded adapters take
 * priority -- portal adapters with duplicate sourceIds are skipped.
 *
 * Each call creates new adapter objects -- no shared mutable state between
 * invocations. This eliminates race conditions when per-industry crons overlap.
 */
export async function getAdaptersForIndustry(
  industry: Industry
): Promise<ScraperAdapter[]> {
  // Hardcoded adapters (existing, for non-portal sources + legacy city adapters)
  const hardcoded = getHardcodedAdapters(industry);

  // Dynamic portal adapters from data_portals table
  let portalAdapters: ScraperAdapter[] = [];
  try {
    portalAdapters = await getPortalAdaptersForIndustry(industry);
  } catch (err) {
    console.warn(
      `[adapters] Failed to load portal adapters for ${industry}:`,
      err instanceof Error ? err.message : err
    );
    // Continue with hardcoded adapters only
  }

  // Merge, deduplicating by sourceId (hardcoded takes priority)
  const seen = new Set(hardcoded.map((a) => a.sourceId));
  const merged = [...hardcoded];
  for (const adapter of portalAdapters) {
    if (!seen.has(adapter.sourceId)) {
      seen.add(adapter.sourceId);
      merged.push(adapter);
    }
  }

  return merged;
}

/**
 * Returns hardcoded adapter instances for a given industry.
 *
 * These are the original per-city adapters plus non-portal sources
 * (SAM.gov, news scrapers, storm alerts, etc.).
 */
function getHardcodedAdapters(industry: Industry): ScraperAdapter[] {
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
        new UsaSpendingContractsAdapter(),
        new OshaInspectionsAdapter(),
        new EpaBrownfieldsAdapter(),
        new GrantsGovAdapter(),
        new FercEnergyAdapter(),
        new FccAntennaAdapter(),
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
        new UsaSpendingContractsAdapter(),
        new OshaInspectionsAdapter(),
        new GrantsGovAdapter(),
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
        new UsaSpendingContractsAdapter(),
        new OshaInspectionsAdapter(),
        new EpaBrownfieldsAdapter(),
        new GrantsGovAdapter(),
      ];

    case "solar":
      return [
        new SamGovBidsAdapter({ naicsCodes: ["221114", "238220"] }),
        new EnrNewsAdapter(),
        new EiaUtilityRateAdapter(),
        new UsaSpendingContractsAdapter(),
        new GrantsGovAdapter(),
        new FercEnergyAdapter(),
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
        new UsaSpendingContractsAdapter(),
        new OshaInspectionsAdapter(),
        new GrantsGovAdapter(),
        new FercEnergyAdapter(),
        new FccAntennaAdapter(),
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
 * Collects adapters from every industry (hardcoded + portal) and
 * deduplicates by sourceId. Used by admin/monitoring dashboards
 * and the "all sources" health check.
 */
export async function getAllAdapters(): Promise<ScraperAdapter[]> {
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
    const adapters = await getAdaptersForIndustry(industry);
    for (const adapter of adapters) {
      if (!seen.has(adapter.sourceId)) {
        seen.add(adapter.sourceId);
        result.push(adapter);
      }
    }
  }

  return result;
}
