import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockLead } from "../helpers/leads";

/**
 * Tests for getFilteredLeadsWithCount pagination and enrichLead extraction.
 *
 * Mocks the db module and schema to test pagination math and enrichment
 * without a live database. Uses the established vi.mock pattern from Phase 9.
 */

// Mock db module -- returns fake lead rows from the chained select query
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        $dynamic: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnThis(),
          where: (...args: unknown[]) => {
            mockWhere(...args);
            return {
              orderBy: (...oArgs: unknown[]) => {
                mockOrderBy(...oArgs);
                return {
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockImplementation(() => {
                      // Return the rows set via mockWhere's test setup
                      return Promise.resolve(mockWhere._rows ?? []);
                    }),
                  }),
                };
              },
            };
          },
        }),
      }),
    }),
  },
}));

// Mock schema tables -- need column references for SQL building
vi.mock("@/lib/db/schema/leads", () => ({
  leads: {
    id: "id",
    lat: "lat",
    lng: "lng",
    title: "title",
    description: "description",
    address: "address",
    applicantName: "applicant_name",
    contractorName: "contractor_name",
    scrapedAt: "scraped_at",
    estimatedValue: "estimated_value",
    projectType: "project_type",
    permitNumber: "permit_number",
    formattedAddress: "formatted_address",
    sourceId: "source_id",
    sourceJurisdiction: "source_jurisdiction",
    sourceUrl: "source_url",
    permitDate: "permit_date",
    createdAt: "created_at",
  },
}));

vi.mock("@/lib/db/schema/lead-statuses", () => ({
  leadStatuses: {
    leadId: "lead_id",
    userId: "user_id",
    organizationId: "organization_id",
    status: "status",
  },
}));

vi.mock("@/lib/db/schema/bookmarks", () => ({
  bookmarks: {
    id: "id",
    leadId: "lead_id",
    userId: "user_id",
    organizationId: "organization_id",
  },
}));

// Import after mocks
import { enrichLead, getFilteredLeadsWithCount } from "@/lib/leads/queries";

describe("enrichLead", () => {
  it("produces correct score, distance, freshness, inferredEquipment, and timeline fields", () => {
    const row = createMockLead({
      lat: 30.3672, // ~7 miles north of Austin HQ
      lng: -97.7431,
      projectType: "Commercial New Construction",
      description: "Excavation and grading needed for warehouse",
      scrapedAt: new Date(), // today = "New"
    });

    const result = enrichLead(row, {
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators", "Boom Lifts"],
    });

    // Distance should be ~7 miles
    expect(result.distance).toBeGreaterThan(5);
    expect(result.distance).toBeLessThan(10);

    // Score > 0 because equipment matches and within radius
    expect(result.score).toBeGreaterThan(0);

    // Freshness should be "New" (scraped today)
    expect(result.freshness).toBe("New");

    // Should have inferred equipment from description
    expect(result.inferredEquipment.length).toBeGreaterThan(0);

    // Timeline should be populated
    expect(Array.isArray(result.timeline)).toBe(true);
  });

  it("returns null distance and zero score when no params provided", () => {
    const row = createMockLead();
    const result = enrichLead(row);

    expect(result.distance).toBeNull();
    expect(result.score).toBe(0);
    expect(result.freshness).toBeDefined();
    expect(result.inferredEquipment).toBeDefined();
  });
});

describe("getFilteredLeadsWithCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { leads, totalCount, page, totalPages } for page 1 with pageSize 20 and 55 total leads", async () => {
    // Create 55 mock lead rows
    const rows = Array.from({ length: 55 }, (_, i) =>
      createMockLead({
        id: `lead-${String(i).padStart(3, "0")}`,
        lat: 30.2672 + i * 0.001,
        lng: -97.7431,
        scrapedAt: new Date(Date.now() - i * 1000),
      })
    );
    mockWhere._rows = rows;

    const result = await getFilteredLeadsWithCount({
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators"],
      page: 1,
      pageSize: 20,
    });

    expect(result.leads).toHaveLength(20);
    expect(result.totalCount).toBe(55);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3); // ceil(55/20) = 3
  });

  it("returns 15 leads for page 3 with pageSize 20 and 55 total leads", async () => {
    const rows = Array.from({ length: 55 }, (_, i) =>
      createMockLead({
        id: `lead-${String(i).padStart(3, "0")}`,
        lat: 30.2672 + i * 0.001,
        lng: -97.7431,
        scrapedAt: new Date(Date.now() - i * 1000),
      })
    );
    mockWhere._rows = rows;

    const result = await getFilteredLeadsWithCount({
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators"],
      page: 3,
      pageSize: 20,
    });

    expect(result.leads).toHaveLength(15);
    expect(result.totalCount).toBe(55);
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
  });

  it("applies enrichment to paginated results (score > 0 for matching equipment)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      createMockLead({
        id: `lead-${i}`,
        lat: 30.2672 + i * 0.001,
        lng: -97.7431,
        projectType: "Commercial New Construction",
        description: "Excavation and grading project",
        scrapedAt: new Date(),
      })
    );
    mockWhere._rows = rows;

    const result = await getFilteredLeadsWithCount({
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators"],
      page: 1,
      pageSize: 20,
    });

    // All leads should have enrichment
    for (const lead of result.leads) {
      expect(lead.score).toBeGreaterThan(0);
      expect(lead.inferredEquipment.length).toBeGreaterThan(0);
      expect(lead.freshness).toBeDefined();
      expect(lead.distance).toBeDefined();
    }
  });
});
