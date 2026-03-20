/**
 * Seed script for migrating existing hardcoded adapter configs to data_portals.
 *
 * Upserts the 6 existing city adapter configurations (3 permits + 3 violations)
 * as data_portals rows so they can be managed via the database alongside
 * auto-discovered portals.
 *
 * Usage: npx tsx src/lib/scraper/seed-portals.ts
 */

import { db } from "@/lib/db";
import { dataPortals } from "@/lib/db/schema/data-portals";
import { sql } from "drizzle-orm";

interface SeedPortal {
  portalType: string;
  domain: string;
  datasetId: string;
  name: string;
  datasetType: string;
  city: string;
  state: string;
  jurisdiction: string;
  fieldMapping: Record<string, string>;
  discoveredBy: string;
  enabled: boolean;
  applicableIndustries: string[];
}

const SEED_PORTALS: SeedPortal[] = [
  // ---- Permits ----
  {
    portalType: "socrata",
    domain: "data.austintexas.gov",
    datasetId: "3syk-w9eu",
    name: "City of Austin Issued Construction Permits",
    datasetType: "permit",
    city: "Austin",
    state: "TX",
    jurisdiction: "Austin, TX",
    fieldMapping: {
      permitNumber: "permit_number",
      description: "description",
      address: "permit_location",
      projectType: "permit_type_desc",
      permitDate: "issue_date",
      latitude: "latitude",
      longitude: "longitude",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: [
      "heavy_equipment",
      "hvac",
      "roofing",
      "solar",
      "electrical",
    ],
  },
  {
    portalType: "socrata",
    domain: "www.dallasopendata.com",
    datasetId: "e7gq-4sah",
    name: "City of Dallas Building Permits",
    datasetType: "permit",
    city: "Dallas",
    state: "TX",
    jurisdiction: "Dallas, TX",
    fieldMapping: {
      permitNumber: "permit_number",
      description: "work_description",
      address: "street_address",
      projectType: "permit_type",
      estimatedValue: "value",
      applicantName: "contractor",
      permitDate: "issued_date",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: [
      "heavy_equipment",
      "hvac",
      "roofing",
      "solar",
      "electrical",
    ],
  },
  {
    portalType: "arcgis",
    domain: "dpcd-coaplangis.opendata.arcgis.com",
    datasetId: "655f985f43cc40b4bf2ab7bc73d2169b",
    name: "City of Atlanta Building Permits",
    datasetType: "permit",
    city: "Atlanta",
    state: "GA",
    jurisdiction: "Atlanta, GA",
    fieldMapping: {
      permitNumber: "permit_number",
      description: "description",
      address: "address",
      projectType: "permit_type",
      permitDate: "issue_date",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: [
      "heavy_equipment",
      "hvac",
      "roofing",
      "solar",
      "electrical",
    ],
  },

  // ---- Violations ----
  {
    portalType: "socrata",
    domain: "data.austintexas.gov",
    datasetId: "ckex-2zb9",
    name: "City of Austin Code Violations",
    datasetType: "violation",
    city: "Austin",
    state: "TX",
    jurisdiction: "Austin, TX",
    fieldMapping: {
      permitNumber: "case_id",
      description: "description",
      address: "address",
      projectType: "case_type",
      permitDate: "date_opened",
      latitude: "latitude",
      longitude: "longitude",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: ["hvac", "roofing", "electrical"],
  },
  {
    portalType: "socrata",
    domain: "www.dallasopendata.com",
    datasetId: "46i7-rbhj",
    name: "City of Dallas Code Compliance",
    datasetType: "violation",
    city: "Dallas",
    state: "TX",
    jurisdiction: "Dallas, TX",
    fieldMapping: {
      permitNumber: "case_number",
      description: "case_description",
      address: "location",
      projectType: "violation_type",
      permitDate: "date_filed",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: ["hvac", "roofing", "electrical"],
  },
  {
    portalType: "socrata",
    domain: "data.houstontx.gov",
    datasetId: "k6hb-wr87",
    name: "City of Houston Code Enforcement",
    datasetType: "violation",
    city: "Houston",
    state: "TX",
    jurisdiction: "Houston, TX",
    fieldMapping: {
      permitNumber: "case_number",
      description: "violation_description",
      address: "street_address",
      permitDate: "violation_date",
      latitude: "latitude",
      longitude: "longitude",
    },
    discoveredBy: "manual",
    enabled: true,
    applicableIndustries: ["hvac", "roofing", "electrical"],
  },
];

/**
 * Upsert all existing city adapter configs into the data_portals table.
 *
 * Uses ON CONFLICT DO UPDATE on (domain, datasetId) unique index to
 * ensure idempotent re-runs. Updates field mapping and name on conflict
 * but preserves the enabled flag.
 */
export async function seedExistingPortals(): Promise<number> {
  let seeded = 0;

  for (const portal of SEED_PORTALS) {
    await db
      .insert(dataPortals)
      .values({
        portalType: portal.portalType,
        domain: portal.domain,
        datasetId: portal.datasetId,
        name: portal.name,
        datasetType: portal.datasetType,
        city: portal.city,
        state: portal.state,
        jurisdiction: portal.jurisdiction,
        fieldMapping: portal.fieldMapping,
        discoveredBy: portal.discoveredBy,
        enabled: portal.enabled,
        applicableIndustries: portal.applicableIndustries,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dataPortals.domain, dataPortals.datasetId],
        set: {
          name: sql`excluded.name`,
          fieldMapping: sql`excluded.field_mapping`,
          applicableIndustries: sql`excluded.applicable_industries`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    seeded++;
  }

  console.log(`[seed-portals] Seeded ${seeded} portal configs`);
  return seeded;
}

// Run directly when executed via: npx tsx src/lib/scraper/seed-portals.ts
async function main() {
  try {
    const count = await seedExistingPortals();
    console.log(`Done. Seeded ${count} portals.`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

main();
