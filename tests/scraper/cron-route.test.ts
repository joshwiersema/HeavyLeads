import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pipeline dependencies
const mockRunPipeline = vi.fn();
const mockGetAllAdapters = vi.fn().mockReturnValue([]);
const mockGenerateDigests = vi.fn().mockResolvedValue({ sent: 0, skipped: 0, errors: 0 });

vi.mock("@/lib/scraper/pipeline", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

vi.mock("@/lib/scraper/adapters", () => ({
  getAllAdapters: () => mockGetAllAdapters(),
}));

vi.mock("@/lib/email/digest-generator", () => ({
  generateDigests: () => mockGenerateDigests(),
}));

// Mock db for pipeline run recording
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

import { GET } from "@/app/api/cron/scrape/route";

describe("GET /api/cron/scrape", () => {
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

  it("returns 401 without authorization header", async () => {
    const request = new Request("http://localhost:3000/api/cron/scrape", {
      method: "GET",
    });

    const response = await GET(request as any);

    expect(response.status).toBe(401);
  });

  it("returns 401 with invalid CRON_SECRET", async () => {
    const request = new Request("http://localhost:3000/api/cron/scrape", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });

    const response = await GET(request as any);

    expect(response.status).toBe(401);
  });

  it("triggers pipeline with valid CRON_SECRET", async () => {
    const request = new Request("http://localhost:3000/api/cron/scrape", {
      method: "GET",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request as any);

    expect(response.status).toBe(200);
    expect(mockGetAllAdapters).toHaveBeenCalledOnce();
    expect(mockRunPipeline).toHaveBeenCalledOnce();
  });
});
