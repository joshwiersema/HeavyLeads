import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { computeContentHash } from "@/lib/scraper/content-hash";

/** Helper to compute expected SHA-256 hex */
function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe("computeContentHash", () => {
  it("returns SHA-256 of 'sourceId:permitNumber' lowercased for permit type", () => {
    const hash = computeContentHash({
      sourceType: "permit",
      sourceId: "Austin-TX-Permits",
      permitNumber: "P-12345",
    });
    expect(hash).toBe(sha256("austin-tx-permits:p-12345"));
  });

  it("returns SHA-256 of 'sourceId:externalId:title' lowercased for bid type", () => {
    const hash = computeContentHash({
      sourceType: "bid",
      sourceId: "Sam-Gov-Bids",
      externalId: "SAM-2026-001",
      title: "Federal HVAC Upgrade RFP",
    });
    expect(hash).toBe(sha256("sam-gov-bids:sam-2026-001:federal hvac upgrade rfp"));
  });

  it("returns SHA-256 of sourceUrl lowercased for news type", () => {
    const hash = computeContentHash({
      sourceType: "news",
      sourceUrl: "https://ENR.com/Article/123",
    });
    expect(hash).toBe(sha256("https://enr.com/article/123"));
  });

  it("returns SHA-256 of sourceUrl lowercased for deep-web type", () => {
    const hash = computeContentHash({
      sourceType: "deep-web",
      sourceUrl: "https://LinkedIn.com/Jobs/123",
    });
    expect(hash).toBe(sha256("https://linkedin.com/jobs/123"));
  });

  it("returns null when required fields missing for permit (no permitNumber)", () => {
    const hash = computeContentHash({
      sourceType: "permit",
      sourceId: "austin-tx-permits",
    });
    expect(hash).toBeNull();
  });

  it("returns null when required fields missing for news (no sourceUrl)", () => {
    const hash = computeContentHash({
      sourceType: "news",
      sourceId: "enr-news",
      title: "Some article",
    });
    expect(hash).toBeNull();
  });

  it("is deterministic (same inputs produce same hash)", () => {
    const input = {
      sourceType: "permit" as const,
      sourceId: "austin-tx-permits",
      permitNumber: "P-001",
    };
    const hash1 = computeContentHash(input);
    const hash2 = computeContentHash(input);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = computeContentHash({
      sourceType: "permit",
      sourceId: "austin-tx-permits",
      permitNumber: "P-001",
    });
    const hash2 = computeContentHash({
      sourceType: "permit",
      sourceId: "austin-tx-permits",
      permitNumber: "P-002",
    });
    expect(hash1).not.toBe(hash2);
  });

  it("returns null for unknown source type", () => {
    const hash = computeContentHash({
      sourceType: "unknown-type",
      sourceId: "some-source",
    });
    expect(hash).toBeNull();
  });
});
