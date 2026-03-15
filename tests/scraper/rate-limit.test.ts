import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      pipelineRuns: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
  gte: vi.fn().mockImplementation((a, b) => ({ type: "gte", a, b })),
  desc: vi.fn().mockImplementation((a) => ({ type: "desc", a })),
}));

import { checkRateLimit } from "@/lib/scraper/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows run when no recent runs exist", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await checkRateLimit("org-123");

    expect(result.allowed).toBe(true);
    expect(result.nextAllowedAt).toBeUndefined();
  });

  it("blocks run when recent run exists within 1 hour", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockFindFirst.mockResolvedValue({
      id: "run-1",
      organizationId: "org-123",
      startedAt: thirtyMinutesAgo,
    });

    const result = await checkRateLimit("org-123");

    expect(result.allowed).toBe(false);
    expect(result.nextAllowedAt).toBeInstanceOf(Date);
  });

  it("allows run when last run is older than 1 hour", async () => {
    // When the gte filter is applied, runs older than 1 hour won't be returned
    mockFindFirst.mockResolvedValue(null);

    const result = await checkRateLimit("org-123");

    expect(result.allowed).toBe(true);
    expect(result.nextAllowedAt).toBeUndefined();
  });

  it("returns nextAllowedAt as 1 hour after last run's startedAt", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockFindFirst.mockResolvedValue({
      id: "run-2",
      organizationId: "org-123",
      startedAt: thirtyMinutesAgo,
    });

    const result = await checkRateLimit("org-123");

    expect(result.allowed).toBe(false);
    expect(result.nextAllowedAt).toBeDefined();

    // nextAllowedAt should be ~30 minutes from now (1 hour after 30-min-ago run)
    const expectedNextAllowed = new Date(
      thirtyMinutesAgo.getTime() + 60 * 60 * 1000
    );
    expect(result.nextAllowedAt!.getTime()).toBe(
      expectedNextAllowed.getTime()
    );
  });
});
