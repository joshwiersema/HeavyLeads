import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for Bug Fix #2: Geocoding returns null (not 0,0)
 *
 * WHAT WAS BROKEN: geocodeAddress returned { lat: 0, lng: 0 } when the
 * Google Maps API key was not set, causing leads to be placed at Null Island
 * (0,0 coordinates in the Gulf of Guinea).
 *
 * WHAT WAS FIXED: Returns { lat: null, lng: null } when API key is missing,
 * allowing callers to detect missing coordinates and handle gracefully.
 *
 * This test uses the REAL geocodeAddress function with the API key removed.
 * No vi.mock needed -- pure function test against missing env var.
 */

// Import the real function (no mocking)
import { geocodeAddress } from "@/lib/geocoding";

describe("Regression: Geocoding returns null coords when API key missing (Bug Fix #2)", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    // Save and remove the API key
    originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    // Restore the API key
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
  });

  it("returns null lat/lng when GOOGLE_MAPS_API_KEY is not set", async () => {
    const result = await geocodeAddress("123 Main St, Austin, TX");

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it("does NOT return 0,0 (the old buggy behavior)", async () => {
    const result = await geocodeAddress("123 Main St, Austin, TX");

    expect(result.lat).not.toBe(0);
    expect(result.lng).not.toBe(0);
  });

  it("passes formattedAddress through as-is when API key is missing", async () => {
    const inputAddress = "456 Oak Ave, Houston, TX 77001";
    const result = await geocodeAddress(inputAddress);

    expect(result.formattedAddress).toBe(inputAddress);
  });
});
