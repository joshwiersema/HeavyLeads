import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  splitIntoBatches,
  serializeBatch,
  getBaseUrl,
  DEFAULT_BATCH_SIZE,
} from "@/lib/scraper/batch-orchestrator";
import type { ScraperAdapter } from "@/lib/scraper/adapters/base-adapter";

/** Helper to create mock adapters with sequential sourceIds */
function createMockAdapters(count: number): ScraperAdapter[] {
  return Array.from({ length: count }, (_, i) => ({
    sourceId: `test-${i + 1}`,
    sourceName: `Test Adapter ${i + 1}`,
    sourceType: "permit" as const,
    scrape: async () => [],
  }));
}

describe("batch-orchestrator", () => {
  describe("DEFAULT_BATCH_SIZE", () => {
    it("equals 5", () => {
      expect(DEFAULT_BATCH_SIZE).toBe(5);
    });
  });

  describe("splitIntoBatches", () => {
    it("returns empty array for 0 adapters", () => {
      const result = splitIntoBatches([]);
      expect(result).toEqual([]);
    });

    it("returns 1 batch for 3 adapters (less than batch size)", () => {
      const adapters = createMockAdapters(3);
      const result = splitIntoBatches(adapters);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(3);
    });

    it("returns 1 batch for exactly 5 adapters", () => {
      const adapters = createMockAdapters(5);
      const result = splitIntoBatches(adapters);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(5);
    });

    it("returns 2 batches for 7 adapters: [5, 2]", () => {
      const adapters = createMockAdapters(7);
      const result = splitIntoBatches(adapters);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(5);
      expect(result[1]).toHaveLength(2);
    });

    it("returns 2 batches for 10 adapters: [5, 5]", () => {
      const adapters = createMockAdapters(10);
      const result = splitIntoBatches(adapters);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(5);
      expect(result[1]).toHaveLength(5);
    });

    it("returns 3 batches for 12 adapters: [5, 5, 2]", () => {
      const adapters = createMockAdapters(12);
      const result = splitIntoBatches(adapters);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(5);
      expect(result[1]).toHaveLength(5);
      expect(result[2]).toHaveLength(2);
    });

    it("supports custom batchSize=3 with 7 adapters: [3, 3, 1]", () => {
      const adapters = createMockAdapters(7);
      const result = splitIntoBatches(adapters, 3);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(3);
      expect(result[1]).toHaveLength(3);
      expect(result[2]).toHaveLength(1);
    });

    it("preserves adapter identity across batches", () => {
      const adapters = createMockAdapters(7);
      const result = splitIntoBatches(adapters);
      const flatIds = result.flat().map((a) => a.sourceId);
      expect(flatIds).toEqual([
        "test-1",
        "test-2",
        "test-3",
        "test-4",
        "test-5",
        "test-6",
        "test-7",
      ]);
    });
  });

  describe("serializeBatch", () => {
    it("returns array of sourceId strings", () => {
      const adapters = createMockAdapters(3);
      const result = serializeBatch(adapters);
      expect(result).toEqual(["test-1", "test-2", "test-3"]);
    });

    it("returns empty array for empty input", () => {
      const result = serializeBatch([]);
      expect(result).toEqual([]);
    });
  });

  describe("getBaseUrl", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_URL;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns NEXT_PUBLIC_APP_URL when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.groundpulse.com";
      expect(getBaseUrl()).toBe("https://app.groundpulse.com");
    });

    it("returns https://VERCEL_URL when VERCEL_URL is set", () => {
      process.env.VERCEL_URL = "my-app-abc123.vercel.app";
      expect(getBaseUrl()).toBe("https://my-app-abc123.vercel.app");
    });

    it("prefers NEXT_PUBLIC_APP_URL over VERCEL_URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.groundpulse.com";
      process.env.VERCEL_URL = "my-app-abc123.vercel.app";
      expect(getBaseUrl()).toBe("https://app.groundpulse.com");
    });

    it("falls back to http://localhost:3000 when no env vars set", () => {
      expect(getBaseUrl()).toBe("http://localhost:3000");
    });
  });
});
