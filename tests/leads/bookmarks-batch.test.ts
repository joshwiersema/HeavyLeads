import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockLead } from "../helpers/leads";

/**
 * Tests for getLeadsByIds batch query.
 *
 * Mocks the db module to test batch lookup logic without a live database.
 * Verifies empty-array guard, enrichment, and missing-ID handling.
 */

// Mock db -- use a simpler chain for the select().from().where() pattern
const mockBatchWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: (...args: unknown[]) => {
          mockBatchWhere(...args);
          return Promise.resolve(mockBatchWhere._rows ?? []);
        },
        // Also need $dynamic for getFilteredLeadsWithCount if it runs in same test context
        $dynamic: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

// Mock schema tables
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
import { getLeadsByIds } from "@/lib/leads/queries";

describe("getLeadsByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchWhere._rows = [];
  });

  it("returns empty array without SQL error when given empty array", async () => {
    const result = await getLeadsByIds([]);

    // Should not call db at all
    expect(mockBatchWhere).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns enriched leads with score, equipment, freshness, distance for valid IDs", async () => {
    const mockRows = [
      createMockLead({
        id: "lead-1",
        lat: 30.2772,
        lng: -97.7431,
        projectType: "Commercial New Construction",
        description: "Excavation and grading",
        scrapedAt: new Date(),
      }),
      createMockLead({
        id: "lead-2",
        lat: 30.2872,
        lng: -97.7431,
        projectType: "Road Construction",
        description: "Paving and compaction",
        scrapedAt: new Date(),
      }),
    ];
    mockBatchWhere._rows = mockRows;

    const result = await getLeadsByIds(["lead-1", "lead-2"], {
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators", "Compactors"],
    });

    expect(result).toHaveLength(2);

    for (const lead of result) {
      expect(lead.score).toBeGreaterThanOrEqual(0);
      expect(lead.inferredEquipment).toBeDefined();
      expect(lead.freshness).toBeDefined();
      expect(lead.distance).toBeDefined();
      expect(typeof lead.distance).toBe("number");
    }
  });

  it("filters out IDs not found in database (returns fewer results)", async () => {
    // Only return 2 of the 3 requested IDs
    const mockRows = [
      createMockLead({ id: "lead-1", lat: 30.2772, lng: -97.7431 }),
      createMockLead({ id: "lead-3", lat: 30.2972, lng: -97.7431 }),
    ];
    mockBatchWhere._rows = mockRows;

    const result = await getLeadsByIds(["lead-1", "lead-2", "lead-3"], {
      hqLat: 30.2672,
      hqLng: -97.7431,
      serviceRadiusMiles: 100,
      dealerEquipment: ["Excavators"],
    });

    // Should only return the 2 found leads, not 3
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toContain("lead-1");
    expect(result.map((l) => l.id)).toContain("lead-3");
    expect(result.map((l) => l.id)).not.toContain("lead-2");
  });
});
