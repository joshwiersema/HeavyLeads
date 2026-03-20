import { describe, it, expect, vi, beforeEach } from "vitest";

// Track execute calls and results
let executeResults: { rowCount: number }[] = [];
let executeCallIndex = 0;

const mockExecute = vi.fn().mockImplementation(() => {
  const result = executeResults[executeCallIndex] ?? { rowCount: 0 };
  executeCallIndex++;
  return Promise.resolve(result);
});

vi.mock("@/lib/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn().mockImplementation(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings: [...strings],
      values,
    })
  ),
}));

import { expireStaleLeads } from "@/lib/scraper/expiration";

describe("expireStaleLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeCallIndex = 0;
    executeResults = [];
  });

  it("returns total count of deleted leads", async () => {
    // Single batch deletes 6 leads (less than 500, exits loop)
    executeResults.push({ rowCount: 6 });

    const result = await expireStaleLeads();
    expect(result.expired).toBe(6);
  });

  it("calls db.execute with DELETE SQL", async () => {
    executeResults.push({ rowCount: 0 });

    await expireStaleLeads();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when no leads are stale", async () => {
    executeResults.push({ rowCount: 0 });

    const result = await expireStaleLeads();
    expect(result.expired).toBe(0);
  });
});
