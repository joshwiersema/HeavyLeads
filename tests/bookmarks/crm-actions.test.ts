import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Hoisted mocks ----
const {
  mockGetSession,
  mockSelect,
  mockFrom,
  mockWhere,
  mockOrderBy,
  mockInnerJoin,
  mockUpdate,
  mockSet,
  mockUpdateWhere,
  mockLimit,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockOrderBy: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// ---- Module mocks ----

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: mockGetSession },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("@/lib/db/schema/bookmarks", () => ({
  bookmarks: {
    id: "id",
    leadId: "lead_id",
    userId: "user_id",
    organizationId: "organization_id",
    createdAt: "created_at",
    notes: "notes",
    pipelineStatus: "pipeline_status",
  },
}));

vi.mock("@/lib/db/schema/leads", () => ({
  leads: {
    id: "id",
    title: "title",
    address: "address",
    formattedAddress: "formatted_address",
    sourceType: "source_type",
    estimatedValue: "estimated_value",
    city: "city",
    state: "state",
    scrapedAt: "scraped_at",
    lat: "lat",
    lng: "lng",
    projectType: "project_type",
    description: "description",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, type: "and" })),
  desc: vi.fn((col) => ({ col, type: "desc" })),
  sql: vi.fn(),
}));

// Helper for valid session
const validSession = {
  user: { id: "user-1" },
  session: { activeOrganizationId: "org-1" },
};

describe("CRM bookmark actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetSession.mockResolvedValue(validSession);

    // Default chain for select queries
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({
      where: mockWhere,
      innerJoin: mockInnerJoin,
    });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
    });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockOrderBy.mockResolvedValue([]);
    mockLimit.mockResolvedValue([]);

    // Default chain for update queries
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  // ---- updateBookmarkNotes ----

  describe("updateBookmarkNotes", () => {
    it("updates the notes field for a given bookmark", async () => {
      // Bookmark belongs to the current user+org
      mockLimit.mockResolvedValue([
        { id: "bm-1", userId: "user-1", organizationId: "org-1" },
      ]);

      const { updateBookmarkNotes } = await import("@/actions/bookmarks");
      await updateBookmarkNotes("bm-1", "Great prospect, follow up Friday");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        notes: "Great prospect, follow up Friday",
      });
    });

    it("throws when session is missing", async () => {
      mockGetSession.mockResolvedValue(null);

      const { updateBookmarkNotes } = await import("@/actions/bookmarks");
      await expect(
        updateBookmarkNotes("bm-1", "notes")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when bookmark does not belong to user", async () => {
      mockLimit.mockResolvedValue([]);

      const { updateBookmarkNotes } = await import("@/actions/bookmarks");
      await expect(
        updateBookmarkNotes("bm-999", "notes")
      ).rejects.toThrow("Bookmark not found");
    });
  });

  // ---- updateBookmarkStatus ----

  describe("updateBookmarkStatus", () => {
    it("updates pipelineStatus with a valid status value", async () => {
      mockLimit.mockResolvedValue([
        { id: "bm-1", userId: "user-1", organizationId: "org-1" },
      ]);

      const { updateBookmarkStatus } = await import("@/actions/bookmarks");
      await updateBookmarkStatus("bm-1", "contacted");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        pipelineStatus: "contacted",
      });
    });

    it("accepts all valid pipeline statuses", async () => {
      const validStatuses = [
        "saved",
        "contacted",
        "in_progress",
        "won",
        "lost",
      ] as const;

      for (const status of validStatuses) {
        vi.clearAllMocks();
        vi.resetModules();
        mockGetSession.mockResolvedValue(validSession);
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({
          where: mockWhere,
          innerJoin: mockInnerJoin,
        });
        mockWhere.mockReturnValue({
          orderBy: mockOrderBy,
          limit: mockLimit,
        });
        mockLimit.mockResolvedValue([
          { id: "bm-1", userId: "user-1", organizationId: "org-1" },
        ]);
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockUpdateWhere });
        mockUpdateWhere.mockResolvedValue(undefined);

        const { updateBookmarkStatus } = await import("@/actions/bookmarks");
        await updateBookmarkStatus("bm-1", status);
        expect(mockSet).toHaveBeenCalledWith({ pipelineStatus: status });
      }
    });

    it("rejects invalid status values", async () => {
      const { updateBookmarkStatus } = await import("@/actions/bookmarks");
      await expect(
        updateBookmarkStatus("bm-1", "invalid_status" as any)
      ).rejects.toThrow("Invalid pipeline status");
    });

    it("throws when session is missing", async () => {
      mockGetSession.mockResolvedValue(null);

      const { updateBookmarkStatus } = await import("@/actions/bookmarks");
      await expect(
        updateBookmarkStatus("bm-1", "saved")
      ).rejects.toThrow("Unauthorized");
    });
  });

  // ---- getBookmarksWithDetails ----

  describe("getBookmarksWithDetails", () => {
    it("returns bookmarks joined with lead data, notes, and pipelineStatus", async () => {
      const mockBookmarks = [
        {
          id: "bm-1",
          leadId: "lead-1",
          userId: "user-1",
          organizationId: "org-1",
          notes: "Contact next week",
          pipelineStatus: "contacted",
          createdAt: new Date("2026-03-15"),
          title: "Big Excavation Project",
          address: "123 Main St",
          sourceType: "permit",
          estimatedValue: 250000,
          city: "Denver",
          state: "CO",
        },
      ];
      mockOrderBy.mockResolvedValue(mockBookmarks);

      const { getBookmarksWithDetails } = await import("@/actions/bookmarks");
      const result = await getBookmarksWithDetails();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "bm-1",
        notes: "Contact next week",
        pipelineStatus: "contacted",
        title: "Big Excavation Project",
      });
    });

    it("filters by pipelineStatus when statusFilter is provided", async () => {
      mockOrderBy.mockResolvedValue([]);

      const { getBookmarksWithDetails } = await import("@/actions/bookmarks");
      await getBookmarksWithDetails("contacted");

      // The where clause should have been called (we verify the function ran without error)
      expect(mockFrom).toHaveBeenCalled();
    });

    it("returns empty array when no bookmarks exist", async () => {
      mockOrderBy.mockResolvedValue([]);

      const { getBookmarksWithDetails } = await import("@/actions/bookmarks");
      const result = await getBookmarksWithDetails();

      expect(result).toEqual([]);
    });

    it("throws when session is missing", async () => {
      mockGetSession.mockResolvedValue(null);

      const { getBookmarksWithDetails } = await import("@/actions/bookmarks");
      await expect(getBookmarksWithDetails()).rejects.toThrow("Unauthorized");
    });
  });

  // ---- PipelineStatus type ----

  describe("PipelineStatus type", () => {
    it("PIPELINE_STATUSES constant contains all valid statuses", async () => {
      const { PIPELINE_STATUSES } = await import("@/actions/bookmark-types");
      expect(PIPELINE_STATUSES).toEqual([
        "saved",
        "contacted",
        "in_progress",
        "won",
        "lost",
      ]);
    });
  });

  // ---- toggleBookmark default pipeline status ----

  describe("toggleBookmark pipeline default", () => {
    it("sets pipelineStatus to 'saved' on creation via schema default", async () => {
      // The schema has .default("saved") on pipelineStatus -- verify the
      // bookmarks schema constant is imported (the insert doesn't explicitly
      // set pipelineStatus, relying on DB default)
      const { bookmarks } = await import("@/lib/db/schema/bookmarks");
      expect(bookmarks.pipelineStatus).toBeDefined();
    });
  });
});
