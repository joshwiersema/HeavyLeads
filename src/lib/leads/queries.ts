import { sql, getTableColumns, and, isNotNull, eq, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { inferEquipmentNeeds } from "./equipment-inference";
import { scoreLead } from "./scoring";
import { getFreshnessBadge } from "./types";
import { mapTimeline } from "./timeline";
import type { EnrichedLead, InferredEquipment } from "./types";

// -- Pure helper (exported for testability) --

const EARTH_RADIUS_MILES = 3959;

/**
 * Computes the great-circle distance in miles between two points
 * using the Haversine formula.
 *
 * This pure TypeScript implementation is used for:
 * - Testing without a database
 * - Computing distance for single-lead lookups (getLeadById)
 *
 * The same formula is embedded as SQL for the filtered feed query.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  // Clamp to avoid floating-point domain errors in acos
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));

  return EARTH_RADIUS_MILES * c;
}

// -- Equipment filtering (exported for testability) --

/**
 * Filters enriched leads by equipment type overlap.
 * If no filter is provided or the filter is empty, all leads pass through.
 */
export function filterByEquipment(
  enrichedLeads: EnrichedLead[],
  equipmentFilter: string[] | undefined
): EnrichedLead[] {
  if (!equipmentFilter || equipmentFilter.length === 0) {
    return enrichedLeads;
  }

  return enrichedLeads.filter((lead) =>
    lead.inferredEquipment.some((eq) => equipmentFilter.includes(eq.type))
  );
}

// -- Query parameters --

export interface GetFilteredLeadsParams {
  hqLat: number;
  hqLng: number;
  serviceRadiusMiles: number;
  dealerEquipment: string[];
  radiusMiles?: number;
  equipmentFilter?: string[];
  limit?: number;
  offset?: number;
}

export interface GetLeadByIdParams {
  hqLat?: number;
  hqLng?: number;
  serviceRadiusMiles?: number;
  dealerEquipment?: string[];
}

// -- Main feed query --

/**
 * Fetches leads within a geographic radius from dealer HQ, enriches each
 * with inferred equipment, score, freshness, and timeline, optionally
 * filters by equipment type, and returns sorted by score DESC.
 */
export async function getFilteredLeads(
  params: GetFilteredLeadsParams
): Promise<EnrichedLead[]> {
  const {
    hqLat,
    hqLng,
    serviceRadiusMiles,
    dealerEquipment,
    radiusMiles = serviceRadiusMiles,
    equipmentFilter,
    limit = 50,
    offset = 0,
  } = params;

  // Haversine distance SQL expression with LEAST/GREATEST clamp for float safety
  const distanceExpr = sql<number>`
    3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${hqLat}))
        * cos(radians(${leads.lat}))
        * cos(radians(${leads.lng}) - radians(${hqLng}))
        + sin(radians(${hqLat}))
        * sin(radians(${leads.lat}))
      ))
    )
  `.mapWith(Number);

  // Repeat the full Haversine expression in WHERE (cannot reference SELECT alias in PostgreSQL)
  const rows = await db
    .select({
      ...getTableColumns(leads),
      distance: distanceExpr,
    })
    .from(leads)
    .where(
      and(
        isNotNull(leads.lat),
        isNotNull(leads.lng),
        sql`3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${hqLat}))
            * cos(radians(${leads.lat}))
            * cos(radians(${leads.lng}) - radians(${hqLng}))
            + sin(radians(${hqLat}))
            * sin(radians(${leads.lat}))
          ))
        ) <= ${radiusMiles}`
      )
    )
    .orderBy(desc(leads.scrapedAt))
    .limit(limit)
    .offset(offset);

  // Enrich each lead with intelligence
  let enriched: EnrichedLead[] = rows.map((row) => {
    const inferred = inferEquipmentNeeds(row.projectType, row.description);
    const inferredTypes = inferred.map((i) => i.type);

    return {
      ...row,
      inferredEquipment: inferred,
      score: scoreLead({
        inferredEquipment: inferredTypes,
        dealerEquipment,
        distanceMiles: row.distance,
        serviceRadiusMiles,
        estimatedValue: row.estimatedValue,
      }),
      freshness: getFreshnessBadge(row.scrapedAt),
      timeline: mapTimeline(row.projectType, row.description),
    };
  });

  // Post-query equipment filter
  enriched = filterByEquipment(enriched, equipmentFilter);

  // Sort by score DESC, then scrapedAt DESC as tiebreaker
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.scrapedAt.getTime() - a.scrapedAt.getTime();
  });

  return enriched;
}

// -- Single lead query --

/**
 * Fetches a single lead by ID and enriches it with intelligence data.
 * Returns null if the lead is not found.
 *
 * If HQ coordinates and dealer equipment are provided, computes distance
 * and score. Otherwise, distance defaults to null and score to 0.
 */
export async function getLeadById(
  id: string,
  params?: GetLeadByIdParams
): Promise<EnrichedLead | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  const inferred = inferEquipmentNeeds(row.projectType, row.description);
  const inferredTypes = inferred.map((i) => i.type);

  // Compute distance if HQ coordinates and lead coordinates are available
  let distance: number | null = null;
  if (
    params?.hqLat != null &&
    params?.hqLng != null &&
    row.lat != null &&
    row.lng != null
  ) {
    distance = haversineDistance(params.hqLat, params.hqLng, row.lat, row.lng);
  }

  const score =
    params?.dealerEquipment && params?.serviceRadiusMiles && distance != null
      ? scoreLead({
          inferredEquipment: inferredTypes,
          dealerEquipment: params.dealerEquipment,
          distanceMiles: distance,
          serviceRadiusMiles: params.serviceRadiusMiles,
          estimatedValue: row.estimatedValue,
        })
      : 0;

  return {
    ...row,
    distance,
    inferredEquipment: inferred,
    score,
    freshness: getFreshnessBadge(row.scrapedAt),
    timeline: mapTimeline(row.projectType, row.description),
  };
}

// -- Lead sources query --

/** Shape of a lead source record from the lead_sources table */
export interface LeadSource {
  id: string;
  leadId: string;
  sourceId: string;
  sourceType: string;
  externalId: string | null;
  sourceUrl: string | null;
  title: string | null;
  discoveredAt: Date;
}

/**
 * Fetch all source references for a given lead, ordered by discovery date ascending.
 * Returns an empty array if the lead has no source entries.
 */
export async function getLeadSources(leadId: string): Promise<LeadSource[]> {
  const rows = await db
    .select()
    .from(leadSources)
    .where(eq(leadSources.leadId, leadId))
    .orderBy(asc(leadSources.discoveredAt));

  return rows;
}
