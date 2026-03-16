import { describe, it, expect, vi, beforeEach } from "vitest";

// Track update calls
const updateResults: { id: string }[][] = [];
let updateCallIndex = 0;

const mockUpdate = vi.fn().mockImplementation(() => ({
  set: vi.fn().mockImplementation(() => ({
    where: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockImplementation(() => {
        const result = updateResults[updateCallIndex] ?? [];
        updateCallIndex++;
        return Promise.resolve(result);
      }),
    })),
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings: [...strings],
    values,
  })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn().mockImplementation((...args: unknown[]) => ({ type: "or", args })),
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "eq", a, b })),
  ne: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "ne", a, b })),
  lt: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "lt", a, b })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ type: "gte", a, b })),
  isNull: vi.fn().mockImplementation((a: unknown) => ({ type: "isNull", a })),
}));

import { expireStaleLeads } from "@/lib/scraper/expiration";

describe("expireStaleLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCallIndex = 0;
    updateResults.length = 0;
  });

  it("returns total count of expired leads across all source types", async () => {
    // permit: 2 expired, bid: 1 expired, news: 3 expired, deep-web: 0 expired
    updateResults.push(
      [{ id: "1" }, { id: "2" }],  // permit
      [{ id: "3" }],                // bid
      [{ id: "4" }, { id: "5" }, { id: "6" }],  // news
      [],                            // deep-web
    );

    const result = await expireStaleLeads();
    expect(result.expired).toBe(6);
  });

  it("calls db.update 4 times (once per source type)", async () => {
    updateResults.push([], [], [], []);

    await expireStaleLeads();
    expect(mockUpdate).toHaveBeenCalledTimes(4);
  });

  it("returns 0 when no leads are stale", async () => {
    updateResults.push([], [], [], []);

    const result = await expireStaleLeads();
    expect(result.expired).toBe(0);
  });
});
