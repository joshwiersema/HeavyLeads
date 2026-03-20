/**
 * Server-side geocoding utility with 3-layer strategy:
 * 1. Cache lookup (DB) -- avoids redundant API calls
 * 2. Google Maps Geocoding API (primary)
 * 3. Nominatim (free fallback when Google quota exceeded or key missing)
 *
 * IMPORTANT: This must only be called from server actions/components.
 * The API key is never exposed to the client.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { geocodingCache } from "@/lib/db/schema/geocoding-cache";
import { eq, gt, and } from "drizzle-orm";

export interface GeocodingResult {
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
}

/** Normalize address for consistent hashing */
export function normalizeAddress(address: string): string {
  return address.toLowerCase().trim().replace(/\s+/g, " ");
}

/** SHA-256 hash of normalized address */
export function hashAddress(address: string): string {
  return createHash("sha256")
    .update(normalizeAddress(address))
    .digest("hex");
}

/** Track last Nominatim call for rate limiting (1 req/sec) */
let lastNominatimCall = 0;

/**
 * Nominatim geocoding fallback -- free, unlimited (but rate-limited to 1 req/sec).
 * Uses OpenStreetMap data via the Nominatim API.
 */
export async function nominatimGeocode(
  address: string
): Promise<GeocodingResult> {
  // Enforce 1 req/sec rate limit
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastNominatimCall = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "GroundPulse/1.0 (construction-lead-intelligence)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Nominatim API error: ${response.status} ${response.statusText}`
    );
  }

  const results = await response.json();
  if (!results || results.length === 0) {
    return { lat: null, lng: null, formattedAddress: address };
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    formattedAddress: results[0].display_name || address,
  };
}

/** 90-day cache TTL in milliseconds */
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Geocode an address using the 3-layer strategy:
 * 1. Check DB cache for non-expired result
 * 2. Try Google Maps Geocoding API (if key available)
 * 3. Fall back to Nominatim (if Google fails, quota exceeded, or key missing)
 *
 * Results (including null coords for bad addresses) are cached to prevent
 * redundant API calls.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult> {
  const addressHash = hashAddress(address);

  // --- Layer 1: Cache lookup ---
  try {
    const cached = await db
      .select()
      .from(geocodingCache)
      .where(
        and(
          eq(geocodingCache.addressHash, addressHash),
          gt(geocodingCache.expiresAt, new Date())
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const row = cached[0];
      return {
        lat: row.lat,
        lng: row.lng,
        formattedAddress: row.formattedAddress ?? address,
      };
    }
  } catch (err) {
    // Cache lookup failed (DB down, etc.) -- proceed to API calls
    console.warn(
      "[geocoding] Cache lookup failed, proceeding to API:",
      err instanceof Error ? err.message : err
    );
  }

  // --- Layer 2: Google Maps primary ---
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  let result: GeocodingResult | null = null;
  let shouldFallbackToNominatim = false;

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        shouldFallbackToNominatim = true;
      } else {
        const data = await response.json();

        // Check for quota or permission errors from Google
        if (
          data.status === "OVER_QUERY_LIMIT" ||
          data.status === "REQUEST_DENIED"
        ) {
          console.warn(
            `[geocoding] Google Maps API ${data.status}: falling back to Nominatim`
          );
          shouldFallbackToNominatim = true;
        } else if (
          data.results &&
          data.results.length > 0 &&
          data.results[0].geometry?.location
        ) {
          result = {
            lat: data.results[0].geometry.location.lat,
            lng: data.results[0].geometry.location.lng,
            formattedAddress: data.results[0].formatted_address || address,
          };
        } else {
          // Google returned no results -- this address is bad
          result = { lat: null, lng: null, formattedAddress: address };
        }
      }
    } catch (err) {
      console.warn(
        "[geocoding] Google Maps API error, falling back to Nominatim:",
        err instanceof Error ? err.message : err
      );
      shouldFallbackToNominatim = true;
    }
  } else {
    // No API key -- go directly to Nominatim
    console.warn(
      "[geocoding] GOOGLE_MAPS_API_KEY not set, using Nominatim fallback"
    );
    shouldFallbackToNominatim = true;
  }

  // --- Layer 3: Nominatim fallback ---
  let provider: "google" | "nominatim" = "google";

  if (shouldFallbackToNominatim) {
    provider = "nominatim";
    try {
      result = await nominatimGeocode(address);
    } catch (err) {
      console.warn(
        "[geocoding] Nominatim fallback failed:",
        err instanceof Error ? err.message : err
      );
      result = { lat: null, lng: null, formattedAddress: address };
    }
  }

  // If neither Google nor Nominatim produced a result, return null coords
  if (!result) {
    result = { lat: null, lng: null, formattedAddress: address };
  }

  // --- Cache the result (including null coords for bad addresses) ---
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    await db
      .insert(geocodingCache)
      .values({
        addressHash,
        originalAddress: address,
        lat: result.lat,
        lng: result.lng,
        formattedAddress: result.formattedAddress,
        provider,
        createdAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: geocodingCache.addressHash,
        set: {
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
          provider,
          createdAt: now,
          expiresAt,
        },
      });
  } catch (err) {
    // Cache insert failed -- non-fatal, result is still valid
    console.warn(
      "[geocoding] Failed to cache geocoding result:",
      err instanceof Error ? err.message : err
    );
  }

  return result;
}
