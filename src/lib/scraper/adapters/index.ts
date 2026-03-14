import { registerAdapter } from "../registry";
import { AustinPermitsAdapter } from "./austin-permits";
import { DallasPermitsAdapter } from "./dallas-permits";
import { AtlantaPermitsAdapter } from "./atlanta-permits";

/**
 * Initialize and register all built-in jurisdiction adapters.
 *
 * Call this before running the pipeline to ensure all adapters
 * are available. New adapters can be added by:
 * 1. Creating a new adapter file implementing ScraperAdapter
 * 2. Importing and registering it here
 *
 * No changes to pipeline.ts are needed when adding new adapters.
 */
export function initializeAdapters(): void {
  registerAdapter(new AustinPermitsAdapter());
  registerAdapter(new DallasPermitsAdapter());
  registerAdapter(new AtlantaPermitsAdapter());
}
