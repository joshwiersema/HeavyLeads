import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StormAlert, SubscriberInfo } from "@/lib/storm-alerts/types";

// --- Mocks ---

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi
    .fn()
    .mockImplementation((a: unknown, b: unknown) => ({ type: "eq", a, b })),
  and: vi
    .fn()
    .mockImplementation((...args: unknown[]) => ({ type: "and", args })),
  gt: vi
    .fn()
    .mockImplementation((a: unknown, b: unknown) => ({ type: "gt", a, b })),
  sql: Object.assign(
    vi.fn().mockImplementation((...args: unknown[]) => ({
      type: "sql",
      args,
    })),
    {
      raw: vi.fn().mockImplementation((s: string) => ({ type: "raw", value: s })),
    }
  ),
}));

vi.mock("@/lib/db/schema/leads", () => ({
  leads: {
    id: "leads.id",
    title: "leads.title",
    description: "leads.description",
    severity: "leads.severity",
    city: "leads.city",
    state: "leads.state",
    lat: "leads.lat",
    lng: "leads.lng",
    deadlineDate: "leads.deadline_date",
    sourceUrl: "leads.source_url",
    sourceType: "leads.source_type",
  },
}));

vi.mock("@/lib/db/schema/organization-profiles", () => ({
  organizationProfiles: {
    organizationId: "org_profiles.organization_id",
    hqLat: "org_profiles.hq_lat",
    hqLng: "org_profiles.hq_lng",
    serviceRadiusMiles: "org_profiles.service_radius_miles",
  },
  companyProfiles: {
    organizationId: "org_profiles.organization_id",
    hqLat: "org_profiles.hq_lat",
    hqLng: "org_profiles.hq_lng",
    serviceRadiusMiles: "org_profiles.service_radius_miles",
  },
}));

vi.mock("@/lib/db/schema/auth", () => ({
  organization: {
    id: "organization.id",
    name: "organization.name",
    industry: "organization.industry",
  },
  member: {
    id: "member.id",
    organizationId: "member.organization_id",
    userId: "member.user_id",
  },
  user: {
    id: "user.id",
    name: "user.name",
    email: "user.email",
  },
}));

const mockExecute = vi.fn();

describe("getActiveStormAlertsForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
  });

  it("returns storm alerts within org service area", async () => {
    const futureDate = new Date(Date.now() + 3600_000);
    mockExecute.mockResolvedValueOnce([
      {
        id: "alert-1",
        title: "Severe Thunderstorm Warning",
        description: "Large hail expected",
        severity: "Severe",
        city: "Dallas",
        state: "TX",
        lat: 32.78,
        lng: -96.8,
        deadline_date: futureDate,
        source_url: "https://alerts.weather.gov/search?id=alert-1",
      },
    ]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getActiveStormAlertsForOrg("org-1");

    expect(mockExecute).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("alert-1");
    expect(result[0].title).toBe("Severe Thunderstorm Warning");
    expect(result[0].severity).toBe("Severe");
    expect(result[0].expiresAt).toEqual(futureDate);
  });

  it("returns empty array when no storms match", async () => {
    mockExecute.mockResolvedValueOnce([]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getActiveStormAlertsForOrg("org-no-storms");

    expect(result).toEqual([]);
  });

  it("maps database rows to StormAlert interface correctly", async () => {
    const futureDate = new Date(Date.now() + 7200_000);
    mockExecute.mockResolvedValueOnce([
      {
        id: "alert-2",
        title: "Tornado Warning",
        description: "Take shelter now",
        severity: "Extreme",
        city: "Oklahoma City",
        state: "OK",
        lat: 35.47,
        lng: -97.52,
        deadline_date: futureDate,
        source_url: "https://alerts.weather.gov/search?id=alert-2",
      },
    ]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getActiveStormAlertsForOrg("org-1");

    const alert = result[0];
    expect(alert).toMatchObject({
      id: "alert-2",
      title: "Tornado Warning",
      description: "Take shelter now",
      severity: "Extreme",
      city: "Oklahoma City",
      state: "OK",
      lat: 35.47,
      lng: -97.52,
      sourceUrl: "https://alerts.weather.gov/search?id=alert-2",
    });
    expect(alert.expiresAt).toEqual(futureDate);
  });
});

describe("getRoofingSubscribersInStormArea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
  });

  it("returns roofing subscribers within range of storm", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        org_id: "org-roof-1",
        org_name: "Roof Masters",
        user_id: "user-1",
        user_name: "John Smith",
        email: "john@roofmasters.com",
        hq_lat: 32.78,
        hq_lng: -96.8,
        service_radius_miles: 75,
      },
    ]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getRoofingSubscribersInStormArea(32.9, -96.7);

    expect(mockExecute).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      orgId: "org-roof-1",
      orgName: "Roof Masters",
      userId: "user-1",
      userName: "John Smith",
      email: "john@roofmasters.com",
      hqLat: 32.78,
      hqLng: -96.8,
      serviceRadiusMiles: 75,
    });
  });

  it("returns empty array when no roofing orgs in range", async () => {
    mockExecute.mockResolvedValueOnce([]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getRoofingSubscribersInStormArea(0, 0);

    expect(result).toEqual([]);
  });

  it("returns multiple subscribers from different orgs", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        org_id: "org-1",
        org_name: "Roof Co",
        user_id: "user-1",
        user_name: "Alice",
        email: "alice@roofco.com",
        hq_lat: 32.78,
        hq_lng: -96.8,
        service_radius_miles: 50,
      },
      {
        org_id: "org-2",
        org_name: "Shingle Pro",
        user_id: "user-2",
        user_name: "Bob",
        email: "bob@shinglepro.com",
        hq_lat: 33.0,
        hq_lng: -96.5,
        service_radius_miles: 100,
      },
    ]);

    const { db } = await import("@/lib/db");
    (db as unknown as { execute: typeof mockExecute }).execute = mockExecute;

    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const result = await mod.getRoofingSubscribersInStormArea(32.9, -96.7);

    expect(result).toHaveLength(2);
    expect(result[0].orgId).toBe("org-1");
    expect(result[1].orgId).toBe("org-2");
  });
});

describe("haversineDistance", () => {
  it("calculates correct distance between two known points", async () => {
    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    // Dallas (32.7767, -96.7970) to Austin (30.2672, -97.7431)
    // Known distance: ~190 miles
    const distance = mod.haversineDistance(32.7767, -96.797, 30.2672, -97.7431);
    expect(distance).toBeGreaterThan(180);
    expect(distance).toBeLessThan(200);
  });

  it("returns 0 for identical points", async () => {
    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    const distance = mod.haversineDistance(30.0, -97.0, 30.0, -97.0);
    expect(distance).toBe(0);
  });

  it("handles cross-hemisphere calculations", async () => {
    vi.resetModules();
    const mod = await import("@/lib/storm-alerts/queries");
    // New York (40.7128, -74.0060) to London (51.5074, -0.1278)
    // Known distance: ~3459 miles
    const distance = mod.haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(3400);
    expect(distance).toBeLessThan(3500);
  });
});
