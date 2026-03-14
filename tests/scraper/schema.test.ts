import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { leads } from "@/lib/db/schema/leads";

describe("Leads table schema", () => {
  const config = getTableConfig(leads);

  it("has all required columns", () => {
    const columnNames = config.columns.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("permit_number");
    expect(columnNames).toContain("address");
    expect(columnNames).toContain("source_id");
    expect(columnNames).toContain("source_jurisdiction");
    expect(columnNames).toContain("scraped_at");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("lat");
    expect(columnNames).toContain("lng");
    expect(columnNames).toContain("description");
    expect(columnNames).toContain("formatted_address");
    expect(columnNames).toContain("project_type");
    expect(columnNames).toContain("estimated_value");
    expect(columnNames).toContain("applicant_name");
    expect(columnNames).toContain("permit_date");
    expect(columnNames).toContain("source_url");
  });

  it("has unique composite index on sourceId + permitNumber", () => {
    const indexes = config.indexes;
    const dedupIndex = indexes.find(
      (idx) => idx.config.name === "leads_source_permit_idx"
    );

    expect(dedupIndex).toBeDefined();
    expect(dedupIndex!.config.unique).toBe(true);

    // Verify it's on the right columns
    const indexColumns = dedupIndex!.config.columns.map((col) => {
      if ("name" in col) return col.name;
      return String(col);
    });
    expect(indexColumns).toContain("source_id");
    expect(indexColumns).toContain("permit_number");
  });

  it("has scraped_at index", () => {
    const indexes = config.indexes;
    const scrapedAtIndex = indexes.find(
      (idx) => idx.config.name === "leads_scraped_at_idx"
    );

    expect(scrapedAtIndex).toBeDefined();
  });
});
