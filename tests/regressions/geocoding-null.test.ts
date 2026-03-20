import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression test for Bug Fix #2: Geocoding returns null (not 0,0)
 *
 * WHAT WAS BROKEN: geocodeAddress returned { lat: 0, lng: 0 } when the
 * Google Maps API key was not set, causing leads to be placed at Null Island
 * (0,0 coordinates in the Gulf of Guinea).
 *
 * WHAT WAS FIXED: Returns { lat: null, lng: null } when API key is missing
 * and geocoding fails, allowing callers to detect missing coordinates.
 *
 * UPDATE (Phase 19): With the Nominatim fallback, missing Google API key
 * now routes to Nominatim instead of returning null immediately. The core
 * regression (no 0,0 coords) is still validated, plus Nominatim fallback
 * behavior is tested.
 */

// Mock db (cache operations)
const mockLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: (...args: unknown[]) => {
            mockLimit(...args);
            return mockLimit.mock.results?.[
              mockLimit.mock.results.length - 1
            ]?.value ?? Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema/geocoding-cache", () => ({
  geocodingCache: {
    addressHash: "address_hash",
    expiresAt: "expires_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ op: "eq", val })),
  gt: vi.fn((_col: unknown, val: unknown) => ({ op: "gt", val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks
import { geocodeAddress } from "@/lib/geocoding";

describe("Regression: Geocoding returns null coords when API key missing (Bug Fix #2)", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save and remove the API key
    originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    // Default: cache miss
    mockLimit.mockResolvedValue([]);
  });

  afterEach(() => {
    // Restore the API key
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
  });

  it("returns null lat/lng when API key missing AND Nominatim returns no results", async () => {
    // Nominatim returns empty results
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await geocodeAddress("123 Main St, Austin, TX");

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it("does NOT return 0,0 (the old buggy behavior)", async () => {
    // Even with Nominatim fallback returning valid coords, should not be 0,0
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { lat: "30.2672", lon: "-97.7431", display_name: "Austin, TX" },
        ]),
    });

    const result = await geocodeAddress("123 Main St, Austin, TX");

    expect(result.lat).not.toBe(0);
    expect(result.lng).not.toBe(0);
  });

  it("falls back to Nominatim when Google API key is missing", async () => {
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

    const result = await geocodeAddress("123 Main St, Austin, TX");

    // Should get valid coordinates from Nominatim
    expect(result.lat).toBeCloseTo(30.2672);
    expect(result.lng).toBeCloseTo(-97.7431);
    // Should have called Nominatim (not Google)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain(
      "nominatim.openstreetmap.org"
    );
  });

  it("returns null coords when API key missing AND Nominatim fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await geocodeAddress("456 Oak Ave, Houston, TX 77001");

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.formattedAddress).toBe("456 Oak Ave, Houston, TX 77001");
  });
});
