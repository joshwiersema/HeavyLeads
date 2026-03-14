import { describe, it, expect } from "vitest";
import { haversineDistance } from "@/lib/leads/queries";

describe("haversineDistance (pure helper)", () => {
  it("returns ~0 for the same point", () => {
    const distance = haversineDistance(30.2672, -97.7431, 30.2672, -97.7431);
    expect(distance).toBeCloseTo(0, 1);
  });

  it("returns ~195 miles for Austin TX to Dallas TX", () => {
    // Austin TX: 30.2672, -97.7431
    // Dallas TX: 32.7767, -96.7970
    const distance = haversineDistance(30.2672, -97.7431, 32.7767, -96.797);
    // Expected ~195 miles, within 5% tolerance
    expect(distance).toBeGreaterThan(185);
    expect(distance).toBeLessThan(205);
  });

  it("returns ~1638 miles for Austin TX to New York City", () => {
    // Austin TX: 30.2672, -97.7431
    // NYC: 40.7128, -74.0060
    const distance = haversineDistance(30.2672, -97.7431, 40.7128, -74.006);
    // Expected ~1638 miles, within 5% tolerance
    expect(distance).toBeGreaterThan(1550);
    expect(distance).toBeLessThan(1720);
  });

  it("handles zero-longitude meridian crossing", () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    const distance = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    // Expected ~213 miles
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(225);
  });

  it("returns positive distance for any two distinct points", () => {
    const distance = haversineDistance(0, 0, 1, 1);
    expect(distance).toBeGreaterThan(0);
  });
});

describe("geo-filter integration logic", () => {
  it("haversineDistance correctly identifies leads within radius", () => {
    // HQ in Austin, lead 10 miles away
    const hqLat = 30.2672;
    const hqLng = -97.7431;
    const leadLat = 30.3672; // ~7 miles north
    const leadLng = -97.7431;
    const radiusMiles = 50;

    const distance = haversineDistance(hqLat, hqLng, leadLat, leadLng);
    expect(distance).toBeLessThan(radiusMiles);
  });

  it("haversineDistance correctly identifies leads outside radius", () => {
    // HQ in Austin, lead in Dallas (~195 miles)
    const hqLat = 30.2672;
    const hqLng = -97.7431;
    const dallasLat = 32.7767;
    const dallasLng = -96.797;
    const radiusMiles = 50;

    const distance = haversineDistance(hqLat, hqLng, dallasLat, dallasLng);
    expect(distance).toBeGreaterThan(radiusMiles);
  });

  it("same location returns distance ~0 (within radius)", () => {
    const lat = 30.2672;
    const lng = -97.7431;
    const radiusMiles = 50;

    const distance = haversineDistance(lat, lng, lat, lng);
    expect(distance).toBeCloseTo(0, 1);
    expect(distance).toBeLessThanOrEqual(radiusMiles);
  });
});
