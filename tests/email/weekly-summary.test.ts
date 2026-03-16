import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  query: {
    notificationPreferences: {
      findFirst: vi.fn(),
    },
  },
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
  sql: Object.assign(vi.fn(), {
    raw: vi.fn(),
  }),
  count: vi.fn().mockReturnValue({ as: vi.fn() }),
  desc: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "mock-id" }, error: null }),
    },
  })),
}));

vi.mock("@/lib/email/unsubscribe", () => ({
  generateUnsubscribeToken: vi
    .fn()
    .mockReturnValue("mock-unsub-token"),
  isSubscribed: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db/schema/notification-preferences", () => ({
  notificationPreferences: {
    userId: "user_id_col",
    dailyDigest: "daily_digest_col",
    weeklySummary: "weekly_summary_col",
    updatedAt: "updated_at_col",
  },
}));

vi.mock("@/lib/db/schema/auth", () => ({
  user: { id: "id_col", name: "name_col", email: "email_col" },
  organization: { id: "id_col", industry: "industry_col" },
  member: {
    userId: "user_id_col",
    organizationId: "organization_id_col",
  },
}));

vi.mock("@/lib/db/schema/leads", () => ({
  leads: {
    id: "id_col",
    sourceType: "source_type_col",
    city: "city_col",
    createdAt: "created_at_col",
    applicableIndustries: "applicable_industries_col",
  },
}));

vi.mock("@/lib/db/schema/bookmarks", () => ({
  bookmarks: {
    userId: "user_id_col",
    organizationId: "organization_id_col",
  },
}));

describe("WeeklySummaryEmail: renders weekly summary template", () => {
  it("renders lead volume trends (this week vs last week)", async () => {
    const { render } = await import("@react-email/components");
    const { WeeklySummaryEmail } = await import(
      "@/components/emails/weekly-summary"
    );

    const html = await render(
      WeeklySummaryEmail({
        userName: "Test User",
        industry: "hvac",
        unsubscribeUrl: "http://localhost:3000/api/unsubscribe?token=abc",
        stats: {
          totalLeadsThisWeek: 45,
          totalLeadsLastWeek: 30,
          topSourceTypes: [
            { type: "permit", count: 25 },
            { type: "bid", count: 12 },
            { type: "news", count: 8 },
          ],
          topCities: [
            { city: "Austin", count: 20 },
            { city: "Dallas", count: 15 },
            { city: "Houston", count: 10 },
          ],
          bookmarkCount: 7,
          newLeadsByDay: [
            { day: "Mon", count: 8 },
            { day: "Tue", count: 5 },
            { day: "Wed", count: 10 },
            { day: "Thu", count: 7 },
            { day: "Fri", count: 9 },
            { day: "Sat", count: 3 },
            { day: "Sun", count: 3 },
          ],
        },
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Should show this week's lead count
    expect(html).toContain("45");
    // Should show trend (50% increase) -- React Email inserts comment nodes between interpolated values
    expect(html).toContain("50");
    expect(html).toContain("increase");
    // Should show source types
    expect(html).toContain("permit");
    expect(html).toContain("25");
    // Should show top cities
    expect(html).toContain("Austin");
    expect(html).toContain("Dallas");
    // Should show bookmark count
    expect(html).toContain("7");
    // Should use hvac color
    expect(html).toContain("#0d9488");
  });

  it("includes unsubscribe link", async () => {
    const { render } = await import("@react-email/components");
    const { WeeklySummaryEmail } = await import(
      "@/components/emails/weekly-summary"
    );

    const html = await render(
      WeeklySummaryEmail({
        userName: "Test User",
        unsubscribeUrl: "http://localhost:3000/api/unsubscribe?token=xyz",
        stats: {
          totalLeadsThisWeek: 10,
          totalLeadsLastWeek: 10,
          topSourceTypes: [],
          topCities: [],
          bookmarkCount: 0,
          newLeadsByDay: [],
        },
        dashboardUrl: "http://localhost:3000",
      })
    );

    expect(html).toContain("Unsubscribe from these emails");
    expect(html).toContain(
      "http://localhost:3000/api/unsubscribe?token=xyz"
    );
  });

  it("shows downward trend when leads decreased", async () => {
    const { render } = await import("@react-email/components");
    const { WeeklySummaryEmail } = await import(
      "@/components/emails/weekly-summary"
    );

    const html = await render(
      WeeklySummaryEmail({
        userName: "Test User",
        stats: {
          totalLeadsThisWeek: 15,
          totalLeadsLastWeek: 30,
          topSourceTypes: [],
          topCities: [],
          bookmarkCount: 0,
          newLeadsByDay: [],
        },
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Should show decrease -- React Email inserts comment nodes between interpolated values
    expect(html).toContain("50");
    expect(html).toContain("decrease");
  });
});

describe("Cron digest route: authenticates and calls generateDigests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns 401 for missing or invalid cron secret", async () => {
    vi.doMock("@/lib/email/digest-generator", () => ({
      generateDigests: vi
        .fn()
        .mockResolvedValue({ sent: 0, skipped: 0, errors: 0 }),
    }));

    const { GET } = await import("@/app/api/cron/digest/route");

    const request = new Request("http://localhost:3000/api/cron/digest", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);
    expect(response.status).toBe(401);
  });

  it("calls generateDigests and returns summary on valid auth", async () => {
    const mockGenerateDigests = vi
      .fn()
      .mockResolvedValue({ sent: 5, skipped: 2, errors: 1 });
    vi.doMock("@/lib/email/digest-generator", () => ({
      generateDigests: mockGenerateDigests,
    }));

    const { GET } = await import("@/app/api/cron/digest/route");

    const request = new Request("http://localhost:3000/api/cron/digest", {
      headers: { authorization: "Bearer test-cron-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.sent).toBe(5);
    expect(body.skipped).toBe(2);
    expect(body.errors).toBe(1);
    expect(mockGenerateDigests).toHaveBeenCalledTimes(1);
  });
});

describe("Cron weekly-summary route: authenticates and calls generateWeeklySummaries", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns 401 for missing or invalid cron secret", async () => {
    vi.doMock("@/lib/email/weekly-summary-generator", () => ({
      generateWeeklySummaries: vi
        .fn()
        .mockResolvedValue({ sent: 0, skipped: 0, errors: 0 }),
    }));

    const { GET } = await import(
      "@/app/api/cron/weekly-summary/route"
    );

    const request = new Request(
      "http://localhost:3000/api/cron/weekly-summary",
      {
        headers: { authorization: "Bearer bad-secret" },
      }
    );

    const response = await GET(request as unknown as import("next/server").NextRequest);
    expect(response.status).toBe(401);
  });

  it("calls generateWeeklySummaries and returns summary on valid auth", async () => {
    const mockGenerate = vi
      .fn()
      .mockResolvedValue({ sent: 3, skipped: 1, errors: 0 });
    vi.doMock("@/lib/email/weekly-summary-generator", () => ({
      generateWeeklySummaries: mockGenerate,
    }));

    const { GET } = await import(
      "@/app/api/cron/weekly-summary/route"
    );

    const request = new Request(
      "http://localhost:3000/api/cron/weekly-summary",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      }
    );

    const response = await GET(request as unknown as import("next/server").NextRequest);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.sent).toBe(3);
    expect(body.skipped).toBe(1);
    expect(body.errors).toBe(0);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
