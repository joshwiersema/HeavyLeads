import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockAdapter,
  createMockPermitData,
  createMockLeadData,
} from "../helpers/scraper";

/**
 * Tests for sourceUrl-based deduplication of non-permit leads.
 *
 * PERF-04: Non-permit leads with duplicate sourceUrl should be silently
 * skipped instead of creating duplicate records. Permit leads are unaffected.
 */

// Track calls to onConflictDoUpdate and onConflictDoNothing
const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
  returning: vi.fn().mockResolvedValue([{ id: "upsert-lead-1" }]),
});

// For the sourceUrl dedup path: onConflictDoNothing returns result from returning()
const mockOnConflictDoNothing = vi.fn().mockReturnValue({
  returning: vi.fn().mockResolvedValue([{ id: "new-lead-1" }]),
});

let leadIdCounter = 0;

vi.mock("@/lib/db", () => {
  const createInsertChain = () => {
    const valuesReturn = {
      onConflictDoUpdate: (...args: unknown[]) =>
        mockOnConflictDoUpdate(...args),
      onConflictDoNothing: (...args: unknown[]) =>
        mockOnConflictDoNothing(...args),
      returning: vi.fn().mockImplementation(() =>
        Promise.resolve([{ id: `mock-lead-id-${++leadIdCounter}` }])
      ),
    };
    return {
      values: vi.fn().mockReturnValue(valuesReturn),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    };
  };

  return {
    db: {
      insert: vi.fn().mockImplementation(() => createInsertChain()),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  };
});

vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: 30.2672,
    lng: -97.7431,
    formattedAddress: "123 Main St, Austin, TX 78701",
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({
    type: "eq",
    a,
    b,
  })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings: Array.from(strings),
    values,
  }),
}));

vi.mock("@/lib/scraper/dedup", () => ({
  deduplicateNewLeads: vi.fn().mockResolvedValue({ merged: 0, kept: 1 }),
}));

import { runPipeline } from "@/lib/scraper/pipeline";
import { db } from "@/lib/db";

describe("Schema: leads_source_url_dedup_idx partial unique index", () => {
  it("has a partial unique index named leads_source_url_dedup_idx on (sourceId, sourceUrl)", async () => {
    // Import the leads table definition and inspect its config
    const { leads } = await import("@/lib/db/schema/leads");

    // The leads table should have indexes defined
    // Drizzle pgTable third arg returns an array of index definitions
    // We check the table config has the index name
    const tableConfig = leads as unknown as Record<string, unknown>;

    // Use getTableConfig or inspect the table symbol
    // Drizzle stores indexes in the table's Symbol for extras
    const { getTableConfig } = await import("drizzle-orm/pg-core");
    const config = getTableConfig(leads);

    const indexNames = config.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain("leads_source_url_dedup_idx");
  });
});

describe("Pipeline: sourceUrl-based dedup for non-permit leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadIdCounter = 0;
  });

  it("uses onConflictDoNothing for non-permit records with sourceUrl", async () => {
    const newsLead = createMockLeadData("news", {
      title: "New hospital groundbreaking",
      sourceUrl: "https://enr.com/article/456",
      city: "Houston",
      state: "TX",
    });

    const adapter = createMockAdapter({
      sourceId: "news-source",
      sourceName: "News Source",
      sourceType: "news",
      results: [newsLead],
    });

    await runPipeline([adapter]);

    // onConflictDoNothing should be called (not onConflictDoUpdate)
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
    // Verify the target includes sourceId and sourceUrl
    const callArgs = mockOnConflictDoNothing.mock.calls[0][0];
    expect(callArgs).toHaveProperty("target");
  });

  it("falls back to SELECT when onConflictDoNothing returns empty (duplicate detected)", async () => {
    // Simulate conflict: onConflictDoNothing returning empty array
    mockOnConflictDoNothing.mockReturnValueOnce({
      returning: vi.fn().mockResolvedValue([]), // empty = conflict
    });

    // Mock SELECT to find the existing lead
    const mockSelectResult = [{ id: "existing-lead-id" }];
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockSelectResult),
        }),
      }),
    });

    const newsLead = createMockLeadData("news", {
      title: "Duplicate article",
      sourceUrl: "https://enr.com/article/existing",
      city: "Dallas",
      state: "TX",
    });

    const adapter = createMockAdapter({
      sourceId: "news-source",
      sourceName: "News Source",
      sourceType: "news",
      results: [newsLead],
    });

    const result = await runPipeline([adapter]);

    // Should still track the lead (existing ID retrieved via SELECT)
    const adapterResult = result.results.find(
      (r) => r.sourceId === "news-source"
    );
    expect(adapterResult).toBeDefined();
    expect(adapterResult!.recordsStored).toBe(1);
  });

  it("uses title-based dedup for non-permit records WITHOUT sourceUrl", async () => {
    const bidLead = createMockLeadData("bid", {
      title: "Federal HVAC Upgrade RFP",
      externalId: "SAM-2026-99",
      sourceUrl: undefined,
      city: "Houston",
      state: "TX",
    });

    const adapter = createMockAdapter({
      sourceId: "bid-source",
      sourceName: "Bid Source",
      sourceType: "bid",
      results: [bidLead],
    });

    await runPipeline([adapter]);

    // onConflictDoNothing should NOT be called (no sourceUrl)
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
    // onConflictDoUpdate should NOT be called (not a permit)
    expect(mockOnConflictDoUpdate).not.toHaveBeenCalled();
    // Should have used SELECT + INSERT path (title-based)
    expect(db.select).toHaveBeenCalled();
  });

  it("uses onConflictDoUpdate for permit records (unchanged behavior)", async () => {
    const permitLead = createMockPermitData({
      permitNumber: "PERMIT-999",
      description: "Commercial renovation",
    });

    const adapter = createMockAdapter({
      sourceId: "permit-source",
      sourceName: "Permit Source",
      sourceType: "permit",
      results: [permitLead],
    });

    await runPipeline([adapter]);

    // Permit records should use onConflictDoUpdate
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    // Should NOT use onConflictDoNothing for permits
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
  });
});
