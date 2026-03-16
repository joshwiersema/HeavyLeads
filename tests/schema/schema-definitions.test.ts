import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  organization,
  leads,
  bookmarks,
  organizationProfiles,
  leadEnrichments,
  scraperRuns,
} from "@/lib/db/schema";

describe("Schema definitions", () => {
  describe("organization table", () => {
    it("has industry column with default", () => {
      const cols = getTableColumns(organization);
      expect(cols).toHaveProperty("industry");
    });
  });

  describe("organization_profiles table", () => {
    it("is exported as organizationProfiles (not companyProfiles)", () => {
      expect(organizationProfiles).toBeDefined();
      // Verify it's a pgTable with the correct name
      const tableName = organizationProfiles._.name;
      expect(tableName).toBe("organization_profiles");
    });

    it("has all original columns", () => {
      const cols = getTableColumns(organizationProfiles);
      expect(cols).toHaveProperty("id");
      expect(cols).toHaveProperty("organizationId");
      expect(cols).toHaveProperty("hqAddress");
      expect(cols).toHaveProperty("hqLat");
      expect(cols).toHaveProperty("hqLng");
      expect(cols).toHaveProperty("serviceRadiusMiles");
      expect(cols).toHaveProperty("equipmentTypes");
      expect(cols).toHaveProperty("onboardingCompleted");
      expect(cols).toHaveProperty("createdAt");
      expect(cols).toHaveProperty("updatedAt");
    });

    it("has new multi-industry columns", () => {
      const cols = getTableColumns(organizationProfiles);
      expect(cols).toHaveProperty("specializations");
      expect(cols).toHaveProperty("serviceTypes");
      expect(cols).toHaveProperty("certifications");
      expect(cols).toHaveProperty("targetProjectValueMin");
      expect(cols).toHaveProperty("targetProjectValueMax");
      expect(cols).toHaveProperty("yearsInBusiness");
      expect(cols).toHaveProperty("companySize");
    });
  });

  describe("leads table", () => {
    it("has contentHash column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("contentHash");
    });

    it("has applicableIndustries array column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("applicableIndustries");
    });

    it("has valueTier column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("valueTier");
    });

    it("has severity column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("severity");
    });

    it("has deadline column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("deadline");
    });

    it("has location geometry column", () => {
      const cols = getTableColumns(leads);
      expect(cols).toHaveProperty("location");
    });
  });

  describe("bookmarks table", () => {
    it("has notes column", () => {
      const cols = getTableColumns(bookmarks);
      expect(cols).toHaveProperty("notes");
    });

    it("has pipelineStatus column", () => {
      const cols = getTableColumns(bookmarks);
      expect(cols).toHaveProperty("pipelineStatus");
    });
  });

  describe("leadEnrichments table", () => {
    it("is exported", () => {
      expect(leadEnrichments).toBeDefined();
    });

    it("has correct table name", () => {
      expect(leadEnrichments._.name).toBe("lead_enrichments");
    });

    it("has all expected columns", () => {
      const cols = getTableColumns(leadEnrichments);
      expect(cols).toHaveProperty("id");
      expect(cols).toHaveProperty("leadId");
      expect(cols).toHaveProperty("enrichmentType");
      expect(cols).toHaveProperty("data");
      expect(cols).toHaveProperty("source");
      expect(cols).toHaveProperty("fetchedAt");
      expect(cols).toHaveProperty("expiresAt");
    });
  });

  describe("scraperRuns table", () => {
    it("is exported", () => {
      expect(scraperRuns).toBeDefined();
    });

    it("has correct table name", () => {
      expect(scraperRuns._.name).toBe("scraper_runs");
    });

    it("has all expected columns", () => {
      const cols = getTableColumns(scraperRuns);
      expect(cols).toHaveProperty("id");
      expect(cols).toHaveProperty("pipelineRunId");
      expect(cols).toHaveProperty("adapterId");
      expect(cols).toHaveProperty("adapterName");
      expect(cols).toHaveProperty("industry");
      expect(cols).toHaveProperty("status");
      expect(cols).toHaveProperty("recordsFound");
      expect(cols).toHaveProperty("recordsStored");
      expect(cols).toHaveProperty("recordsSkipped");
      expect(cols).toHaveProperty("errorMessage");
      expect(cols).toHaveProperty("startedAt");
      expect(cols).toHaveProperty("completedAt");
    });
  });

  describe("schema/index.ts re-exports", () => {
    it("re-exports organizationProfiles from organization-profiles module", () => {
      // This test passes by virtue of the import above working
      expect(organizationProfiles).toBeDefined();
    });

    it("re-exports leadEnrichments", () => {
      expect(leadEnrichments).toBeDefined();
    });

    it("re-exports scraperRuns", () => {
      expect(scraperRuns).toBeDefined();
    });
  });
});
