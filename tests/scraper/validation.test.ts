import { describe, it, expect } from "vitest";
import { rawPermitSchema } from "@/lib/scraper/adapters/base-adapter";

describe("RawPermitData Zod validation", () => {
  it("accepts valid permit data with all fields", () => {
    const data = {
      permitNumber: "PERMIT-001",
      description: "Commercial renovation",
      address: "123 Main St, Austin, TX",
      projectType: "commercial",
      estimatedValue: 500000,
      applicantName: "Acme Corp",
      permitDate: new Date("2025-01-15"),
      sourceUrl: "https://example.com/permits/001",
      sourceType: "permit",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts data with only required fields (permitNumber, sourceType)", () => {
    const data = {
      permitNumber: "PERMIT-002",
      address: "456 Oak Ave, Dallas, TX",
      sourceType: "permit",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects data missing all identity fields (no permitNumber, title, or externalId)", () => {
    const data = {
      address: "123 Main St, Austin, TX",
      sourceType: "permit",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects data missing sourceType", () => {
    const data = {
      permitNumber: "PERMIT-003",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const data = {
      permitNumber: "PERMIT-004",
      address: "789 Pine Rd, Houston, TX",
      sourceType: "permit",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.projectType).toBeUndefined();
      expect(result.data.estimatedValue).toBeUndefined();
      expect(result.data.applicantName).toBeUndefined();
      expect(result.data.permitDate).toBeUndefined();
    }
  });

  it("coerces date strings to Date objects for permitDate", () => {
    const data = {
      permitNumber: "PERMIT-005",
      address: "321 Elm St, San Antonio, TX",
      permitDate: "2025-06-15",
      sourceType: "permit",
    };

    const result = rawPermitSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permitDate).toBeInstanceOf(Date);
    }
  });
});
