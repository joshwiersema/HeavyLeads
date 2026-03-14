import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for bookmark server actions.
 * Mocks auth and db to test business logic without external dependencies.
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
const mockOnConflictDoNothing = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockReturnThis();
const mockDeleteWhere = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockLimit = vi.fn().mockResolvedValue([]);
const mockInnerJoin = vi.fn().mockReturnThis();

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoNothing: (...cArgs: unknown[]) =>
              mockOnConflictDoNothing(...cArgs),
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
                limit: (...lArgs: unknown[]) => mockLimit(...lArgs),
              };
            },
            innerJoin: (...jArgs: unknown[]) => {
              mockInnerJoin(...jArgs);
              return {
                where: (...wArgs: unknown[]) => mockWhere(...wArgs),
              };
            },
          };
        },
      };
    },
  },
}));

// Mock schema
vi.mock("@/lib/db/schema/bookmarks", () => ({
  bookmarks: {
    id: "id",
    userId: "userId",
    leadId: "leadId",
    organizationId: "organizationId",
    createdAt: "createdAt",
  },
}));

vi.mock("@/lib/db/schema/leads", () => ({
  leads: {
    id: "id",
  },
}));

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("toggleBookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates bookmark when none exists", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    // No existing bookmark
    mockLimit.mockResolvedValue([]);

    const { toggleBookmark } = await import("@/actions/bookmarks");
    const result = await toggleBookmark("lead-1");

    expect(result.bookmarked).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("deletes bookmark when one exists", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    // Existing bookmark found
    mockLimit.mockResolvedValue([
      { id: "bm-1", leadId: "lead-1", userId: "user-1" },
    ]);

    const { toggleBookmark } = await import("@/actions/bookmarks");
    const result = await toggleBookmark("lead-1");

    expect(result.bookmarked).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("throws when not authenticated", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { toggleBookmark } = await import("@/actions/bookmarks");

    await expect(toggleBookmark("lead-1")).rejects.toThrow("Unauthorized");
  });
});

describe("getBookmarkedLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only bookmarks for the given userId+orgId", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mockWhere.mockResolvedValue([
      { leadId: "lead-1" },
      { leadId: "lead-2" },
    ]);

    const { getBookmarkedLeads } = await import("@/actions/bookmarks");
    const result = await getBookmarkedLeads();

    expect(result).toEqual(["lead-1", "lead-2"]);
  });
});
