import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockAdapter,
  createMockPermitData,
} from "../helpers/scraper";

/**
 * Regression test for Bug Fix #1: Permit upsert uses sql`excluded.*`
 *
 * WHAT WAS BROKEN: Pipeline was using onConflictDoNothing for permit records,
 * silently discarding updated data for existing permits.
 *
 * WHAT WAS FIXED: Changed to onConflictDoUpdate with sql`excluded.column_name`
 * references so incoming data overwrites stale columns on conflict.
 *
 * This test would FAIL if the fix were reverted to onConflictDoNothing.
 */

// Track calls to onConflictDoUpdate
const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
  returning: vi.fn().mockResolvedValue([{ id: "upsert-lead-1" }]),
});

// Mock db with insert chain supporting both upsert paths
vi.mock("@/lib/db", () => {
  const createInsertChain = () => {
    const valuesReturn = {
      onConflictDoUpdate: (...args: unknown[]) =>
        mockOnConflictDoUpdate(...args),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([{ id: "insert-lead-1" }]),
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

// Mock geocoding
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: 30.2672,
    lng: -97.7431,
    formattedAddress: "123 Main St, Austin, TX 78701",
  }),
}));

// Mock drizzle-orm with sql as tagged template function
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

// Mock dedup module
vi.mock("@/lib/scraper/dedup", () => ({
  deduplicateNewLeads: vi.fn().mockResolvedValue({ merged: 0, kept: 1 }),
}));

// Import pipeline after mocks
import { runPipeline } from "@/lib/scraper/pipeline";

describe("Regression: Permit upsert uses onConflictDoUpdate (Bug Fix #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onConflictDoUpdate (not onConflictDoNothing) for permit records", async () => {
    const adapter = createMockAdapter({
      sourceId: "permit-upsert-test",
      sourceName: "Permit Upsert Test",
      results: [
        createMockPermitData({
          permitNumber: "UPSERT-001",
          description: "Commercial warehouse renovation",
        }),
      ],
    });

    await runPipeline([adapter]);

    // The critical assertion: onConflictDoUpdate MUST be called for permit records
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("passes set parameter with expected field keys to onConflictDoUpdate", async () => {
    const adapter = createMockAdapter({
      sourceId: "permit-fields-test",
      sourceName: "Permit Fields Test",
      results: [
        createMockPermitData({
          permitNumber: "FIELDS-001",
          description: "Office building remodel",
        }),
      ],
    });

    await runPipeline([adapter]);

    expect(mockOnConflictDoUpdate).toHaveBeenCalled();

    // Extract the arguments passed to onConflictDoUpdate
    const callArgs = mockOnConflictDoUpdate.mock.calls[0][0];

    // Verify the set parameter contains expected field keys
    // These are the fields that should be updated on conflict using sql`excluded.*`
    expect(callArgs).toHaveProperty("set");
    const setKeys = Object.keys(callArgs.set);

    // Critical fields that must be updated on conflict
    expect(setKeys).toContain("description");
    expect(setKeys).toContain("title");
    expect(setKeys).toContain("scrapedAt");
    expect(setKeys).toContain("lat");
    expect(setKeys).toContain("lng");
  });

  it("uses sql`excluded.*` references in the set parameter (not literal values)", async () => {
    const adapter = createMockAdapter({
      sourceId: "sql-excluded-test",
      sourceName: "SQL Excluded Test",
      results: [
        createMockPermitData({
          permitNumber: "EXCL-001",
        }),
      ],
    });

    await runPipeline([adapter]);

    expect(mockOnConflictDoUpdate).toHaveBeenCalled();

    const callArgs = mockOnConflictDoUpdate.mock.calls[0][0];
    const setValues = Object.values(callArgs.set);

    // Each value should be a sql tagged template object (not a raw string/number)
    // The sql mock returns { type: "sql", strings: [...], values: [...] }
    for (const val of setValues) {
      expect(val).toHaveProperty("type", "sql");
    }
  });
});
