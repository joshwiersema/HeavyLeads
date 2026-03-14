import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSubscription } from "../helpers/billing";

/**
 * Tests for getActiveSubscription billing helper.
 * Mocks db to test query logic without external dependencies.
 * These are concrete tests that will FAIL (RED) until src/lib/billing.ts is created.
 */

// Mock db module with query interface
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      subscription: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock schema for subscription table reference
vi.mock("@/lib/db/schema/subscriptions", () => ({
  subscription: {
    referenceId: "referenceId",
    status: "status",
  },
}));

describe("getActiveSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns subscription when status is active", async () => {
    const mockSub = createMockSubscription({ status: "active" });
    mockFindFirst.mockResolvedValue(mockSub);

    const { getActiveSubscription } = await import("@/lib/billing");
    const result = await getActiveSubscription("org-123");

    expect(result).not.toBeNull();
    expect(result?.status).toBe("active");
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("returns subscription when status is trialing", async () => {
    const mockSub = createMockSubscription({ status: "trialing" });
    mockFindFirst.mockResolvedValue(mockSub);

    const { getActiveSubscription } = await import("@/lib/billing");
    const result = await getActiveSubscription("org-123");

    expect(result).not.toBeNull();
    expect(result?.status).toBe("trialing");
  });

  it("returns null when status is canceled", async () => {
    // Query filters to active/trialing only, so canceled subs return null from findFirst
    mockFindFirst.mockResolvedValue(null);

    const { getActiveSubscription } = await import("@/lib/billing");
    const result = await getActiveSubscription("org-123");

    expect(result).toBeNull();
  });

  it("returns null when status is past_due", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { getActiveSubscription } = await import("@/lib/billing");
    const result = await getActiveSubscription("org-123");

    expect(result).toBeNull();
  });

  it("returns null when no subscription exists for organization", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const { getActiveSubscription } = await import("@/lib/billing");
    const result = await getActiveSubscription("org-123");

    expect(result).toBeNull();
  });
});
