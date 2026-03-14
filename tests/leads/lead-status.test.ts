import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lead status server actions.
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
const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockLimit = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoUpdate: (...cArgs: unknown[]) => mockOnConflictDoUpdate(...cArgs),
          };
        },
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
          };
        },
      };
    },
  },
}));

// Mock schema -- need to import after mocks are set up
vi.mock("@/lib/db/schema/lead-statuses", () => ({
  leadStatuses: {
    userId: "userId",
    leadId: "leadId",
    organizationId: "organizationId",
    status: "status",
  },
  LEAD_STATUS_VALUES: ["new", "viewed", "contacted", "won", "lost"],
}));

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("updateLeadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts status for a userId+leadId+orgId triple", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });

    const { updateLeadStatus } = await import("@/actions/lead-status");
    await updateLeadStatus("lead-1", "viewed");

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        userId: "user-1",
        organizationId: "org-1",
        status: "viewed",
      })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/leads/lead-1");
  });

  it("rejects invalid status values", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });

    const { updateLeadStatus } = await import("@/actions/lead-status");

    await expect(
      updateLeadStatus("lead-1", "invalid-status" as "viewed")
    ).rejects.toThrow();
  });

  it("throws when not authenticated", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { updateLeadStatus } = await import("@/actions/lead-status");

    await expect(updateLeadStatus("lead-1", "viewed")).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("throws when no active organization", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: null },
    });

    const { updateLeadStatus } = await import("@/actions/lead-status");

    await expect(updateLeadStatus("lead-1", "viewed")).rejects.toThrow(
      "Unauthorized"
    );
  });
});

describe("getLeadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status when row exists", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mockLimit.mockResolvedValue([{ status: "contacted" }]);

    const { getLeadStatus } = await import("@/actions/lead-status");
    const status = await getLeadStatus("lead-1");

    expect(status).toBe("contacted");
  });

  it("returns 'new' when no row exists", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mockLimit.mockResolvedValue([]);

    const { getLeadStatus } = await import("@/actions/lead-status");
    const status = await getLeadStatus("lead-1");

    expect(status).toBe("new");
  });
});
