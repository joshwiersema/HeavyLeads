// DEPRECATED: Use getAdaptersForIndustry() from ./adapters/index.ts instead

import type { ScraperAdapter } from "./adapters/base-adapter";

/** Registry of all available scraper adapters, keyed by sourceId */
const adapters = new Map<string, ScraperAdapter>();

/**
 * Register an adapter for pipeline execution
 * @deprecated Use getAdaptersForIndustry() from ./adapters/index.ts instead
 */
export function registerAdapter(adapter: ScraperAdapter): void {
  adapters.set(adapter.sourceId, adapter);
}

/**
 * Get all registered adapters
 * @deprecated Use getAdaptersForIndustry() or getAllAdapters() from ./adapters/index.ts instead
 */
export function getRegisteredAdapters(): ScraperAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Clear all registered adapters (for testing)
 * @deprecated No longer needed with factory pattern
 */
export function clearAdapters(): void {
  adapters.clear();
}
