import { describe, it, expect } from "vitest";
import { inferFieldMapping, FIELD_ALIASES, type FieldMapping } from "@/lib/scraper/field-mapper";

describe("inferFieldMapping", () => {
  // --- permitNumber mapping ---
  it("maps 'permit_number' to permitNumber", () => {
    const result = inferFieldMapping(["permit_number"]);
    expect(result.mapping.permitNumber).toBe("permit_number");
  });

  it("maps 'permit_no' to permitNumber", () => {
    const result = inferFieldMapping(["permit_no"]);
    expect(result.mapping.permitNumber).toBe("permit_no");
  });

  it("maps 'PERMIT_NUM' to permitNumber (case insensitive)", () => {
    const result = inferFieldMapping(["PERMIT_NUM"]);
    expect(result.mapping.permitNumber).toBe("PERMIT_NUM");
  });

  it("maps 'permitnumber' to permitNumber (no separator)", () => {
    const result = inferFieldMapping(["permitnumber"]);
    expect(result.mapping.permitNumber).toBe("permitnumber");
  });

  // --- permitDate mapping ---
  it("maps 'issue_date' to permitDate", () => {
    const result = inferFieldMapping(["issue_date"]);
    expect(result.mapping.permitDate).toBe("issue_date");
  });

  it("maps 'issued_date' to permitDate", () => {
    const result = inferFieldMapping(["issued_date"]);
    expect(result.mapping.permitDate).toBe("issued_date");
  });

  it("maps 'date_issued' to permitDate", () => {
    const result = inferFieldMapping(["date_issued"]);
    expect(result.mapping.permitDate).toBe("date_issued");
  });

  it("maps 'date_filed' to permitDate", () => {
    const result = inferFieldMapping(["date_filed"]);
    expect(result.mapping.permitDate).toBe("date_filed");
  });

  // --- address mapping ---
  it("maps 'permit_location' to address", () => {
    const result = inferFieldMapping(["permit_location"]);
    expect(result.mapping.address).toBe("permit_location");
  });

  it("maps 'street_address' to address", () => {
    const result = inferFieldMapping(["street_address"]);
    expect(result.mapping.address).toBe("street_address");
  });

  it("maps 'site_address' to address", () => {
    const result = inferFieldMapping(["site_address"]);
    expect(result.mapping.address).toBe("site_address");
  });

  it("maps 'location' to address (only when no lat/lng alias match)", () => {
    // "location" alone should map to address
    const result = inferFieldMapping(["location"]);
    expect(result.mapping.address).toBe("location");
  });

  // --- description mapping ---
  it("maps 'work_description' to description", () => {
    const result = inferFieldMapping(["work_description"]);
    expect(result.mapping.description).toBe("work_description");
  });

  it("maps 'scope_of_work' to description", () => {
    const result = inferFieldMapping(["scope_of_work"]);
    expect(result.mapping.description).toBe("scope_of_work");
  });

  // --- projectType mapping ---
  it("maps 'permit_type_desc' to projectType", () => {
    const result = inferFieldMapping(["permit_type_desc"]);
    expect(result.mapping.projectType).toBe("permit_type_desc");
  });

  it("maps 'work_type' to projectType", () => {
    const result = inferFieldMapping(["work_type"]);
    expect(result.mapping.projectType).toBe("work_type");
  });

  // --- estimatedValue mapping ---
  it("maps 'valuation' to estimatedValue", () => {
    const result = inferFieldMapping(["valuation"]);
    expect(result.mapping.estimatedValue).toBe("valuation");
  });

  it("maps 'total_valuation' to estimatedValue", () => {
    const result = inferFieldMapping(["total_valuation"]);
    expect(result.mapping.estimatedValue).toBe("total_valuation");
  });

  it("maps 'estimated_cost' to estimatedValue", () => {
    const result = inferFieldMapping(["estimated_cost"]);
    expect(result.mapping.estimatedValue).toBe("estimated_cost");
  });

  // --- latitude / longitude mapping ---
  it("maps lat/lng aliases correctly", () => {
    const latAliases = ["latitude", "lat", "y"];
    const lngAliases = ["longitude", "lng", "lon", "x"];

    for (const latAlias of latAliases) {
      const result = inferFieldMapping([latAlias]);
      expect(result.mapping.latitude).toBe(latAlias);
    }

    for (const lngAlias of lngAliases) {
      const result = inferFieldMapping([lngAlias]);
      expect(result.mapping.longitude).toBe(lngAlias);
    }
  });

  // --- Confidence score ---
  it("returns confidence score based on mapped fields count", () => {
    // 2 fields mapped out of 9 total canonical fields
    const result = inferFieldMapping(["permit_number", "issue_date"]);
    expect(result.confidence).toBeCloseTo(2 / 9, 2);
  });

  // --- Real-world Austin columns ---
  it("maps Austin columns to a complete mapping", () => {
    const austinColumns = [
      "permit_number",
      "description",
      "permit_location",
      "permit_type_desc",
      "issue_date",
      "latitude",
      "longitude",
    ];
    const result = inferFieldMapping(austinColumns);

    expect(result.mapping.permitNumber).toBe("permit_number");
    expect(result.mapping.description).toBe("description");
    expect(result.mapping.address).toBe("permit_location");
    expect(result.mapping.projectType).toBe("permit_type_desc");
    expect(result.mapping.permitDate).toBe("issue_date");
    expect(result.mapping.latitude).toBe("latitude");
    expect(result.mapping.longitude).toBe("longitude");
    expect(result.confidence).toBeGreaterThanOrEqual(0.77);
  });

  // --- Real-world Dallas columns ---
  it("maps Dallas columns to a complete mapping", () => {
    const dallasColumns = [
      "permit_number",
      "work_description",
      "street_address",
      "permit_type",
      "value",
      "contractor",
      "issued_date",
    ];
    const result = inferFieldMapping(dallasColumns);

    expect(result.mapping.permitNumber).toBe("permit_number");
    expect(result.mapping.description).toBe("work_description");
    expect(result.mapping.address).toBe("street_address");
    expect(result.mapping.projectType).toBe("permit_type");
    expect(result.mapping.estimatedValue).toBe("value");
    expect(result.mapping.applicantName).toBe("contractor");
    expect(result.mapping.permitDate).toBe("issued_date");
    expect(result.confidence).toBeGreaterThanOrEqual(0.77);
  });

  // --- Unmappable columns ---
  it("ignores unmappable columns", () => {
    const result = inferFieldMapping(["random_column", "foo_bar", "permit_number"]);
    expect(result.mapping.permitNumber).toBe("permit_number");
    expect(result.unmapped).toContain("random_column");
    expect(result.unmapped).toContain("foo_bar");
    expect(result.unmapped).not.toContain("permit_number");
  });

  // --- Empty input ---
  it("returns empty mapping with confidence 0 for empty column list", () => {
    const result = inferFieldMapping([]);
    expect(result.mapping).toEqual({});
    expect(result.confidence).toBe(0);
    expect(result.unmapped).toEqual([]);
  });
});

describe("FIELD_ALIASES", () => {
  it("contains aliases for all 9 canonical fields", () => {
    const expectedFields = [
      "permitNumber",
      "description",
      "address",
      "projectType",
      "estimatedValue",
      "applicantName",
      "permitDate",
      "latitude",
      "longitude",
    ];
    for (const field of expectedFields) {
      expect(FIELD_ALIASES).toHaveProperty(field);
      expect(Array.isArray(FIELD_ALIASES[field as keyof typeof FIELD_ALIASES])).toBe(true);
      expect(FIELD_ALIASES[field as keyof typeof FIELD_ALIASES].length).toBeGreaterThan(0);
    }
  });

  it("has all aliases in lowercase", () => {
    for (const [, aliases] of Object.entries(FIELD_ALIASES)) {
      for (const alias of aliases) {
        expect(alias).toBe(alias.toLowerCase());
      }
    }
  });
});
