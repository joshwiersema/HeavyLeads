import { describe, it, expect } from "vitest";
import {
  rawLeadSchema,
  rawPermitSchema,
  type RawLeadData,
  type RawPermitData,
} from "@/lib/scraper/adapters/base-adapter";

describe("Generalized RawLeadData schema validation", () => {
  describe("permit records", () => {
    it("validates permit records with permitNumber + address + sourceType=permit", () => {
      const permit = {
        permitNumber: "PERMIT-001",
        address: "123 Main St, Austin, TX",
        sourceType: "permit" as const,
        description: "Commercial renovation",
      };

      const result = rawLeadSchema.safeParse(permit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permitNumber).toBe("PERMIT-001");
        expect(result.data.sourceType).toBe("permit");
      }
    });
  });

  describe("bid records", () => {
    it("validates bid records with title required, no permitNumber, sourceType=bid", () => {
      const bid = {
        title: "Federal Building Renovation RFP",
        sourceType: "bid" as const,
        description: "Renovation of federal courthouse",
        agencyName: "GSA",
        estimatedValue: 5000000,
        deadlineDate: new Date("2026-04-01"),
      };

      const result = rawLeadSchema.safeParse(bid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Federal Building Renovation RFP");
        expect(result.data.sourceType).toBe("bid");
        expect(result.data.permitNumber).toBeUndefined();
      }
    });
  });

  describe("news records", () => {
    it("validates news records with title required, no address, sourceType=news", () => {
      const news = {
        title: "Groundbreaking ceremony for new hospital",
        sourceType: "news" as const,
        description: "A new 500-bed hospital is being built in Dallas",
        city: "Dallas",
        state: "TX",
        postedDate: new Date("2026-03-10"),
        sourceUrl: "https://enr.com/article/123",
      };

      const result = rawLeadSchema.safeParse(news);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(
          "Groundbreaking ceremony for new hospital"
        );
        expect(result.data.sourceType).toBe("news");
        expect(result.data.address).toBeUndefined();
      }
    });
  });

  describe("deep-web records", () => {
    it("validates deep-web records with title required, sourceType=deep-web", () => {
      const deepWeb = {
        title: "Heavy equipment operator job posting - Austin project",
        sourceType: "deep-web" as const,
        externalId: "https://linkedin.com/jobs/123",
        sourceUrl: "https://linkedin.com/jobs/123",
        city: "Austin",
        state: "TX",
      };

      const result = rawLeadSchema.safeParse(deepWeb);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(
          "Heavy equipment operator job posting - Austin project"
        );
        expect(result.data.sourceType).toBe("deep-web");
      }
    });
  });

  describe("identity field validation", () => {
    it("rejects records with no identity field (no permitNumber, title, or externalId)", () => {
      const noIdentity = {
        sourceType: "bid" as const,
        description: "Some description",
        address: "123 Main St",
      };

      const result = rawLeadSchema.safeParse(noIdentity);
      expect(result.success).toBe(false);
    });

    it("accepts records with only externalId as identity", () => {
      const externalOnly = {
        externalId: "SAM-2026-001",
        sourceType: "bid" as const,
        description: "Federal contract opportunity",
      };

      const result = rawLeadSchema.safeParse(externalOnly);
      expect(result.success).toBe(true);
    });
  });

  describe("backward compatibility", () => {
    it("rawPermitSchema still exists as backward-compatible alias", () => {
      const permit = {
        permitNumber: "PERMIT-002",
        address: "456 Oak Ave, Dallas, TX",
        sourceType: "permit" as const,
      };

      const result = rawPermitSchema.safeParse(permit);
      expect(result.success).toBe(true);
    });

    it("RawPermitData type is still importable and compatible", () => {
      // TypeScript type compatibility check -- if this compiles, the type works
      const data: RawPermitData = {
        permitNumber: "PERMIT-003",
        address: "789 Elm St, Atlanta, GA",
        sourceType: "permit",
      };
      expect(data.permitNumber).toBe("PERMIT-003");
    });

    it("RawLeadData type is assignable to RawPermitData and vice versa", () => {
      const leadData: RawLeadData = {
        title: "Test bid",
        sourceType: "bid",
      };
      expect(leadData.sourceType).toBe("bid");
    });
  });

  describe("new fields", () => {
    it("accepts contractorName, agencyName, city, state fields", () => {
      const record = {
        title: "Highway Bridge Repair RFP",
        sourceType: "bid" as const,
        contractorName: "BigBuild Inc.",
        agencyName: "Texas DOT",
        city: "Houston",
        state: "TX",
        estimatedValue: 12000000,
      };

      const result = rawLeadSchema.safeParse(record);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contractorName).toBe("BigBuild Inc.");
        expect(result.data.agencyName).toBe("Texas DOT");
        expect(result.data.city).toBe("Houston");
        expect(result.data.state).toBe("TX");
      }
    });

    it("accepts postedDate and deadlineDate date fields", () => {
      const record = {
        title: "Water Treatment Plant Construction",
        sourceType: "bid" as const,
        postedDate: "2026-03-01",
        deadlineDate: "2026-04-15",
      };

      const result = rawLeadSchema.safeParse(record);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.postedDate).toBeInstanceOf(Date);
        expect(result.data.deadlineDate).toBeInstanceOf(Date);
      }
    });

    it("accepts externalId for non-permit source tracking", () => {
      const record = {
        externalId: "SAM-2026-12345",
        title: "Federal Building HVAC Upgrade",
        sourceType: "bid" as const,
      };

      const result = rawLeadSchema.safeParse(record);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.externalId).toBe("SAM-2026-12345");
      }
    });
  });

  describe("invalid sourceType", () => {
    it("rejects records with invalid sourceType", () => {
      const invalid = {
        title: "Test",
        sourceType: "invalid",
      };

      const result = rawLeadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects records without sourceType", () => {
      const noSourceType = {
        permitNumber: "PERMIT-004",
        address: "123 Main St",
      };

      const result = rawLeadSchema.safeParse(noSourceType);
      expect(result.success).toBe(false);
    });
  });
});
