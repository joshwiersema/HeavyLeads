import { describe, it, expect } from "vitest";
import { formatDate, safeFormatDate } from "@/lib/utils";

/**
 * Regression test for Bug Fix #12: Date formatting (deterministic locale)
 *
 * WHAT WAS BROKEN: formatDate used the system default locale, causing
 * server/client mismatch (server in UTC/en-US, client in user's locale)
 * which triggered React hydration errors.
 *
 * WHAT WAS FIXED: formatDate now explicitly uses "en-US" locale with
 * Intl.DateTimeFormat, producing deterministic output regardless of
 * system locale. safeFormatDate handles null/undefined/invalid dates.
 *
 * These are pure function tests -- no mocking needed.
 */

describe("Regression: Date formatting with en-US locale (Bug Fix #12)", () => {
  it("formatDate uses en-US locale producing 'Mon DD, YYYY' format", () => {
    // Use noon UTC to avoid timezone boundary issues
    const date = new Date("2026-03-15T12:00:00Z");
    const formatted = formatDate(date);

    // Must match "Mar 15, 2026" pattern (en-US short month format)
    expect(formatted).toMatch(/Mar\s+15,\s+2026/);
  });

  it("formatDate is deterministic -- same Date always produces same string", () => {
    const date = new Date("2026-03-15T12:00:00Z");

    const result1 = formatDate(date);
    const result2 = formatDate(date);
    const result3 = formatDate(date);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it("formatDate handles different months correctly", () => {
    expect(formatDate(new Date("2026-01-15T12:00:00Z"))).toMatch(
      /Jan\s+15,\s+2026/
    );
    expect(formatDate(new Date("2026-07-04T12:00:00Z"))).toMatch(
      /Jul\s+4,\s+2026/
    );
    expect(formatDate(new Date("2026-12-25T12:00:00Z"))).toMatch(
      /Dec\s+25,\s+2026/
    );
  });

  it("safeFormatDate returns null for null input", () => {
    expect(safeFormatDate(null)).toBeNull();
  });

  it("safeFormatDate returns null for undefined input", () => {
    expect(safeFormatDate(undefined)).toBeNull();
  });

  it("safeFormatDate returns null for invalid Date input", () => {
    expect(safeFormatDate(new Date("invalid"))).toBeNull();
  });

  it("safeFormatDate returns formatted string for valid Date input", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const result = safeFormatDate(date);

    expect(result).not.toBeNull();
    expect(result).toMatch(/Mar\s+15,\s+2026/);
  });
});
