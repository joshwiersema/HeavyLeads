import { registerAdapter } from "../registry";
import { AustinPermitsAdapter } from "./austin-permits";
import { DallasPermitsAdapter } from "./dallas-permits";
import { AtlantaPermitsAdapter } from "./atlanta-permits";
import { SamGovBidsAdapter } from "./sam-gov-bids";
import { EnrNewsAdapter } from "./enr-news";
import { ConstructionDiveNewsAdapter } from "./construction-dive-news";
import { PrNewswireNewsAdapter } from "./prnewswire-news";
import { GoogleDorkingAdapter } from "./google-dorking";

/**
 * Initialize and register all built-in adapters.
 *
 * Call this before running the pipeline to ensure all adapters
 * are available. New adapters can be added by:
 * 1. Creating a new adapter file implementing ScraperAdapter
 * 2. Importing and registering it here
 *
 * No changes to pipeline.ts are needed when adding new adapters.
 *
 * Adapters with missing API keys (SAM_GOV_API_KEY, SERPER_API_KEY)
 * will gracefully skip their scrape and return empty results.
 */
export function initializeAdapters(): void {
  // Permit adapters
  registerAdapter(new AustinPermitsAdapter());
  registerAdapter(new DallasPermitsAdapter());
  registerAdapter(new AtlantaPermitsAdapter());

  // Bid board adapters
  registerAdapter(new SamGovBidsAdapter());

  // News adapters
  registerAdapter(new EnrNewsAdapter());
  registerAdapter(new ConstructionDiveNewsAdapter());
  registerAdapter(new PrNewswireNewsAdapter());

  // Deep web search adapters
  registerAdapter(new GoogleDorkingAdapter());
}
