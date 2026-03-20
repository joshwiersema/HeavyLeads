import type { ScraperAdapter, RawLeadData, SourceType } from "./base-adapter";
import { buildPermitTitle, toTitleCase } from "./utils";

/**
 * Field mapping from portal-specific column names to canonical lead fields.
 * Matches the FieldMapping type defined in field-mapper.ts (Plan 21-01).
 * Duplicated here to allow independent compilation before field-mapper exists.
 */
export interface FieldMapping {
  permitNumber?: string;
  description?: string;
  address?: string;
  projectType?: string;
  estimatedValue?: string;
  applicantName?: string;
  permitDate?: string;
  latitude?: string;
  longitude?: string;
}

/**
 * Configuration for a data portal dataset, matching the data_portals table shape.
 * Shared interface used by GenericSocrataAdapter and GenericArcGISAdapter.
 */
export interface DataPortalConfig {
  id: string;
  portalType: string;
  domain: string;
  datasetId: string;
  name: string;
  datasetType: string;
  city: string | null;
  state: string | null;
  jurisdiction: string | null;
  fieldMapping: FieldMapping;
  queryFilters: Record<string, unknown> | null;
  enabled: boolean;
  applicableIndustries: string[];
}

// ---------------------------------------------------------------------------
// ArcGIS response types
// ---------------------------------------------------------------------------

/** A single feature in a GeoJSON FeatureCollection from ArcGIS Hub */
interface ArcGISFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: number[];
  };
}

/** GeoJSON FeatureCollection response from ArcGIS Hub download endpoint */
interface ArcGISFeatureCollection {
  type: string;
  features: ArcGISFeature[];
}

