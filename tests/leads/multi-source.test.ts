import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => {
  const selectMock = vi.fn();
  return {
    db: {
      select: selectMock,
    },
  };
});

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
  asc: vi.fn().mockImplementation((a) => ({ type: "asc", a })),
  desc: vi.fn().mockImplementation((a) => ({ type: "desc", a })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
    {
      raw: (s: string) => ({ type: "sql_raw", value: s }),
    }
  ),
  isNotNull: vi.fn().mockImplementation((a) => ({ type: "isNotNull", a })),
  getTableColumns: vi.fn().mockReturnValue({}),
}));

// Mock equipment inference and scoring (needed by queries.ts)
vi.mock("@/lib/leads/equipment-inference", () => ({
  inferEquipmentNeeds: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/leads/scoring", () => ({
  scoreLead: vi.fn().mockReturnValue(50),
}));

vi.mock("@/lib/leads/types", () => ({
  getFreshnessBadge: vi.fn().mockReturnValue("New"),
}));

vi.mock("@/lib/leads/timeline", () => ({
  mapTimeline: vi.fn().mockReturnValue([]),
}));

import { getLeadSources } from "@/lib/leads/queries";
import { db } from "@/lib/db";

describe("Multi-source lead queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLeadSources", () => {
    it("returns all source references for a lead", async () => {
      const mockSources = [
        {
          id: "source-1",
          leadId: "lead-1",
          sourceId: "austin-permits",
          sourceType: "permit",
          externalId: "PERMIT-001",
          sourceUrl: "https://permits.austin.gov/001",
          title: "New commercial building",
          discoveredAt: new Date("2026-03-01"),
        },
        {
          id: "source-2",
          leadId: "lead-1",
          sourceId: "sam-gov-bids",
          sourceType: "bid",
          externalId: "SAM-2026-100",
          sourceUrl: "https://sam.gov/opp/100",
          title: "Commercial building renovation RFP",
          discoveredAt: new Date("2026-03-05"),
        },
        {
          id: "source-3",
          leadId: "lead-1",
          sourceId: "enr-news",
          sourceType: "news",
          externalId: null,
          sourceUrl: "https://enr.com/articles/123",
          title: "Groundbreaking for new Austin commercial complex",
          discoveredAt: new Date("2026-03-10"),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSources),
          }),
        }),
      } as any);

      const sources = await getLeadSources("lead-1");

      expect(sources).toHaveLength(3);
      expect(sources[0].sourceType).toBe("permit");
      expect(sources[1].sourceType).toBe("bid");
      expect(sources[2].sourceType).toBe("news");
    });

    it("returns sources ordered by discoveredAt ascending", async () => {
      const mockSources = [
        {
          id: "s-a",
          leadId: "lead-2",
          sourceId: "src-1",
          sourceType: "permit",
          externalId: null,
          sourceUrl: null,
          title: "First source",
          discoveredAt: new Date("2026-01-01"),
        },
        {
          id: "s-b",
          leadId: "lead-2",
          sourceId: "src-2",
          sourceType: "news",
          externalId: null,
          sourceUrl: null,
          title: "Second source",
          discoveredAt: new Date("2026-02-15"),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSources),
          }),
        }),
      } as any);

      const sources = await getLeadSources("lead-2");

      expect(sources).toHaveLength(2);
      expect(sources[0].discoveredAt.getTime()).toBeLessThan(
        sources[1].discoveredAt.getTime()
      );
    });

    it("returns empty array for lead with no source entries", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const sources = await getLeadSources("nonexistent-lead");

      expect(sources).toEqual([]);
    });
  });
});
