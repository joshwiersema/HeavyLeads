import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const organizationProfiles = pgTable("organization_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().unique(),
  hqAddress: text("hq_address"),
  hqLat: real("hq_lat"),
  hqLng: real("hq_lng"),
  serviceRadiusMiles: real("service_radius_miles").default(50),
  equipmentTypes: text("equipment_types").array().default([]),
  specializations: text("specializations").array(),
  serviceTypes: text("service_types").array(),
  certifications: text("certifications").array(),
  targetProjectValueMin: integer("target_project_value_min"),
  targetProjectValueMax: integer("target_project_value_max"),
  yearsInBusiness: integer("years_in_business"),
  companySize: text("company_size"),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Backward-compatible alias for existing code that imports companyProfiles.
 * Consumers should migrate to organizationProfiles over time.
 */
export const companyProfiles = organizationProfiles;
