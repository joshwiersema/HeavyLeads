import type { ScraperAdapter, RawPermitData } from "./base-adapter";

/**
 * Atlanta GA building permits adapter.
 *
 * Fetches building permits from the City of Atlanta's ArcGIS Open Data Hub.
 * Uses the GeoJSON download endpoint for the building permits dataset.
 *
 * Dataset: 655f985f43cc40b4bf2ab7bc73d2169b (Building Permits)
 * Source: https://dpcd-coaplangis.opendata.arcgis.com
 *
 * Notable: ArcGIS GeoJSON includes coordinates in feature geometry,
 * so geocoding can be skipped for Atlanta records.
 */

interface ArcGISFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: number[];
  };
}

interface ArcGISFeatureCollection {
  type: string;
  features: ArcGISFeature[];
}

export class AtlantaPermitsAdapter implements ScraperAdapter {
  readonly sourceId = "atlanta-ga-permits";
  readonly sourceName = "City of Atlanta Building Permits";
  readonly jurisdiction = "Atlanta, GA";

  private readonly endpoint =
    "https://dpcd-coaplangis.opendata.arcgis.com/api/v3/datasets/655f985f43cc40b4bf2ab7bc73d2169b/downloads/data?format=geojson&spatialRefId=4326";

  async scrape(): Promise<RawPermitData[]> {
    const response = await fetch(this.endpoint);

    if (!response.ok) {
      throw new Error(
        `Atlanta permits API error: ${response.status} ${response.statusText}`
      );
    }

    const data: ArcGISFeatureCollection = await response.json();

    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map((feature) => {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates;

      return {
        permitNumber: (props.permit_number as string) ?? "",
        description: (props.description as string) || undefined,
        address: (props.address as string) ?? "",
        projectType: (props.permit_type as string) || undefined,
        permitDate: props.issue_date
          ? new Date(props.issue_date as string)
          : undefined,
        sourceUrl: this.endpoint,
        // ArcGIS GeoJSON coordinates are [lng, lat] order
        lat: coords ? coords[1] : undefined,
        lng: coords ? coords[0] : undefined,
      };
    });
  }
}
