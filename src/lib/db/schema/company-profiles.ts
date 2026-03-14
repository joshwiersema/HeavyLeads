import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().unique(),
  hqAddress: text("hq_address"),
  hqLat: real("hq_lat"),
  hqLng: real("hq_lng"),
  serviceRadiusMiles: real("service_radius_miles").default(50),
  equipmentTypes: text("equipment_types").array().default([]),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
