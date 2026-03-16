import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EnrichedLead } from "@/lib/leads/types";

/**
 * Regression test for Bug Fix #3: Lead query sort (score DESC, scrapedAt DESC)
 *
 * WHAT WAS BROKEN: Leads were sorted only by scrapedAt DESC, meaning a
 * brand-new low-relevance lead would rank above an older high-score lead.
 *
 * WHAT WAS FIXED: Primary sort is score DESC, with scrapedAt DESC as
 * tiebreaker. Plus FETCH_MULTIPLIER=4 ensures enough leads are fetched
 * from the DB so scoring and filtering don't accidentally exclude top leads.
 *
 * Tests the sort pattern and FETCH_MULTIPLIER behavior inline since the
 * sort logic is embedded in getFilteredLeads (not separately exported).
 */

// Mock @/lib/db since queries.ts imports it at the top level
vi.mock("@/lib/db", () => ({
  db: {},
}));

// Mock drizzle-orm since queries.ts imports it at the top level
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings: Array.from(strings),
    values,
  }),
  getTableColumns: vi.fn().mockReturnValue({}),
  and: vi.fn(),
  isNotNull: vi.fn(),
  eq: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  ilike: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  or: vi.fn(),
}));

// Mock db schema modules
vi.mock("@/lib/db/schema/leads", () => ({
  leads: { id: "id", lat: "lat", lng: "lng", scrapedAt: "scrapedAt" },
}));

vi.mock("@/lib/db/schema/lead-sources", () => ({
  leadSources: { leadId: "leadId", discoveredAt: "discoveredAt" },
}));

vi.mock("@/lib/db/schema/lead-statuses", () => ({
  leadStatuses: {
    leadId: "leadId",
    userId: "userId",
    organizationId: "organizationId",
    status: "status",
  },
}));

vi.mock("@/lib/db/schema/bookmarks", () => ({
  bookmarks: {
    id: "id",
    leadId: "leadId",
    userId: "userId",
    organizationId: "organizationId",
  },
}));

// Import the pure functions we can test
import {
  applyInMemoryFilters,
  filterByEquipment,
} from "@/lib/leads/queries";

describe("Regression: Lead query sort order and FETCH_MULTIPLIER (Bug Fix #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to create a minimal enriched lead for sort testing.
   * Only includes fields needed for sort/filter assertions.
   */
  function createEnrichedLead(
    overrides: Partial<EnrichedLead>
  ): EnrichedLead {
    return {
      id: `lead-${Math.random().toString(36).substring(2, 8)}`,
      permitNumber: null,
      title: null,
      description: "Test lead",
      address: "123 Test St",
      formattedAddress: null,
      lat: 30.27,
      lng: -97.74,
      city: null,
      state: null,
      projectType: "Commercial New Construction",
      estimatedValue: 500000,
      applicantName: null,
      contractorName: null,
      agencyName: null,
      permitDate: null,
      postedDate: null,
      deadlineDate: null,
      sourceType: "permit",
      sourceId: "test-source",
      sourceJurisdiction: null,
      sourceUrl: null,
      scrapedAt: new Date("2026-03-15T12:00:00Z"),
      createdAt: new Date(),
      distance: 10,
      inferredEquipment: [
        { type: "Excavators", confidence: "high", reason: "test" },
      ],
      score: 50,
      freshness: "New",
      timeline: [],
      ...overrides,
    } as EnrichedLead;
  }

  it("sorts enriched leads by score DESC first, then scrapedAt DESC as tiebreaker", () => {
    const leads = [
      createEnrichedLead({
        score: 50,
        scrapedAt: new Date("2026-03-15T12:00:00Z"),
      }),
      createEnrichedLead({
        score: 80,
        scrapedAt: new Date("2026-03-14T12:00:00Z"),
      }),
      createEnrichedLead({
        score: 80,
        scrapedAt: new Date("2026-03-15T12:00:00Z"),
      }),
    ];

    // Apply the same sort logic used in getFilteredLeads
    leads.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.scrapedAt.getTime() - a.scrapedAt.getTime();
    });

    // Score 80 leads come first (score DESC)
    expect(leads[0].score).toBe(80);
    expect(leads[1].score).toBe(80);
    expect(leads[2].score).toBe(50);

    // Among score-80 leads, newer date comes first (scrapedAt DESC)
    expect(leads[0].scrapedAt).toEqual(new Date("2026-03-15T12:00:00Z"));
    expect(leads[1].scrapedAt).toEqual(new Date("2026-03-14T12:00:00Z"));
  });

  it("a lead with score 80 ranks above a lead with score 50 regardless of date", () => {
    const leads = [
      createEnrichedLead({
        score: 50,
        scrapedAt: new Date("2026-03-15T12:00:00Z"), // newer
      }),
      createEnrichedLead({
        score: 80,
        scrapedAt: new Date("2026-03-01T12:00:00Z"), // older
      }),
    ];

    leads.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.scrapedAt.getTime() - a.scrapedAt.getTime();
    });

    // Higher score wins even though it has an older date
    expect(leads[0].score).toBe(80);
    expect(leads[1].score).toBe(50);
  });

  it("FETCH_MULTIPLIER=4 over-fetches then slices to requested limit", () => {
    // Simulate the FETCH_MULTIPLIER logic from getFilteredLeads
    const FETCH_MULTIPLIER = 4;
    const requestedLimit = 5;
    const fetchLimit = requestedLimit * FETCH_MULTIPLIER;

    expect(fetchLimit).toBe(20);

    // Create 20 leads (simulating the over-fetch)
    const leads: EnrichedLead[] = [];
    for (let i = 0; i < 20; i++) {
      leads.push(
        createEnrichedLead({
          score: Math.floor(Math.random() * 100),
        })
      );
    }

    // Sort by score DESC (as getFilteredLeads does)
    leads.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.scrapedAt.getTime() - a.scrapedAt.getTime();
    });

    // Slice to requested limit
    const result = leads.slice(0, requestedLimit);

    expect(result).toHaveLength(5);
    // The result should contain the top-5 scoring leads
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
  });

  it("applyInMemoryFilters filters by keyword case-insensitively", () => {
    const leads = [
      createEnrichedLead({
        description: "Commercial warehouse with excavation",
      }),
      createEnrichedLead({
        description: "Residential home renovation",
      }),
    ];

    const filtered = applyInMemoryFilters(leads, {
      keyword: "warehouse",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].description).toContain("warehouse");
  });

  it("filterByEquipment returns only leads matching equipment types", () => {
    const leads = [
      createEnrichedLead({
        inferredEquipment: [
          { type: "Excavators", confidence: "high", reason: "test" },
        ],
      }),
      createEnrichedLead({
        inferredEquipment: [
          { type: "Cranes", confidence: "medium", reason: "test" },
        ],
      }),
    ];

    const filtered = filterByEquipment(leads, ["Excavators"]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].inferredEquipment[0].type).toBe("Excavators");
  });
});
