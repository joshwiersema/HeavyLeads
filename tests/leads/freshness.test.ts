import { describe, it, expect } from "vitest";
import { getFreshnessBadge } from "@/lib/leads/types";

describe("getFreshnessBadge", () => {
  it('returns "New" for scrapedAt today', () => {
    const now = new Date();
    expect(getFreshnessBadge(now)).toBe("New");
  });

  it('returns "New" for scrapedAt a few hours ago', () => {
    const hoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    expect(getFreshnessBadge(hoursAgo)).toBe("New");
  });

  it('returns "This Week" for scrapedAt 3 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(getFreshnessBadge(threeDaysAgo)).toBe("This Week");
  });

  it('returns "This Week" for scrapedAt exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(getFreshnessBadge(oneDayAgo)).toBe("This Week");
  });

  it('returns "This Week" for scrapedAt 7 days ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(getFreshnessBadge(sevenDaysAgo)).toBe("This Week");
  });

  it('returns "Older" for scrapedAt 10 days ago', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(getFreshnessBadge(tenDaysAgo)).toBe("Older");
  });

  it('returns "Older" for scrapedAt 30 days ago', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(getFreshnessBadge(thirtyDaysAgo)).toBe("Older");
  });
});
