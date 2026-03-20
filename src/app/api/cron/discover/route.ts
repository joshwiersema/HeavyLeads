import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { dataPortals } from "@/lib/db/schema/data-portals";
import { sql } from "drizzle-orm";
import { discoverSocrataDatasets } from "@/lib/scraper/discovery/socrata-discovery";
import { discoverArcGISDatasets } from "@/lib/scraper/discovery/arcgis-discovery";

export const maxDuration = 300;

/**
 * GET /api/cron/discover
 *
 * Weekly discovery cron that finds new Socrata and ArcGIS datasets
 * containing permit and violation data. Runs both discovery services
 * in parallel and upserts results into the data_portals table.
 *
 * Scheduled: Sunday 3 AM UTC via vercel.json
 * Auth: CRON_SECRET Bearer token
 *
 * On conflict (same domain + datasetId), updates name, fieldMapping,
 * confidence, and lastVerifiedAt but preserves the enabled flag to
 * respect manual overrides.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Run both discovery services in parallel
    const [socrataResult, arcgisResult] = await Promise.allSettled([
      discoverSocrataDatasets(),
      discoverArcGISDatasets(),
    ]);

    const socrataDatasets =
      socrataResult.status === "fulfilled" ? socrataResult.value : [];
    const arcgisDatasets =
      arcgisResult.status === "fulfilled" ? arcgisResult.value : [];

    if (socrataResult.status === "rejected") {
      console.error(
        "[discover] Socrata discovery failed:",
        socrataResult.reason instanceof Error
          ? socrataResult.reason.message
          : socrataResult.reason
      );
    }

    if (arcgisResult.status === "rejected") {
      console.error(
        "[discover] ArcGIS discovery failed:",
        arcgisResult.reason instanceof Error
          ? arcgisResult.reason.message
          : arcgisResult.reason
      );
    }

    // Upsert all discovered datasets into data_portals
    let totalUpserted = 0;

    // Process Socrata results
    for (const result of socrataDatasets) {
      try {
        await db
          .insert(dataPortals)
          .values({
            portalType: result.portalType,
            domain: result.domain,
            datasetId: result.datasetId,
            name: result.name,
            datasetType: result.datasetType,
            city: result.city,
            state: result.state,
            jurisdiction: result.jurisdiction,
            fieldMapping: result.fieldMapping,
            confidence: String(result.confidence),
            discoveredBy: result.discoveredBy,
            applicableIndustries: result.applicableIndustries,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dataPortals.domain, dataPortals.datasetId],
            set: {
              name: sql`excluded.name`,
              fieldMapping: sql`excluded.field_mapping`,
              confidence: sql`excluded.confidence`,
              lastVerifiedAt: sql`excluded.last_verified_at`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        totalUpserted++;
      } catch (err) {
        console.warn(
          `[discover] Failed to upsert Socrata dataset ${result.domain}/${result.datasetId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Process ArcGIS results
    for (const result of arcgisDatasets) {
      try {
        await db
          .insert(dataPortals)
          .values({
            portalType: result.portalType,
            domain: result.domain,
            datasetId: result.datasetId,
            name: result.name,
            datasetType: result.datasetType,
            city: result.city,
            state: result.state,
            jurisdiction: result.jurisdiction,
            fieldMapping: result.fieldMapping,
            confidence: String(result.confidence),
            discoveredBy: result.discoveredBy,
            applicableIndustries: result.applicableIndustries,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dataPortals.domain, dataPortals.datasetId],
            set: {
              name: sql`excluded.name`,
              fieldMapping: sql`excluded.field_mapping`,
              confidence: sql`excluded.confidence`,
              lastVerifiedAt: sql`excluded.last_verified_at`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        totalUpserted++;
      } catch (err) {
        console.warn(
          `[discover] Failed to upsert ArcGIS dataset ${result.domain}/${result.datasetId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(
      `[discover] Upserted ${totalUpserted} portal configs (${socrataDatasets.length} Socrata, ${arcgisDatasets.length} ArcGIS)`
    );

    return Response.json({
      success: true,
      socrataFound: socrataDatasets.length,
      arcgisFound: arcgisDatasets.length,
      totalUpserted,
      socrataError:
        socrataResult.status === "rejected"
          ? String(socrataResult.reason)
          : null,
      arcgisError:
        arcgisResult.status === "rejected"
          ? String(arcgisResult.reason)
          : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery error";
    console.error("[discover] Discovery cron failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
