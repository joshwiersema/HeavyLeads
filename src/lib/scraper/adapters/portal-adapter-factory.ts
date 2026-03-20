/**
 * Portal Adapter Factory
 *
 * Creates ScraperAdapter instances from enabled data_portals rows at runtime.
 * This is the bridge between the discovery service (which populates data_portals)
 * and the scraping pipeline (which consumes adapters).
 *
 * Supports two adapter types:
 *   - GenericSocrataAdapter for portalType="socrata"
 *   - GenericArcGISAdapter for portalType="arcgis"
 */

import { db } from "@/lib/db";
import { dataPortals } from "@/lib/db/schema/data-portals";
import { eq, sql } from "drizzle-orm";
import type { ScraperAdapter } from "./base-adapter";
import { GenericSocrataAdapter } from "./generic-socrata-adapter";
import type { DataPortalConfig } from "./generic-socrata-adapter";
import { GenericArcGISAdapter } from "./generic-arcgis-adapter";
import type { FieldMapping } from "../field-mapper";

/**
 * Build a DataPortalConfig from a data_portals database row.
 */
function rowToConfig(row: typeof dataPortals.$inferSelect): DataPortalConfig {
  return {
    id: row.id,
    portalType: row.portalType,
    domain: row.domain,
    datasetId: row.datasetId,
    name: row.name,
    datasetType: row.datasetType,
    city: row.city,
    state: row.state,
    jurisdiction: row.jurisdiction,
    fieldMapping: row.fieldMapping as FieldMapping,
    queryFilters: row.queryFilters as Record<string, unknown> | null,
    enabled: row.enabled,
    applicableIndustries: row.applicableIndustries ?? [],
  };
}

/**
 * Create a ScraperAdapter from a DataPortalConfig based on portalType.
 * Returns null for unknown portal types.
 */
function createAdapter(config: DataPortalConfig): ScraperAdapter | null {
  switch (config.portalType) {
    case "socrata":
      return new GenericSocrataAdapter(config);
    case "arcgis":
      return new GenericArcGISAdapter(config);
    default:
      console.warn(
        `[portal-adapter-factory] Unknown portalType "${config.portalType}" for portal ${config.domain}/${config.datasetId}, skipping`
      );
      return null;
  }
}

/**
 * Load all enabled data_portals and create adapter instances.
 *
 * Returns an array of ScraperAdapter ready for use in the pipeline.
 */
export async function getPortalAdapters(): Promise<ScraperAdapter[]> {
  const rows = await db
    .select()
    .from(dataPortals)
    .where(eq(dataPortals.enabled, true));

  const adapters: ScraperAdapter[] = [];

  for (const row of rows) {
    const config = rowToConfig(row);
    const adapter = createAdapter(config);
    if (adapter) {
      adapters.push(adapter);
    }
  }

  return adapters;
}

/**
 * Load enabled data_portals filtered by industry and create adapter instances.
 *
 * Includes portals where:
 *   - applicableIndustries array contains the given industry, OR
 *   - applicableIndustries is empty (applies to all industries)
 */
export async function getPortalAdaptersForIndustry(
  industry: string
): Promise<ScraperAdapter[]> {
  const rows = await db
    .select()
    .from(dataPortals)
    .where(
      sql`${dataPortals.enabled} = true AND (${dataPortals.applicableIndustries} @> ARRAY[${industry}]::text[] OR ${dataPortals.applicableIndustries} = '{}'::text[])`
    );

  const adapters: ScraperAdapter[] = [];

  for (const row of rows) {
    const config = rowToConfig(row);
    const adapter = createAdapter(config);
    if (adapter) {
      adapters.push(adapter);
    }
  }

  return adapters;
}

/**
 * Update the lastScrapedAt timestamp for a portal after successful scrape.
 */
export async function updateLastScraped(portalId: string): Promise<void> {
  await db
    .update(dataPortals)
    .set({ lastScrapedAt: new Date() })
    .where(eq(dataPortals.id, portalId));
}
