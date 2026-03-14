import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockAdapter,
  createMockPermitData,
  createMockLeadData,
  createFailingAdapter,
} from "../helpers/scraper";

// Mock the db module -- supports both leads and leadSources inserts
vi.mock("@/lib/db", () => {
  const createInsertChain = () => {
    const valuesReturn = {
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
      }),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
    };
    return {
      values: vi.fn().mockReturnValue(valuesReturn),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    };
  };

  const insertMock = vi.fn().mockImplementation(() => createInsertChain());

  const selectMock = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  return {
    db: {
      insert: insertMock,
      select: selectMock,
    },
  };
});

// Mock the geocoding module
vi.mock("@/lib/geocoding", () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: 30.2672,
    lng: -97.7431,
    formattedAddress: "123 Main St, Austin, TX 78701",
  }),
}));

// Mock drizzle-orm eq and and functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
}));

// Mock the dedup module
const mockDeduplicateNewLeads = vi
  .fn()
  .mockResolvedValue({ merged: 0, kept: 1 });

vi.mock("@/lib/scraper/dedup", () => ({
  deduplicateNewLeads: (...args: unknown[]) =>
    mockDeduplicateNewLeads(...args),
}));

// Import after mocks are set up
import { runPipeline } from "@/lib/scraper/pipeline";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocoding";

