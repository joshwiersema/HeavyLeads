import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "mock-id" }, error: null }),
    },
  })),
}));

// Mock getFilteredLeads, applyInMemoryFilters, filterByEquipment
const mockGetFilteredLeads = vi.fn().mockResolvedValue([]);
const mockApplyInMemoryFilters = vi
  .fn()
  .mockImplementation((leads: unknown[]) => leads);
const mockFilterByEquipment = vi
  .fn()
  .mockImplementation((leads: unknown[]) => leads);

vi.mock("@/lib/leads/queries", () => ({
  getFilteredLeads: (...args: unknown[]) => mockGetFilteredLeads(...args),
  applyInMemoryFilters: (...args: unknown[]) =>
    mockApplyInMemoryFilters(...args),
  filterByEquipment: (...args: unknown[]) => mockFilterByEquipment(...args),
}));

describe("digest-optimization: single-query-per-user with widest filter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  /** Helper to set up mocks for a user with multiple saved searches */
  async function setupUserWithSearches(
    searches: Array<{
      id: string;
      radiusMiles: number | null;
      keyword: string | null;
      equipmentFilter: string[] | null;
      dateFrom: Date | null;
      dateTo: Date | null;
      minProjectSize: number | null;
      maxProjectSize: number | null;
    }>
  ) {
    const { db } = await import("@/lib/db");

    const rows = searches.map((s) => ({
      saved_searches: {
        id: s.id,
        userId: "user-1",
        organizationId: "org-1",
        name: `Search ${s.id}`,
        equipmentFilter: s.equipmentFilter,
        radiusMiles: s.radiusMiles,
        keyword: s.keyword,
        dateFrom: s.dateFrom,
        dateTo: s.dateTo,
        minProjectSize: s.minProjectSize,
        maxProjectSize: s.maxProjectSize,
        isDigestEnabled: true,
        createdAt: new Date(),
      },
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      },
    }));

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue(rows),
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
          equipmentTypes: ["Excavators", "Boom Lifts"],
        }),
      },
    };
    (db as unknown as { query: typeof mockQuery }).query = mockQuery;
  }

  it("calls getFilteredLeads exactly once for a user with 3 saved searches", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: 25,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: 50,
        keyword: "warehouse",
        equipmentFilter: ["Excavators"],
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s3",
        radiusMiles: 75,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: 100000,
        maxProjectSize: 500000,
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    // CRITICAL: getFilteredLeads must be called exactly ONCE (not 3 times)
    expect(mockGetFilteredLeads).toHaveBeenCalledTimes(1);
  });

  it("computes widest radius as max(search1.radius, search2.radius, search3.radius, serviceRadius)", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: 25,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: 75,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s3",
        radiusMiles: 50,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    const callArgs = mockGetFilteredLeads.mock.calls[0][0];
    // serviceRadius=100, search radii = 25,75,50 -> max(100, 25, 75, 50) = 100
    expect(callArgs.radiusMiles).toBe(100);
  });

  it("computes widest dateFrom as the earliest dateFrom across all searches (or 24h ago)", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: twoDaysAgo,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: threeDaysAgo,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    const callArgs = mockGetFilteredLeads.mock.calls[0][0];
    // Widest dateFrom is earliest: threeDaysAgo
    expect(callArgs.dateFrom.getTime()).toBeLessThanOrEqual(
      threeDaysAgo.getTime() + 1000
    );
  });

  it("computes widest maxProjectSize as the largest across all searches (null = Infinity)", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: 500000,
      },
      {
        id: "s2",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null, // null = no limit = Infinity
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    const callArgs = mockGetFilteredLeads.mock.calls[0][0];
    // null maxProjectSize = no upper bound, so widest should pass undefined (no filter)
    expect(callArgs.maxProjectSize).toBeUndefined();
  });

  it("computes widest minProjectSize as the smallest across all searches (null = 0)", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: 100000,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: 50000,
        maxProjectSize: null,
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    const callArgs = mockGetFilteredLeads.mock.calls[0][0];
    // Both have minProjectSize, smallest is 50000
    expect(callArgs.minProjectSize).toBe(50000);
  });

  it("applies per-search in-memory filtering via applyInMemoryFilters for keyword", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: "warehouse",
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
    ]);

    const mockLead1 = {
      id: "lead-1",
      title: "Warehouse project",
      address: "123 Main",
      formattedAddress: null,
      score: 80,
      projectType: "commercial",
      distance: 10,
      scrapedAt: new Date(),
      estimatedValue: 100000,
      inferredEquipment: [],
    };

    mockGetFilteredLeads.mockResolvedValue([mockLead1]);
    // applyInMemoryFilters should be called per-search
    mockApplyInMemoryFilters.mockImplementation((leads: unknown[]) => leads);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    // applyInMemoryFilters should be called once per search (2 calls)
    expect(mockApplyInMemoryFilters).toHaveBeenCalledTimes(2);

    // First call should have keyword "warehouse"
    const firstCallParams = mockApplyInMemoryFilters.mock.calls[0][1];
    expect(firstCallParams.keyword).toBe("warehouse");

    // Second call should have no keyword (undefined)
    const secondCallParams = mockApplyInMemoryFilters.mock.calls[1][1];
    expect(secondCallParams.keyword).toBeUndefined();
  });

  it("deduplicates leads across searches (lead matching 2 searches appears once)", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
      {
        id: "s2",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
    ]);

    const sharedLead = {
      id: "lead-shared",
      title: "Shared project",
      address: "123 Main",
      formattedAddress: null,
      score: 90,
      projectType: "commercial",
      distance: 5,
      scrapedAt: new Date(),
      estimatedValue: 200000,
      inferredEquipment: [],
    };

    mockGetFilteredLeads.mockResolvedValue([sharedLead]);
    // Both searches return the same lead after filtering
    mockApplyInMemoryFilters.mockImplementation((leads: unknown[]) => leads);
    mockFilterByEquipment.mockImplementation((leads: unknown[]) => leads);

    // Track what gets sent
    const { sendDigest } = await import("@/lib/email/send-digest");
    vi.mocked(sendDigest).mockResolvedValue(undefined);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    expect(result.sent).toBe(1);

    // sendDigest should receive deduplicated leads (1 lead, not 2)
    const sendCall = vi.mocked(sendDigest).mock.calls[0];
    expect(sendCall[2]).toHaveLength(1);
    expect(sendCall[2][0].id).toBe("lead-shared");
  });

  it("coerces null saved search column values to undefined when passed to filters", async () => {
    await setupUserWithSearches([
      {
        id: "s1",
        radiusMiles: null,
        keyword: null,
        equipmentFilter: null,
        dateFrom: null,
        dateTo: null,
        minProjectSize: null,
        maxProjectSize: null,
      },
    ]);

    mockGetFilteredLeads.mockResolvedValue([]);

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    await generateDigests();

    // getFilteredLeads should not receive null values -- they should be undefined or omitted
    const gflArgs = mockGetFilteredLeads.mock.calls[0][0];
    // keyword should NOT be null
    expect(gflArgs.keyword).not.toBe(null);
    // equipmentFilter should NOT be null
    expect(gflArgs.equipmentFilter).not.toBe(null);

    // If applyInMemoryFilters was called, params should use undefined not null
    if (mockApplyInMemoryFilters.mock.calls.length > 0) {
      const filterParams = mockApplyInMemoryFilters.mock.calls[0][1];
      expect(filterParams.keyword).not.toBe(null);
    }
  });
});
