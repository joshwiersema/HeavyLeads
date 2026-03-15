import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock rate limiter
const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/scraper/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// Mock pipeline dependencies
const mockRunPipeline = vi.fn();
const mockInitializeAdapters = vi.fn();
const mockGetRegisteredAdapters = vi.fn().mockReturnValue([]);
const mockClearAdapters = vi.fn();

vi.mock("@/lib/scraper/pipeline", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

vi.mock("@/lib/scraper/adapters", () => ({
  initializeAdapters: () => mockInitializeAdapters(),
}));

vi.mock("@/lib/scraper/registry", () => ({
  getRegisteredAdapters: () => mockGetRegisteredAdapters(),
  clearAdapters: () => mockClearAdapters(),
}));

// Mock db
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "run-1" }]),
  }),
});

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
}));

import { POST } from "@/app/api/scraper/run/route";

describe("POST /api/scraper/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue({
      results: [
        { sourceId: "test", sourceName: "Test", recordsScraped: 5, recordsStored: 3, errors: [] },
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    });
  });

  it("returns 401 without session", async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/scraper/run", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    const nextAllowed = new Date(Date.now() + 30 * 60 * 1000);
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: "org-123" },
      user: { id: "user-1" },
    });
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      nextAllowedAt: nextAllowed,
    });

    const request = new Request("http://localhost:3000/api/scraper/run", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("Rate limited");
    expect(body.nextAllowedAt).toBeDefined();
  });

  it("runs pipeline when authenticated and not rate limited", async () => {
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: "org-123" },
      user: { id: "user-1" },
    });
    mockCheckRateLimit.mockResolvedValue({ allowed: true });

    const request = new Request("http://localhost:3000/api/scraper/run", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockInitializeAdapters).toHaveBeenCalledOnce();
    expect(mockRunPipeline).toHaveBeenCalledOnce();
    expect(mockClearAdapters).toHaveBeenCalledOnce();
  });
});