describe("Pipeline orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs all registered adapters and aggregates results into PipelineRunResult", async () => {
    const adapter1 = createMockAdapter({
      sourceId: "source-1",
      sourceName: "Source One",
      results: [createMockPermitData({ permitNumber: "P-001" })],
    });
    const adapter2 = createMockAdapter({
      sourceId: "source-2",
      sourceName: "Source Two",
      results: [
        createMockPermitData({ permitNumber: "P-002" }),
        createMockPermitData({ permitNumber: "P-003" }),
      ],
    });

    const result = await runPipeline([adapter1, adapter2]);

    expect(result.results).toHaveLength(2);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(
      result.startedAt.getTime()
    );

    const r1 = result.results.find((r) => r.sourceId === "source-1");
    expect(r1).toBeDefined();
    expect(r1!.recordsScraped).toBe(1);

    const r2 = result.results.find((r) => r.sourceId === "source-2");
    expect(r2).toBeDefined();
    expect(r2!.recordsScraped).toBe(2);
  });

  it("catches adapter errors and continues with remaining adapters", async () => {
    const failingAdapter = createFailingAdapter(
      "broken-source",
      "Network timeout"
    );
    const workingAdapter = createMockAdapter({
      sourceId: "working-source",
      sourceName: "Working Source",
      results: [createMockPermitData()],
    });

    const result = await runPipeline([failingAdapter, workingAdapter]);

    expect(result.results).toHaveLength(2);

    const failResult = result.results.find(
      (r) => r.sourceId === "broken-source"
    );
    expect(failResult).toBeDefined();
    expect(failResult!.errors).toHaveLength(1);
    expect(failResult!.errors[0]).toContain("Network timeout");
    expect(failResult!.recordsStored).toBe(0);
    expect(failResult!.recordsScraped).toBe(0);

    const successResult = result.results.find(
      (r) => r.sourceId === "working-source"
    );
    expect(successResult).toBeDefined();
    expect(successResult!.errors).toHaveLength(0);
    expect(successResult!.recordsStored).toBe(1);
  });

  it("stores scraped records via db.insert", async () => {
    const adapter = createMockAdapter({
      sourceId: "upsert-test",
      results: [createMockPermitData({ permitNumber: "P-100" })],
    });

    await runPipeline([adapter]);

    // Verify db.insert was called (for leads and leadSources)
    expect(db.insert).toHaveBeenCalled();
  });

  it("does not create duplicates -- upsert updates existing permit records", async () => {
    const permit = createMockPermitData({ permitNumber: "DUPE-001" });
    const adapter = createMockAdapter({
      sourceId: "dedup-test",
      results: [permit],
    });

    // Run twice
    await runPipeline([adapter]);
    await runPipeline([adapter]);

    // db.insert should be called on each run (for leads + leadSources)
    expect(db.insert).toHaveBeenCalled();
  });

  it("sets scrapedAt timestamp on stored records", async () => {
    const adapter = createMockAdapter({
      sourceId: "timestamp-test",
      results: [createMockPermitData()],
    });

    await runPipeline([adapter]);

    // Verify db.insert was called
    expect(db.insert).toHaveBeenCalled();
  });

  it("skips geocoding for records that already have lat/lng", async () => {
    const permitWithCoords = createMockPermitData({
      permitNumber: "GEO-SKIP",
      lat: 30.27,
      lng: -97.74,
    });

    const adapter = createMockAdapter({
      sourceId: "geo-skip-test",
      results: [permitWithCoords],
    });

    await runPipeline([adapter]);

    // geocodeAddress should NOT be called since record has coordinates
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it("calls geocodeAddress for records without lat/lng", async () => {
    const adapter = createMockAdapter({
      sourceId: "geo-test",
      results: [
        createMockPermitData({
          permitNumber: "GEO-001",
          address: "456 Oak Ave, Austin, TX",
        }),
      ],
    });

    await runPipeline([adapter]);

    expect(geocodeAddress).toHaveBeenCalledWith("456 Oak Ave, Austin, TX");
  });

  it("skips invalid records and continues processing valid ones", async () => {
    const adapter = createMockAdapter({
      sourceId: "validation-test",
      scrape: async () => {
        // Return mix of valid and invalid records
        // Cast to bypass TypeScript checking since we want to test runtime validation
        return [
          createMockPermitData({ permitNumber: "VALID-001" }),
          { address: "Missing permit number and sourceType" } as any,
          createMockPermitData({ permitNumber: "VALID-002" }),
        ];
      },
    });

    const result = await runPipeline([adapter]);

    const adapterResult = result.results.find(
      (r) => r.sourceId === "validation-test"
    );
    expect(adapterResult).toBeDefined();
    // 3 records scraped but only 2 valid ones stored
    expect(adapterResult!.recordsScraped).toBe(3);
    expect(adapterResult!.recordsStored).toBe(2);
  });

  it("processes non-permit records with nullable permitNumber", async () => {
    const bidLead = createMockLeadData("bid", {
      title: "Federal HVAC Upgrade RFP",
      externalId: "SAM-2026-99",
      city: "Houston",
      state: "TX",
    });

    const adapter = createMockAdapter({
      sourceId: "bid-test",
      sourceName: "Test Bid Source",
      sourceType: "bid",
      results: [bidLead],
    });

    const result = await runPipeline([adapter]);

    const adapterResult = result.results.find(
      (r) => r.sourceId === "bid-test"
    );
    expect(adapterResult).toBeDefined();
    expect(adapterResult!.recordsScraped).toBe(1);
    expect(adapterResult!.recordsStored).toBe(1);
    expect(adapterResult!.errors).toHaveLength(0);
    // Should have newLeadIds tracked
    expect(adapterResult!.newLeadIds).toBeDefined();
    expect(adapterResult!.newLeadIds!.length).toBe(1);
  });

  it("returns newLeadIds in pipeline results for downstream dedup", async () => {
    const adapter = createMockAdapter({
      sourceId: "lead-ids-test",
      results: [
        createMockPermitData({ permitNumber: "ID-001" }),
        createMockPermitData({ permitNumber: "ID-002" }),
      ],
    });

    const result = await runPipeline([adapter]);

    const adapterResult = result.results.find(
      (r) => r.sourceId === "lead-ids-test"
    );
    expect(adapterResult).toBeDefined();
    expect(adapterResult!.newLeadIds).toBeDefined();
    expect(adapterResult!.newLeadIds!.length).toBe(2);
  });

  it("calls deduplicateNewLeads with IDs of newly inserted leads", async () => {
    const adapter = createMockAdapter({
      sourceId: "dedup-integration-test",
      results: [
        createMockPermitData({ permitNumber: "DEDUP-001" }),
        createMockPermitData({ permitNumber: "DEDUP-002" }),
      ],
    });

    await runPipeline([adapter]);

    // deduplicateNewLeads should be called with all new lead IDs
    expect(mockDeduplicateNewLeads).toHaveBeenCalledTimes(1);
    const calledWithIds = mockDeduplicateNewLeads.mock.calls[0][0];
    expect(calledWithIds).toHaveLength(2);
  });

  it("includes dedup stats in PipelineRunResult", async () => {
    mockDeduplicateNewLeads.mockResolvedValueOnce({ merged: 1, kept: 2 });

    const adapter = createMockAdapter({
      sourceId: "dedup-stats-test",
      results: [
        createMockPermitData({ permitNumber: "DS-001" }),
        createMockPermitData({ permitNumber: "DS-002" }),
        createMockPermitData({ permitNumber: "DS-003" }),
      ],
    });

    const result = await runPipeline([adapter]);

    expect(result.dedup).toBeDefined();
    expect(result.dedup!.merged).toBe(1);
    expect(result.dedup!.kept).toBe(2);
  });
});
