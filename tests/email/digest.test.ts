import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSampleDigestLeads } from "../helpers/email";

// --- Mocks ---

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: vi.fn(),
  },
}));

// Mock resend module
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null }),
    },
  })),
}));

// Mock getFilteredLeads
vi.mock("@/lib/leads/queries", () => ({
  getFilteredLeads: vi.fn().mockResolvedValue([]),
}));

describe("digest-generator: generateDigests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns empty summary when no users have digest-enabled saved searches", async () => {
    // Mock db.select chain to return empty array (no saved searches with digest enabled)
    const { db } = await import("@/lib/db");
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db as unknown as { select: typeof mockSelect }).select = mockSelect;

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("returns digest data with matching leads for a user's saved search criteria", async () => {
    const { db } = await import("@/lib/db");
    const { getFilteredLeads } = await import("@/lib/leads/queries");

    // Mock saved searches with one digest-enabled search
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([
            {
              saved_searches: {
                id: "search-1",
                userId: "user-1",
                organizationId: "org-1",
                name: "My Search",
                equipmentFilter: ["Excavators"],
                radiusMiles: 50,
                keyword: null,
                dateFrom: null,
                dateTo: null,
                minProjectSize: null,
                maxProjectSize: null,
                isDigestEnabled: true,
                createdAt: new Date(),
              },
              user: {
                id: "user-1",
                name: "Test User",
                email: "test@example.com",
              },
            },
          ]),
        }),
      }),
    });
    (db as unknown as { select: typeof mockSelect }).select = mockSelect;

    // Mock company profile lookup
    const mockQuery = {
      companyProfiles: {
        findFirst: vi.fn().mockResolvedValue({
          hqLat: 30.2672,
          hqLng: -97.7431,
          serviceRadiusMiles: 100,
          equipmentTypes: ["Excavators", "Boom Lifts"],
        }),
      },
    };
    (db as unknown as { query: typeof mockQuery }).query = mockQuery;

    // Mock getFilteredLeads to return matching leads
    const mockLeads = createSampleDigestLeads(3).map((l) => ({
      ...l,
      scrapedAt: new Date(),
      description: "Test project",
      permitNumber: null,
      formattedAddress: null,
      lat: 30.27,
      lng: -97.74,
      city: "Austin",
      state: "TX",
      estimatedValue: 500000,
      applicantName: null,
      contractorName: null,
      agencyName: null,
      permitDate: null,
      postedDate: null,
      deadlineDate: null,
      sourceType: "permit",
      sourceId: "austin",
      sourceJurisdiction: "Austin, TX",
      sourceUrl: null,
      createdAt: new Date(),
      inferredEquipment: [],
      freshness: "New" as const,
      timeline: [],
    }));
    vi.mocked(getFilteredLeads).mockResolvedValue(mockLeads as never);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("skips users with no new matching leads", async () => {
    const { db } = await import("@/lib/db");
    const { getFilteredLeads } = await import("@/lib/leads/queries");

    // Mock one user with a digest-enabled search
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([
            {
              saved_searches: {
                id: "search-1",
                userId: "user-1",
                organizationId: "org-1",
                name: "Empty Search",
                equipmentFilter: null,
                radiusMiles: null,
                keyword: null,
                dateFrom: null,
                dateTo: null,
                minProjectSize: null,
                maxProjectSize: null,
                isDigestEnabled: true,
                createdAt: new Date(),
              },
              user: {
                id: "user-1",
                name: "Test User",
                email: "test@example.com",
              },
            },
          ]),
        }),
      }),
    });
    (db as unknown as { select: typeof mockSelect }).select = mockSelect;

    const mockQuery = {
      companyProfiles: {
        findFirst: vi.fn().mockResolvedValue({
          hqLat: 30.2672,
          hqLng: -97.7431,
          serviceRadiusMiles: 100,
          equipmentTypes: ["Excavators"],
        }),
      },
    };
    (db as unknown as { query: typeof mockQuery }).query = mockQuery;

    // Return empty leads -- no matches
    vi.mocked(getFilteredLeads).mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("uses 24-hour window for new leads (dateFrom set to 24 hours ago)", async () => {
    const { db } = await import("@/lib/db");
    const { getFilteredLeads } = await import("@/lib/leads/queries");

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([
            {
              saved_searches: {
                id: "search-1",
                userId: "user-1",
                organizationId: "org-1",
                name: "Test",
                equipmentFilter: null,
                radiusMiles: null,
                keyword: null,
                dateFrom: null,
                dateTo: null,
                minProjectSize: null,
                maxProjectSize: null,
                isDigestEnabled: true,
                createdAt: new Date(),
              },
              user: {
                id: "user-1",
                name: "Test User",
                email: "test@example.com",
              },
            },
          ]),
        }),
      }),
    });
    (db as unknown as { select: typeof mockSelect }).select = mockSelect;

    const mockQuery = {
      companyProfiles: {
        findFirst: vi.fn().mockResolvedValue({
          hqLat: 30.2672,
          hqLng: -97.7431,
          serviceRadiusMiles: 100,
          equipmentTypes: ["Excavators"],
        }),
      },
    };
    (db as unknown as { query: typeof mockQuery }).query = mockQuery;

    vi.mocked(getFilteredLeads).mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    // Verify getFilteredLeads was called with dateFrom approximately 24h ago
    const callArgs = vi.mocked(getFilteredLeads).mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    if (callArgs) {
      const dateFrom = callArgs.dateFrom as Date;
      expect(dateFrom).toBeInstanceOf(Date);
      const now = new Date();
      const diffMs = now.getTime() - dateFrom.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      // Should be approximately 24 hours ago (within 1 minute tolerance)
      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThan(24.1);
    }
  });
});

describe("daily-digest: DailyDigestEmail renders correctly", () => {
  it("renders lead titles, addresses, scores, and dashboard links", async () => {
    const { render } = await import("@react-email/components");
    const { DailyDigestEmail } = await import(
      "@/components/emails/daily-digest"
    );

    const leads = createSampleDigestLeads(3);
    const html = await render(
      DailyDigestEmail({
        userName: "Test User",
        leads,
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Check lead titles are present
    expect(html).toContain("Commercial Construction Project 1");
    expect(html).toContain("Commercial Construction Project 2");
    expect(html).toContain("Commercial Construction Project 3");

    // Check addresses
    expect(html).toContain("100 Main St, Austin, TX");

    // Check dashboard links
    expect(html).toContain(
      "http://localhost:3000/dashboard/leads/00000000-0000-0000-0000-000000000001"
    );

    // Check summary line (React Email inserts comment nodes between interpolated values)
    expect(html).toContain("new lead(s)");
    expect(html).toContain(">3<");
  });
});

describe("send-digest: sendDigest handles missing API key", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("gracefully handles missing RESEND_API_KEY (logs warning, does not throw)", async () => {
    delete process.env.RESEND_API_KEY;
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Re-import to pick up env change
    vi.resetModules();
    const { sendDigest } = await import("@/lib/email/send-digest");

    const leads = createSampleDigestLeads(2);

    // Should not throw
    await expect(
      sendDigest("test@example.com", "Test User", leads, "http://localhost:3000")
    ).resolves.not.toThrow();

    // Should log a warning about missing key
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_API_KEY not set")
    );
  });
});
