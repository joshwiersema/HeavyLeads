import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing dedup
vi.mock("@/lib/db", () => {
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };

  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  const insertChain = {
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
      }),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
    }),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };

  const selectFields = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  return {
    db: {
      insert: vi.fn().mockReturnValue(insertChain),
      select: vi.fn().mockReturnValue(selectFields),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue(deleteChain),
      transaction: vi.fn().mockImplementation(async (fn: any) => {
        // Create a transaction-scoped db mock
        const txUpdateChain = {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        };
        const txDeleteChain = {
          where: vi.fn().mockResolvedValue(undefined),
        };
        const tx = {
          update: vi.fn().mockReturnValue(txUpdateChain),
          delete: vi.fn().mockReturnValue(txDeleteChain),
        };
        return fn(tx);
      }),
    },
  };
});

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
  ne: vi.fn().mockImplementation((a, b) => ({ type: "ne", a, b })),
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
}));

import {
  normalizeText,
  isLikelyDuplicate,
  PROXIMITY_THRESHOLD_MILES,
  SIMILARITY_THRESHOLD,
} from "@/lib/scraper/dedup";

describe("Dedup engine", () => {
  describe("normalizeText", () => {
    it("lowercases, strips punctuation, and trims whitespace", () => {
      expect(normalizeText("123 Main St.")).toBe("123 main st");
    });

    it("returns empty string for null input", () => {
      expect(normalizeText(null)).toBe("");
    });

    it("preserves spaces between words", () => {
      expect(normalizeText("  Hello   World!  ")).toBe("hello   world");
    });
  });

  describe("threshold constants", () => {
    it("exports PROXIMITY_THRESHOLD_MILES as 0.1", () => {
      expect(PROXIMITY_THRESHOLD_MILES).toBe(0.1);
    });

    it("exports SIMILARITY_THRESHOLD as 0.7", () => {
      expect(SIMILARITY_THRESHOLD).toBe(0.7);
    });
  });

  describe("isLikelyDuplicate", () => {
    it("returns true for same location with similar address", () => {
      const a = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "123 main st",
        normalizedTitle: "some project",
      };
      const b = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "123 main street",
        normalizedTitle: "different project",
      };
      expect(isLikelyDuplicate(a, b)).toBe(true);
    });

    it("returns true for same location with similar title", () => {
      const a = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "totally different address",
        normalizedTitle: "commercial building renovation",
      };
      const b = {
        lat: 30.26725,
        lng: -97.74315,
        normalizedAddress: "another address entirely",
        normalizedTitle: "commercial building renovations",
      };
      expect(isLikelyDuplicate(a, b)).toBe(true);
    });

    it("returns false for same location but different address AND title", () => {
      const a = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "123 main st",
        normalizedTitle: "office tower",
      };
      const b = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "789 oak ave",
        normalizedTitle: "parking garage",
      };
      expect(isLikelyDuplicate(a, b)).toBe(false);
    });

    it("returns false for distant location with similar address", () => {
      const a = {
        lat: 30.2672,
        lng: -97.7431,
        normalizedAddress: "123 main st",
        normalizedTitle: "renovation",
      };
      const b = {
        lat: 32.7767,
        lng: -96.797,
        normalizedAddress: "123 main st",
        normalizedTitle: "renovation",
      };
      expect(isLikelyDuplicate(a, b)).toBe(false);
    });

    it("returns false when one lead has null lat/lng", () => {
      const a = {
        lat: 30.2672 as number | null,
        lng: -97.7431 as number | null,
        normalizedAddress: "123 main st",
        normalizedTitle: "renovation",
      };
      const b = {
        lat: null as number | null,
        lng: null as number | null,
        normalizedAddress: "123 main st",
        normalizedTitle: "renovation",
      };
      expect(isLikelyDuplicate(a, b)).toBe(false);
    });
  });

  describe("deduplicateNewLeads", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns merged and kept counts", async () => {
      // Import after mocks
      const { deduplicateNewLeads } = await import("@/lib/scraper/dedup");
      const { db } = await import("@/lib/db");

      // Setup: new lead with no coordinates (will be kept, not merged)
      const mockNewLead = {
        id: "new-lead-1",
        lat: null,
        lng: null,
        address: "123 Main St",
        title: "Project A",
      };

      // Mock select to return the new lead
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockNewLead]),
          }),
        }),
      } as any);

      const result = await deduplicateNewLeads(["new-lead-1"]);

      expect(result).toHaveProperty("merged");
      expect(result).toHaveProperty("kept");
      expect(result.kept).toBe(1);
      expect(result.merged).toBe(0);
    });

    it("keeps leads without coordinates (does not merge them)", async () => {
      const { deduplicateNewLeads } = await import("@/lib/scraper/dedup");
      const { db } = await import("@/lib/db");

      const leadNoCoords = {
        id: "no-coords-1",
        lat: null,
        lng: null,
        address: "456 Oak Ave",
        title: "Project B",
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([leadNoCoords]),
          }),
        }),
      } as any);

      const result = await deduplicateNewLeads(["no-coords-1"]);

      expect(result.kept).toBe(1);
      expect(result.merged).toBe(0);
    });

    it("returns zero counts for empty input", async () => {
      const { deduplicateNewLeads } = await import("@/lib/scraper/dedup");

      const result = await deduplicateNewLeads([]);

      expect(result.merged).toBe(0);
      expect(result.kept).toBe(0);
    });
  });
});
