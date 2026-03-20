import { describe, it, expect, vi, beforeEach } from "vitest";

// Track execute calls and their results
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

describe("expireStaleLeads (hardened)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeCallIndex = 0;
    executeResults = [];
  });

  it("deletes leads older than 45 days with no bookmarks or statuses", async () => {
    // Single batch deletes 10 leads (less than batch size, loop exits)
    executeResults.push({ rowCount: 10 });

    const result = await expireStaleLeads();

    expect(result.expired).toBe(10);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when no leads are eligible for deletion", async () => {
    executeResults.push({ rowCount: 0 });

    const result = await expireStaleLeads();

    expect(result.expired).toBe(0);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("processes multiple batches when DELETE_BATCH_SIZE leads are found", async () => {
    // First batch: 500 deleted (full batch, triggers another round)
    // Second batch: 200 deleted (partial batch, done)
    // Third call should not happen
    executeResults.push({ rowCount: 500 }, { rowCount: 200 });

    const result = await expireStaleLeads();

    expect(result.expired).toBe(700);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("handles multiple full batches followed by empty batch", async () => {
    // Three full batches of 500, then empty final batch
    executeResults.push(
      { rowCount: 500 },
      { rowCount: 500 },
      { rowCount: 500 },
      { rowCount: 0 }
    );

    const result = await expireStaleLeads();

    expect(result.expired).toBe(1500);
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });

  it("uses 45-day cutoff date in the SQL query", async () => {
    executeResults.push({ rowCount: 0 });

    const now = Date.now();
    vi.setSystemTime(now);

    await expireStaleLeads();

    // The first call to mockExecute should have received a SQL tagged template
    // with the cutoff date as a parameter
    const sqlArg = mockExecute.mock.calls[0][0];
    expect(sqlArg).toBeDefined();
    expect(sqlArg.type).toBe("sql");

    // Verify the cutoff date is approximately 45 days ago
    const cutoffDate = sqlArg.values[0] as Date;
    const expectedCutoff = new Date(now - 45 * 24 * 60 * 60 * 1000);
    expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);

    vi.useRealTimers();
  });

  it("includes NOT EXISTS subqueries for bookmarks and lead_statuses", async () => {
    executeResults.push({ rowCount: 0 });

    await expireStaleLeads();

    const sqlArg = mockExecute.mock.calls[0][0];
    const sqlText = sqlArg.strings.join("?");

    // Verify the SQL contains the bookmark preservation check
    expect(sqlText).toContain("NOT EXISTS");
    expect(sqlText).toContain("bookmarks");
    expect(sqlText).toContain("lead_statuses");
  });

  it("includes LIMIT for batch processing", async () => {
    executeResults.push({ rowCount: 0 });

    await expireStaleLeads();

    const sqlArg = mockExecute.mock.calls[0][0];
    const sqlText = sqlArg.strings.join("?");

    expect(sqlText).toContain("LIMIT");
    // The batch size (500) should be passed as a parameter
    expect(sqlArg.values).toContain(500);
  });

  it("handles null rowCount gracefully", async () => {
    // Some DB drivers may return null rowCount
    executeResults.push({ rowCount: null as unknown as number });

    const result = await expireStaleLeads();

    // Number(null) === 0, so should not loop
    expect(result.expired).toBe(0);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
