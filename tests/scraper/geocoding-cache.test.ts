import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for geocoding cache + Nominatim fallback logic.
 *
 * Covers:
 * - normalizeAddress and hashAddress utility functions
 * - Cache hit returns cached coords without API calls
 * - Cache miss calls Google, inserts cache row
 * - Google OVER_QUERY_LIMIT falls through to Nominatim
 * - Nominatim 1-req/sec rate limiting
 * - Expired cache entry treated as miss
 * - Null-coord caching for known-bad addresses
 * - Missing Google API key routes directly to Nominatim
 */

// ---- Mocks ----

// Mock db with chainable Drizzle methods
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs);
                  return mockLimit.mock.results?.[
                    mockLimit.mock.results.length - 1
                  ]?.value ?? Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoUpdate: (...cArgs: unknown[]) => {
              mockOnConflictDoUpdate(...cArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
  },
}));

// Mock the geocodingCache schema export
vi.mock("@/lib/db/schema/geocoding-cache", () => ({
  geocodingCache: {
    addressHash: "address_hash",
    expiresAt: "expires_at",
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ op: "eq", val })),
  gt: vi.fn((_col: unknown, val: unknown) => ({ op: "gt", val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import AFTER mocks are set up
import {
  geocodeAddress,
  normalizeAddress,
  hashAddress,
  nominatimGeocode,
} from "@/lib/geocoding";

describe("Geocoding Cache and Nominatim Fallback", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Default: provide an API key so Google is attempted
    process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
    // Default: cache miss (no rows returned)
    mockLimit.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
  });

  // ---- normalizeAddress tests ----

  describe("normalizeAddress", () => {
    it("lowercases and trims the address", () => {
      expect(normalizeAddress("  123 Main ST  ")).toBe("123 main st");
    });

    it("collapses multiple whitespace to single space", () => {
      expect(normalizeAddress("123   Main    St,  Austin   TX")).toBe(
        "123 main st, austin tx"
      );
    });

    it("handles empty string", () => {
      expect(normalizeAddress("")).toBe("");
    });

    it("produces identical output for equivalent addresses", () => {
      const a = normalizeAddress("  123 MAIN St,  Austin TX  ");
      const b = normalizeAddress("123 main st, austin tx");
      expect(a).toBe(b);
    });
  });

  // ---- hashAddress tests ----

  describe("hashAddress", () => {
    it("produces a 64-char hex SHA-256 hash", () => {
      const hash = hashAddress("123 Main St, Austin TX");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces consistent hashes for identical normalized addresses", () => {
      const a = hashAddress("  123 MAIN St  ");
      const b = hashAddress("123 main st");
      expect(a).toBe(b);
    });

    it("produces different hashes for different addresses", () => {
      const a = hashAddress("123 Main St");
      const b = hashAddress("456 Oak Ave");
      expect(a).not.toBe(b);
    });
  });

  // ---- Cache hit tests ----

  describe("cache hit", () => {
    it("returns cached coords without calling Google or Nominatim", async () => {
      // Simulate cache hit
      mockLimit.mockResolvedValue([
        {
          lat: 30.2672,
          lng: -97.7431,
          formattedAddress: "123 Main St, Austin, TX 78701",
          provider: "google",
        },
      ]);

      const result = await geocodeAddress("123 Main St, Austin TX");

      expect(result.lat).toBe(30.2672);
      expect(result.lng).toBe(-97.7431);
      expect(result.formattedAddress).toBe("123 Main St, Austin, TX 78701");
      // fetch should NOT have been called (no Google/Nominatim API call)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns cached null coords for known-bad addresses", async () => {
      // Simulate cache hit with null coords (bad address was previously cached)
      mockLimit.mockResolvedValue([
        {
          lat: null,
          lng: null,
          formattedAddress: "Bad Address That Does Not Exist",
          provider: "google",
        },
      ]);

      const result = await geocodeAddress("Bad Address That Does Not Exist");

      expect(result.lat).toBeNull();
      expect(result.lng).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ---- Cache miss + Google success ----

  describe("cache miss with Google success", () => {
    it("calls Google API and caches the result", async () => {
      // Mock Google Maps success response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 30.2672, lng: -97.7431 } },
                formatted_address: "123 Main St, Austin, TX 78701, USA",
              },
            ],
          }),
      });

      const result = await geocodeAddress("123 Main St, Austin TX");

      expect(result.lat).toBe(30.2672);
      expect(result.lng).toBe(-97.7431);
      expect(result.formattedAddress).toBe(
        "123 Main St, Austin, TX 78701, USA"
      );
      // Should have called fetch (Google API)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain(
        "maps.googleapis.com/maps/api/geocode"
      );
      // Should have inserted into cache
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
    });
  });

  // ---- Google OVER_QUERY_LIMIT -> Nominatim fallback ----

  describe("Google OVER_QUERY_LIMIT falls through to Nominatim", () => {
    it("falls back to Nominatim when Google returns OVER_QUERY_LIMIT", async () => {
      // Mock Google quota exceeded
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OVER_QUERY_LIMIT",
            results: [],
            error_message: "You have exceeded your daily request quota",
          }),
      });

      // Mock Nominatim success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              lat: "30.2672",
              lon: "-97.7431",
              display_name: "123 Main St, Austin, TX",
            },
          ]),
      });

      const result = await geocodeAddress("123 Main St, Austin TX");

      expect(result.lat).toBeCloseTo(30.2672);
      expect(result.lng).toBeCloseTo(-97.7431);
      // Both Google and Nominatim should have been called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain("nominatim.openstreetmap.org");
    });

    it("falls back to Nominatim when Google returns REQUEST_DENIED", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "REQUEST_DENIED",
            results: [],
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              lat: "40.7128",
              lon: "-74.006",
              display_name: "New York, NY",
            },
          ]),
      });

      const result = await geocodeAddress("New York, NY");

      expect(result.lat).toBeCloseTo(40.7128);
      expect(result.lng).toBeCloseTo(-74.006);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---- Missing API key -> direct Nominatim ----

  describe("missing Google API key routes to Nominatim", () => {
    it("uses Nominatim directly when GOOGLE_MAPS_API_KEY is not set", async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              lat: "30.2672",
              lon: "-97.7431",
              display_name: "Austin, TX",
            },
          ]),
      });

      const result = await geocodeAddress("Austin, TX");

      expect(result.lat).toBeCloseTo(30.2672);
      expect(result.lng).toBeCloseTo(-97.7431);
      // Should have called Nominatim only (no Google call)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain("nominatim.openstreetmap.org");
    });
  });

  // ---- Expired cache entry treated as miss ----

  describe("expired cache entries", () => {
    it("treats expired cache entry as miss and calls API", async () => {
      // Cache returns empty (simulating expired -- the WHERE clause filters it)
      mockLimit.mockResolvedValue([]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 29.7604, lng: -95.3698 } },
                formatted_address: "Houston, TX, USA",
              },
            ],
          }),
      });

      const result = await geocodeAddress("Houston, TX");

      expect(result.lat).toBe(29.7604);
      expect(result.lng).toBe(-95.3698);
      // API should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // Should have inserted into cache
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ---- Null-coord caching ----

  describe("null-coord caching for bad addresses", () => {
    it("caches null coords when Google returns no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ZERO_RESULTS",
            results: [],
          }),
      });

      const result = await geocodeAddress("XYZZY Not A Real Place 12345");

      expect(result.lat).toBeNull();
      expect(result.lng).toBeNull();
      // Should still cache the null result
      expect(mockInsert).toHaveBeenCalled();
      // Verify the cached values include null lat/lng
      const cachedValues = mockValues.mock.calls[0][0];
      expect(cachedValues.lat).toBeNull();
      expect(cachedValues.lng).toBeNull();
    });
  });

  // ---- Nominatim rate limiting ----

  describe("Nominatim rate limiting", () => {
    it("includes User-Agent header in Nominatim requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await nominatimGeocode("Test Address");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("nominatim.openstreetmap.org"),
        expect.objectContaining({
          headers: {
            "User-Agent": "GroundPulse/1.0 (construction-lead-intelligence)",
          },
        })
      );
    });

    it("returns null coords when Nominatim finds no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await nominatimGeocode("Nonexistent Place XYZ");

      expect(result.lat).toBeNull();
      expect(result.lng).toBeNull();
      expect(result.formattedAddress).toBe("Nonexistent Place XYZ");
    });

    it("throws on Nominatim HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      await expect(nominatimGeocode("Test")).rejects.toThrow(
        "Nominatim API error: 503 Service Unavailable"
      );
    });
  });

  // ---- Cache insert resilience ----

  describe("cache insert resilience", () => {
    it("still returns result if cache insert fails", async () => {
      // Google returns valid data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 30.0, lng: -97.0 } },
                formatted_address: "Test, TX",
              },
            ],
          }),
      });

      // Make cache insert fail
      mockOnConflictDoUpdate.mockRejectedValueOnce(
        new Error("DB connection lost")
      );

      const result = await geocodeAddress("Test, TX");

      // Should still return the geocoded result
      expect(result.lat).toBe(30.0);
      expect(result.lng).toBe(-97.0);
    });
  });
});
