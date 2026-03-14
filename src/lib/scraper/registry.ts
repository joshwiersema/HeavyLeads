import type { ScraperAdapter } from "./adapters/base-adapter";

/** Registry of all available scraper adapters, keyed by sourceId */
const adapters = new Map<string, ScraperAdapter>();

/** Register an adapter for pipeline execution */
export function registerAdapter(adapter: ScraperAdapter): void {
  adapters.set(adapter.sourceId, adapter);
}

/** Get all registered adapters */
export function getRegisteredAdapters(): ScraperAdapter[] {
  return Array.from(adapters.values());
}

/** Clear all registered adapters (for testing) */
export function clearAdapters(): void {
  adapters.clear();
}