/** Feature Service query response (non-GeoJSON format) */
interface ArcGISQueryResponse {
  features: Array<{
    attributes: Record<string, unknown>;
    geometry?: { x: number; y: number };
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of features to process per scrape run */
const MAX_FEATURES = 2000;

/**
 * GenericArcGISAdapter -- scrapes ArcGIS Hub datasets using config from a
 * data_portals row.
 *
 * Supports two fetch strategies:
 *   1. GeoJSON download (primary) -- matches the Atlanta permits pattern
 *   2. Feature Service query (fallback) -- for portals that block GeoJSON downloads
 *
 * ArcGIS GeoJSON includes coordinates in feature geometry, so geocoding can
 * be skipped for records that have geometry data.
 */
export class GenericArcGISAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly jurisdiction?: string;

  private readonly config: DataPortalConfig;

  constructor(config: DataPortalConfig) {
    this.config = config;
    this.sourceId = `portal-${config.domain}-${config.datasetId}`;
    this.sourceName = config.name;
    this.sourceType = this.mapDatasetType(config.datasetType);
    this.jurisdiction =
      config.jurisdiction ??
      (config.city && config.state
        ? `${config.city}, ${config.state}`
        : undefined);
  }

  /**
   * Scrape ArcGIS Hub dataset using GeoJSON download with Feature Service
   * query fallback.
   */
  async scrape(): Promise<RawLeadData[]> {
    const { domain, datasetId } = this.config;

    // Primary strategy: GeoJSON download (matches Atlanta adapter pattern)
    const geojsonUrl = `https://${domain}/api/v3/datasets/${datasetId}/downloads/data?format=geojson&spatialRefId=4326`;

    try {
      const response = await fetch(geojsonUrl);

      if (response.ok) {
        const data: ArcGISFeatureCollection = await response.json();

        if (!data.features || data.features.length === 0) {
          return [];
        }

        const limited = data.features.slice(0, MAX_FEATURES);
        return this.mapGeoJSONFeatures(limited);
      }

      // Non-200 response -- fall through to query fallback
    } catch {
      // Network error -- fall through to query fallback
    }

    // Fallback strategy: Feature Service query API
    return this.fetchViaQuery(domain, datasetId);
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Fetch data via ArcGIS Feature Service query endpoint (fallback).
   * Constructs a query that returns all fields with a reasonable record limit.
   */
  private async fetchViaQuery(
    domain: string,
    datasetId: string
  ): Promise<RawLeadData[]> {
    const queryUrl = `https://${domain}/api/v3/datasets/${datasetId}/query?where=1%3D1&outFields=*&f=json&resultRecordCount=1000`;

    const response = await fetch(queryUrl);

    if (!response.ok) {
      throw new Error(
        `ArcGIS ${domain} API error: ${response.status} ${response.statusText} (both GeoJSON download and query fallback failed)`
      );
    }

    const data: ArcGISQueryResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      return [];
    }

    const limited = data.features.slice(0, MAX_FEATURES);
    return this.mapQueryFeatures(limited);
  }

  /**
   * Map GeoJSON features to RawLeadData using the configured field mapping.
   * Coordinates come from feature.geometry.coordinates as [lng, lat] (GeoJSON standard).
   */
  private mapGeoJSONFeatures(features: ArcGISFeature[]): RawLeadData[] {
    const { fieldMapping, domain, datasetId } = this.config;
    const sourceUrl = `https://${domain}/api/v3/datasets/${datasetId}`;
    const results: RawLeadData[] = [];

    for (const feature of features) {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates;

      const lead = this.buildLeadFromRecord(props, fieldMapping, sourceUrl);

      // Extract coordinates from GeoJSON geometry ([lng, lat] ordering)
      if (coords && coords.length >= 2) {
        lead.lng = coords[0];
        lead.lat = coords[1];
      }

      // Ensure at least one identity field exists for deduplication
      if (lead.permitNumber || lead.title || lead.externalId) {
        results.push(lead);
      }
    }

    return results;
  }

  /**
   * Map Feature Service query features to RawLeadData using configured field mapping.
   * Coordinates come from feature.geometry as {x (lng), y (lat)}.
   */
  private mapQueryFeatures(
    features: ArcGISQueryResponse["features"]
  ): RawLeadData[] {
    const { fieldMapping, domain, datasetId } = this.config;
    const sourceUrl = `https://${domain}/api/v3/datasets/${datasetId}`;
    const results: RawLeadData[] = [];

    for (const feature of features) {
      const attrs = feature.attributes;

      const lead = this.buildLeadFromRecord(attrs, fieldMapping, sourceUrl);

      // Extract coordinates from query geometry ({x: lng, y: lat})
      if (feature.geometry) {
        lead.lng = feature.geometry.x;
        lead.lat = feature.geometry.y;
      }

      // Ensure at least one identity field exists for deduplication
      if (lead.permitNumber || lead.title || lead.externalId) {
        results.push(lead);
      }
    }

    return results;
  }

  /**
   * Build a RawLeadData record from a properties/attributes object using
   * the configured field mapping.
   */
  private buildLeadFromRecord(
    record: Record<string, unknown>,
    mapping: FieldMapping,
    sourceUrl: string
  ): RawLeadData {
    const permitNumber = this.extractString(record, mapping.permitNumber);
    const description = this.extractString(record, mapping.description);
    const rawAddress = this.extractString(record, mapping.address);
    const projectType = this.extractString(record, mapping.projectType);
    const applicantName = this.extractString(record, mapping.applicantName);

    const address = rawAddress ? toTitleCase(rawAddress) : undefined;

    // Parse estimated value
    let estimatedValue: number | undefined;
    if (mapping.estimatedValue) {
      const rawValue = record[mapping.estimatedValue];
      if (rawValue != null) {
        const parsed = parseFloat(String(rawValue));
        if (!isNaN(parsed)) {
          estimatedValue = parsed;
        }
      }
    }

    // Parse permit date
    let permitDate: Date | undefined;
    if (mapping.permitDate) {
      const rawDate = record[mapping.permitDate];
      if (rawDate != null) {
        const parsed = new Date(String(rawDate));
        if (!isNaN(parsed.getTime())) {
          permitDate = parsed;
        }
      }
    }

    // Extract explicit lat/lng from field mapping (supplement geometry coords)
    let lat: number | undefined;
    let lng: number | undefined;
    if (mapping.latitude) {
      const rawLat = record[mapping.latitude];
      if (rawLat != null) {
        const parsed = parseFloat(String(rawLat));
        if (!isNaN(parsed)) lat = parsed;
      }
    }
    if (mapping.longitude) {
      const rawLng = record[mapping.longitude];
      if (rawLng != null) {
        const parsed = parseFloat(String(rawLng));
        if (!isNaN(parsed)) lng = parsed;
      }
    }

    // Build title from available fields
    const title = buildPermitTitle({ description, projectType, address });

    return {
      permitNumber: permitNumber ?? undefined,
      title,
      description,
      address,
      projectType,
      estimatedValue,
      applicantName,
      permitDate,
      lat,
      lng,
      city: this.config.city ?? undefined,
      state: this.config.state ?? undefined,
      sourceUrl,
      sourceType: this.sourceType,
    };
  }

  /**
   * Safely extract a string value from a record using a field name.
   * Returns undefined if the field is not mapped or the value is null/undefined.
   */
  private extractString(
    record: Record<string, unknown>,
    fieldName: string | undefined
  ): string | undefined {
    if (!fieldName) return undefined;
    const value = record[fieldName];
    if (value == null) return undefined;
    return String(value);
  }

  /** Map dataset type string to SourceType enum value */
  private mapDatasetType(datasetType: string): SourceType {
    switch (datasetType.toLowerCase()) {
      case "permit":
        return "permit";
      case "violation":
        return "violation";
      case "bid":
        return "bid";
      default:
        return "permit";
    }
  }
}
