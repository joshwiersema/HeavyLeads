import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { StormAlert, SubscriberInfo } from "./types";

/**
 * Haversine distance in miles between two lat/lng points.
 * Exported for unit testing and reuse.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get active storm alerts within an organization's service area.
 *
 * Queries leads WHERE sourceType='storm' AND deadlineDate > now,
 * filtered by haversine distance from org HQ to lead lat/lng
 * within org serviceRadiusMiles.
 *
 * Returns at most 10 alerts, ordered by soonest expiring first.
 */
export async function getActiveStormAlertsForOrg(
  orgId: string
): Promise<StormAlert[]> {
  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.title,
      l.description,
      l.severity,
      l.city,
      l.state,
      l.lat,
      l.lng,
      l.deadline_date,
      l.source_url
    FROM leads l
    INNER JOIN organization_profiles op
      ON op.organization_id = ${orgId}
    WHERE l.source_type = 'storm'
      AND l.deadline_date > NOW()
      AND l.lat IS NOT NULL
      AND l.lng IS NOT NULL
      AND op.hq_lat IS NOT NULL
      AND op.hq_lng IS NOT NULL
      AND (
        3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(op.hq_lat)) * cos(radians(l.lat))
            * cos(radians(l.lng) - radians(op.hq_lng))
            + sin(radians(op.hq_lat)) * sin(radians(l.lat))
          ))
        )
      ) <= COALESCE(op.service_radius_miles, 50)
    ORDER BY l.deadline_date ASC
    LIMIT 10
  `);

  return (rows as unknown as Record<string, unknown>[]).map(mapRowToStormAlert);
}

/**
 * Find roofing subscribers whose service area intersects with a storm location.
 *
 * Queries organizations WHERE industry='roofing', joins org profiles
 * for HQ coordinates and service radius, filters by haversine distance
 * from the storm centroid, and returns subscriber info including email.
 */
export async function getRoofingSubscribersInStormArea(
  stormLat: number,
  stormLng: number
): Promise<SubscriberInfo[]> {
  const rows = await db.execute(sql`
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      u.id AS user_id,
      u.name AS user_name,
      u.email,
      op.hq_lat,
      op.hq_lng,
      op.service_radius_miles
    FROM organization o
    INNER JOIN organization_profiles op
      ON op.organization_id = o.id
    INNER JOIN member m
      ON m.organization_id = o.id
    INNER JOIN "user" u
      ON u.id = m.user_id
    WHERE o.industry = 'roofing'
      AND op.hq_lat IS NOT NULL
      AND op.hq_lng IS NOT NULL
      AND (
        3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(op.hq_lat)) * cos(radians(${stormLat}))
            * cos(radians(${stormLng}) - radians(op.hq_lng))
            + sin(radians(op.hq_lat)) * sin(radians(${stormLat}))
          ))
        )
      ) <= COALESCE(op.service_radius_miles, 50)
  `);

  return (rows as unknown as Record<string, unknown>[]).map(
    mapRowToSubscriber
  );
}

function mapRowToStormAlert(row: Record<string, unknown>): StormAlert {
  return {
    id: row.id as string,
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    severity: (row.severity as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    expiresAt: row.deadline_date ? (row.deadline_date as Date) : null,
    sourceUrl: (row.source_url as string) ?? null,
  };
}

function mapRowToSubscriber(row: Record<string, unknown>): SubscriberInfo {
  return {
    orgId: row.org_id as string,
    orgName: row.org_name as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    email: row.email as string,
    hqLat: row.hq_lat as number,
    hqLng: row.hq_lng as number,
    serviceRadiusMiles: (row.service_radius_miles as number) ?? 50,
  };
}
