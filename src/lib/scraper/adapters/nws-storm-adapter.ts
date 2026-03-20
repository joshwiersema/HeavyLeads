import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getNwsQueue } from "../api-rate-limiter";

/**
 * Roofing-relevant NWS alert event types.
 * These events produce damage that creates demand for roofing, heavy equipment,
 * and related blue-collar services.
 */
const ROOFING_STORM_EVENTS = new Set([
  "Tornado Warning",
  "Severe Thunderstorm Warning",
  "Hail Advisory",
  "Wind Advisory",
  "Hurricane Warning",
  "Tropical Storm Warning",
  "Flash Flood Warning",
]);

/** NWS GeoJSON feature properties */
interface NwsAlertProperties {
  id: string;
  headline: string;
  description: string;
  event: string;
  severity: string;
  effective: string;
  expires: string;
  senderName: string;
  areaDesc: string;
}

/** NWS GeoJSON feature */
interface NwsFeature {
  properties: NwsAlertProperties;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  } | null;
}

/** NWS GeoJSON response */
interface NwsResponse {
  type: string;
  features: NwsFeature[];
}

/**
 * Extract 2-letter US state code from NWS senderName or areaDesc.
 * senderName format: "NWS Fort Worth TX"
 * areaDesc format: "Dallas, TX; Tarrant, TX"
 */
function extractState(senderName: string, areaDesc: string): string | undefined {
  // Try senderName first: last 2-letter word
  const senderMatch = senderName.match(/\b([A-Z]{2})\s*$/);
  if (senderMatch) return senderMatch[1];

  // Fallback: extract from areaDesc (e.g. "Dallas, TX")
  const areaMatch = areaDesc.match(/,\s*([A-Z]{2})\b/);
  if (areaMatch) return areaMatch[1];

  return undefined;
}

/**
 * Parse the first city name from areaDesc.
 * areaDesc format: "Dallas, TX; Tarrant, TX; Denton, TX"
 * Returns "Dallas" (first segment before comma).
 */
function parseCity(areaDesc: string): string | undefined {
  const firstSegment = areaDesc.split(";")[0]?.trim();
  if (!firstSegment) return undefined;
  const city = firstSegment.split(",")[0]?.trim();
  return city || undefined;
}

/**
 * Compute centroid from GeoJSON geometry.
 * - Polygon: average all coordinates[0] ring points
 * - Point: use coordinates directly
 * - null: return undefined
 */
function computeCentroid(
  geometry: NwsFeature["geometry"]
): { lat: number; lng: number } | undefined {
  if (!geometry) return undefined;

  if (geometry.type === "Point") {
    const coords = geometry.coordinates as number[];
    return { lat: coords[1], lng: coords[0] };
  }

  if (geometry.type === "Polygon") {
    const ring = (geometry.coordinates as number[][][])[0];
    if (!ring || ring.length === 0) return undefined;

    let sumLat = 0;
    let sumLng = 0;
    for (const point of ring) {
      sumLng += point[0];
      sumLat += point[1];
    }
    return {
      lat: sumLat / ring.length,
      lng: sumLng / ring.length,
    };
  }

  return undefined;
}

/**
 * NWS Active Storm Alerts adapter.
 *
 * Fetches active weather alerts from the National Weather Service API,
 * filters for roofing-relevant storm events (tornadoes, severe thunderstorms,
 * hail, hurricanes, flash floods), and converts them to RawLeadData for
 * the scraper pipeline.
 *
 * NWS API Terms: identify with User-Agent, be reasonable about rate.
 */
export class NwsStormAdapter implements ScraperAdapter {
  readonly sourceId = "nws-storm-alerts";
  readonly sourceName = "NWS Active Storm Alerts";
  readonly sourceType = "storm" as const;

  async scrape(): Promise<RawLeadData[]> {
    const queue = await getNwsQueue();

    return queue.add(async () => {
      try {
        const response = await fetch(
          "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
          {
            headers: {
              "User-Agent": "HeavyLeads/1.0 (heavyleads.com)",
              Accept: "application/geo+json",
            },
          }
        );

        if (!response.ok) {
          console.warn(
            `[nws-storm] API returned ${response.status} ${response.statusText}`
          );
          return [];
        }

        const data: NwsResponse = await response.json();

        if (!data.features || data.features.length === 0) {
          return [];
        }

        const results: RawLeadData[] = [];

        for (const feature of data.features) {
          const { properties } = feature;

          // Filter for roofing-relevant events
          if (!ROOFING_STORM_EVENTS.has(properties.event)) {
            continue;
          }

          const centroid = computeCentroid(feature.geometry);
          const state = extractState(
            properties.senderName,
            properties.areaDesc
          );
          const city = parseCity(properties.areaDesc);

          const lead: RawLeadData = {
            externalId: properties.id,
            title: properties.headline,
            description: properties.description
              ? properties.description.slice(0, 2000)
              : undefined,
            sourceType: "storm",
            ...(centroid ? { lat: centroid.lat, lng: centroid.lng } : {}),
            state,
            city,
            postedDate: new Date(properties.effective),
            deadlineDate: new Date(properties.expires),
            sourceUrl: `https://alerts.weather.gov/search?id=${encodeURIComponent(properties.id)}`,
          };

          results.push(lead);
        }

        return results;
      } catch (error) {
        console.warn(
          "[nws-storm] Fetch failed:",
          error instanceof Error ? error.message : error
        );
        return [];
      }
    }) as Promise<RawLeadData[]>;
  }
}
