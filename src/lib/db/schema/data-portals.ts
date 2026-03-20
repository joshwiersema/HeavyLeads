import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Data portals -- stores discovered Socrata and ArcGIS portal configurations.
 *
 * Each row represents a single dataset (e.g., "Austin building permits" or
 * "Dallas code violations") from a specific portal. The field_mapping JSONB
 * column maps generic lead fields to portal-specific column names, eliminating
 * the need for per-city TypeScript adapter files.
 *
 * Used by Phase 21's GenericSocrataAdapter and GenericArcGISAdapter to read
 * their config from the database at runtime.
 */
export const dataPortals = pgTable(
  "data_portals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Portal platform type */
    portalType: text("portal_type").notNull(), // "socrata" | "arcgis"
    /** Portal domain (e.g., "data.austintexas.gov", "hub.arcgis.com") */
    domain: text("domain").notNull(),
    /** Dataset identifier on the portal */
    datasetId: text("dataset_id").notNull(),
    /** Human-readable name (e.g., "City of Austin Building Permits") */
    name: text("name").notNull(),
    /** Dataset type for lead classification */
    datasetType: text("dataset_type").notNull(), // "permit" | "violation" | "inspection"
    /** City/jurisdiction name */
    city: text("city"),
    /** State abbreviation (e.g., "TX", "CA") */
    state: text("state"),
    /** Jurisdiction string for leads (e.g., "Austin, TX") */
    jurisdiction: text("jurisdiction"),
    /**
     * JSONB field mapping from portal columns to lead fields.
     * Structure follows SocrataConfig.fieldMap pattern:
     * {
     *   permitNumber: "permit_num",
     *   description: "work_description",
     *   address: "original_address",
     *   projectType: "permit_type_desc",
     *   estimatedValue: "total_valuation",
     *   applicantName: "applicant_full_name",
     *   permitDate: "issued_date",
     *   latitude: "latitude",
     *   longitude: "longitude"
     * }
     */
    fieldMapping: jsonb("field_mapping").notNull(),
    /** Additional query filters as JSONB (e.g., SoQL WHERE clauses) */
    queryFilters: jsonb("query_filters"),
    /** Whether this portal is actively scraped */
    enabled: boolean("enabled").notNull().default(true),
    /** Confidence score from auto-discovery (0-1) */
    confidence: text("confidence"),
    /** How this entry was created */
    discoveredBy: text("discovered_by"), // "manual" | "socrata-discovery" | "arcgis-discovery"
    /** Industries this portal's data applies to */
    applicableIndustries: text("applicable_industries").array().default([]),
    /** Last time data was successfully scraped from this portal */
    lastScrapedAt: timestamp("last_scraped_at"),
    /** Last time this portal config was verified/updated */
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("data_portals_domain_dataset_idx").on(
      table.domain,
      table.datasetId
    ),
    index("data_portals_type_idx").on(table.portalType),
    index("data_portals_state_idx").on(table.state),
    index("data_portals_enabled_idx").on(table.enabled),
  ]
);
