import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for saved search server actions and the pure savedSearchToParams utility.
 * Mocks auth and db for server action tests. No mocks needed for savedSearchToParams.
 */

// Mock auth module
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock db module
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockReturning = vi.fn().mockResolvedValue([{ id: "search-1" }]);
const mockDelete = vi.fn().mockReturnThis();
const mockDeleteWhere = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockLimit = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            returning: (...rArgs: unknown[]) => mockReturning(...rArgs),
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return {
        where: (...wArgs: unknown[]) => mockDeleteWhere(...wArgs),
      };
    },
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                orderBy: (...oArgs: unknown[]) => mockOrderBy(...oArgs),
                limit: (...lArgs: unknown[]) => mockLimit(...lArgs),
              };
            },
          };
        },
      };
    },
  },
}));

// Mock schema
vi.mock("@/lib/db/schema/saved-searches", () => ({
  savedSearches: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    name: "name",
    createdAt: "createdAt",
  },
}));

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("createSavedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists all filter criteria fields", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });

    const { createSavedSearch } = await import("@/actions/saved-searches");
    const input = {
      name: "My Search",
      equipmentFilter: ["Excavators", "Cranes"],
      radiusMiles: 50,
      keyword: "hospital",
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-12-31"),
      minProjectSize: 100000,
      maxProjectSize: 5000000,
      isDigestEnabled: true,
    };

    await createSavedSearch(input);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        organizationId: "org-1",
        name: "My Search",
        keyword: "hospital",
        radiusMiles: 50,
        equipmentFilter: ["Excavators", "Cranes"],
        minProjectSize: 100000,
        maxProjectSize: 5000000,
        isDigestEnabled: true,
      })
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("throws when not authenticated", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { createSavedSearch } = await import("@/actions/saved-searches");

    await expect(
      createSavedSearch({ name: "Test" })
    ).rejects.toThrow("Unauthorized");
  });
});

describe("deleteSavedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the search and returns success", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });

    const { deleteSavedSearch } = await import("@/actions/saved-searches");
    const result = await deleteSavedSearch("search-1");

    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });
});

describe("getSavedSearches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only searches for the given userId+orgId", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mockOrderBy.mockResolvedValue([
      { id: "s1", name: "Search 1" },
      { id: "s2", name: "Search 2" },
    ]);

    const { getSavedSearches } = await import("@/actions/saved-searches");
    const result = await getSavedSearches();

    expect(result).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe("savedSearchToParams", () => {
  it("converts saved search to URLSearchParams correctly", async () => {
    const { savedSearchToParams } = await import("@/actions/saved-searches");

    const search = {
      id: "s1",
      userId: "u1",
      organizationId: "org-1",
      name: "Hospital Search",
      equipmentFilter: ["Excavators", "Cranes"],
      radiusMiles: 50,
      keyword: "hospital",
      dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      dateTo: new Date("2026-12-31T00:00:00.000Z"),
      minProjectSize: 100000,
      maxProjectSize: 5000000,
      isDigestEnabled: false,
      createdAt: new Date(),
    };

    const params = savedSearchToParams(search);

    expect(params).toContain("equipment=Excavators%2CCranes");
    expect(params).toContain("radius=50");
    expect(params).toContain("keyword=hospital");
    expect(params).toContain("dateFrom=");
    expect(params).toContain("dateTo=");
    expect(params).toContain("minProjectSize=100000");
    expect(params).toContain("maxProjectSize=5000000");
  });

  it("skips null/undefined values", async () => {
    const { savedSearchToParams } = await import("@/actions/saved-searches");

    const search = {
      id: "s1",
      userId: "u1",
      organizationId: "org-1",
      name: "Simple Search",
      equipmentFilter: null,
      radiusMiles: null,
      keyword: "concrete",
      dateFrom: null,
      dateTo: null,
      minProjectSize: null,
      maxProjectSize: null,
      isDigestEnabled: false,
      createdAt: new Date(),
    };

    const params = savedSearchToParams(search);

    expect(params).toContain("keyword=concrete");
    expect(params).not.toContain("equipment=");
    expect(params).not.toContain("radius=");
    expect(params).not.toContain("dateFrom=");
    expect(params).not.toContain("dateTo=");
    expect(params).not.toContain("minProjectSize=");
    expect(params).not.toContain("maxProjectSize=");
  });
});
