import { describe, it, expect } from "vitest";
import { buildFilterConditions } from "@/lib/leads/queries";
import { leads } from "@/lib/db/schema/leads";
import { createMockLead } from "../helpers/leads";
import type { EnrichedLead } from "@/lib/leads/types";

/**
 * Tests for the keyword, date range, and project size filter logic
 * extracted into a pure buildFilterConditions helper.
 *
 * Since the filter conditions produce Drizzle SQL objects that require
 * a real database to evaluate, we test the higher-level applyInMemoryFilters
 * helper that mirrors the same logic for in-memory filtering, and verify
 * buildFilterConditions returns conditions (non-empty array) vs no conditions.
 */

function createEnrichedLead(
  overrides: Record<string, unknown> = {}
): EnrichedLead {
  const lead = createMockLead(overrides);
  return {
    ...lead,
    distance: 10,
    inferredEquipment: [],
    score: 50,
    freshness: "New" as const,
    timeline: [],
    ...(overrides as Partial<EnrichedLead>),
  } as EnrichedLead;
}

describe("buildFilterConditions", () => {
  it("returns an empty array when no filter params are provided", () => {
    const conditions = buildFilterConditions({});
    expect(conditions).toHaveLength(0);
  });

  it("returns a condition for keyword search", () => {
    const conditions = buildFilterConditions({ keyword: "hospital" });
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("returns a condition for dateFrom filter", () => {
    const conditions = buildFilterConditions({
      dateFrom: new Date("2026-01-01"),
    });
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("returns a condition for dateTo filter", () => {
    const conditions = buildFilterConditions({
      dateTo: new Date("2026-12-31"),
    });
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("returns a condition for minProjectSize filter", () => {
    const conditions = buildFilterConditions({ minProjectSize: 100000 });
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("returns a condition for maxProjectSize filter", () => {
    const conditions = buildFilterConditions({ maxProjectSize: 1000000 });
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("returns multiple conditions when combining keyword + date range + size", () => {
    const conditions = buildFilterConditions({
      keyword: "hospital",
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-06-30"),
      minProjectSize: 100000,
      maxProjectSize: 5000000,
    });
    // keyword (1) + dateFrom (1) + dateTo (1) + minSize (1) + maxSize (1) = 5
    expect(conditions.length).toBe(5);
  });

  it("ignores null/undefined filter params (no extra conditions)", () => {
    const conditions = buildFilterConditions({
      keyword: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      minProjectSize: undefined,
      maxProjectSize: undefined,
    });
    expect(conditions).toHaveLength(0);
  });
});

describe("applyInMemoryFilters", () => {
  // Import will be available after implementation
  // For now these tests define the expected behavior

  it("keyword 'hospital' matches leads with hospital in title", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ title: "Hospital Renovation Project" }),
      createEnrichedLead({ title: "Office Building" }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "hospital" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Hospital Renovation Project");
  });

  it("keyword search is case-insensitive", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ title: "HOSPITAL expansion" }),
      createEnrichedLead({ title: "hospital wing addition" }),
      createEnrichedLead({ title: "Office park" }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "Hospital" });
    expect(result).toHaveLength(2);
  });

  it("keyword matches in description", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({
        title: "Building Project",
        description: "New hospital wing construction",
      }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "hospital" });
    expect(result).toHaveLength(1);
  });

  it("keyword matches in address", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({
        title: "Building Project",
        description: "Construction project",
        address: "123 Hospital Drive, Austin TX",
      }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "hospital" });
    expect(result).toHaveLength(1);
  });

  it("keyword matches in applicantName", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({
        title: "New Wing",
        applicantName: "St. Hospital Foundation",
      }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "hospital" });
    expect(result).toHaveLength(1);
  });

  it("keyword matches in contractorName", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({
        title: "New Wing",
        contractorName: "Hospital Builders Inc",
      }),
    ];
    const result = applyInMemoryFilters(leads, { keyword: "hospital" });
    expect(result).toHaveLength(1);
  });

  it("dateFrom filter excludes leads scraped before the given date", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ scrapedAt: new Date("2026-01-15") }),
      createEnrichedLead({ scrapedAt: new Date("2025-12-01") }),
    ];
    const result = applyInMemoryFilters(leads, {
      dateFrom: new Date("2026-01-01"),
    });
    expect(result).toHaveLength(1);
  });

  it("dateTo filter excludes leads scraped after the given date", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ scrapedAt: new Date("2026-01-15") }),
      createEnrichedLead({ scrapedAt: new Date("2026-06-15") }),
    ];
    const result = applyInMemoryFilters(leads, {
      dateTo: new Date("2026-03-01"),
    });
    expect(result).toHaveLength(1);
  });

  it("minProjectSize filter excludes leads with estimatedValue below threshold", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ estimatedValue: 500000 }),
      createEnrichedLead({ estimatedValue: 50000 }),
    ];
    const result = applyInMemoryFilters(leads, { minProjectSize: 100000 });
    expect(result).toHaveLength(1);
    expect(result[0].estimatedValue).toBe(500000);
  });

  it("maxProjectSize filter excludes leads with estimatedValue above threshold", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ estimatedValue: 500000 }),
      createEnrichedLead({ estimatedValue: 5000000 }),
    ];
    const result = applyInMemoryFilters(leads, { maxProjectSize: 1000000 });
    expect(result).toHaveLength(1);
    expect(result[0].estimatedValue).toBe(500000);
  });

  it("combining keyword + date range + size produces intersection of results", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      // Matches all criteria
      createEnrichedLead({
        id: "match",
        title: "Hospital Project",
        scrapedAt: new Date("2026-02-15"),
        estimatedValue: 500000,
      }),
      // Matches keyword but not date
      createEnrichedLead({
        id: "bad-date",
        title: "Hospital Expansion",
        scrapedAt: new Date("2025-06-01"),
        estimatedValue: 500000,
      }),
      // Matches date and size but not keyword
      createEnrichedLead({
        id: "no-keyword",
        title: "Office Complex",
        scrapedAt: new Date("2026-02-15"),
        estimatedValue: 500000,
      }),
      // Matches keyword and date but not size
      createEnrichedLead({
        id: "too-small",
        title: "Hospital Clinic",
        scrapedAt: new Date("2026-02-15"),
        estimatedValue: 10000,
      }),
    ];
    const result = applyInMemoryFilters(leads, {
      keyword: "hospital",
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-12-31"),
      minProjectSize: 100000,
      maxProjectSize: 1000000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("match");
  });

  it("null/undefined filter params are ignored (no narrowing)", async () => {
    const { applyInMemoryFilters } = await import("@/lib/leads/queries");
    const leads = [
      createEnrichedLead({ id: "1" }),
      createEnrichedLead({ id: "2" }),
      createEnrichedLead({ id: "3" }),
    ];
    const result = applyInMemoryFilters(leads, {
      keyword: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      minProjectSize: undefined,
      maxProjectSize: undefined,
    });
    expect(result).toHaveLength(3);
  });
});
