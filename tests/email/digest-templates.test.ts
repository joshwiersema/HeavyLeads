import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSampleDigestLeads } from "../helpers/email";

// --- Mocks ---

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: vi.fn(),
  },
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

vi.mock("@/lib/leads/queries", () => ({
  getFilteredLeads: vi.fn().mockResolvedValue([]),
  applyInMemoryFilters: vi
    .fn()
    .mockImplementation((leads: unknown[]) => leads),
  filterByEquipment: vi
    .fn()
    .mockImplementation((leads: unknown[]) => leads),
}));

vi.mock("@/lib/email/unsubscribe", () => ({
  generateUnsubscribeToken: vi
    .fn()
    .mockReturnValue("mock-unsub-token"),
  isSubscribed: vi.fn().mockResolvedValue(true),
}));

describe("DailyDigestEmail: renders with industry-specific styling", () => {
  it("renders with industry-specific styling via EmailLayout", async () => {
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
        industry: "roofing",
      })
    );

    // Should use roofing color from EmailLayout
    expect(html).toContain("#dc2626");
    // Should have GroundPulse branding
    expect(html).toContain("GroundPulse");
  });

  it("includes unsubscribe link in footer via EmailLayout", async () => {
    const { render } = await import("@react-email/components");
    const { DailyDigestEmail } = await import(
      "@/components/emails/daily-digest"
    );

    const leads = createSampleDigestLeads(2);
    const html = await render(
      DailyDigestEmail({
        userName: "Test User",
        leads,
        dashboardUrl: "http://localhost:3000",
        unsubscribeUrl:
          "http://localhost:3000/api/unsubscribe?token=abc123",
      })
    );

    expect(html).toContain("Unsubscribe from these emails");
    expect(html).toContain(
      "http://localhost:3000/api/unsubscribe?token=abc123"
    );
  });

  it("shows top 10 leads with score, distance, and source type", async () => {
    const { render } = await import("@react-email/components");
    const { DailyDigestEmail } = await import(
      "@/components/emails/daily-digest"
    );

    const leads = createSampleDigestLeads(12);
    const html = await render(
      DailyDigestEmail({
        userName: "Test User",
        leads,
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Should show leads 1-10 titles
    expect(html).toContain("Commercial Construction Project 1");
    expect(html).toContain("Commercial Construction Project 10");
    // Should NOT show lead 11
    expect(html).not.toContain("Commercial Construction Project 11");
    // Should show overflow notice
    expect(html).toContain("View all");
    // Should contain scores
    expect(html).toContain("Score:");
    // Should contain distance
    expect(html).toContain("mi away");
  });

  it("shows CAN-SPAM footer text", async () => {
    const { render } = await import("@react-email/components");
    const { DailyDigestEmail } = await import(
      "@/components/emails/daily-digest"
    );

    const leads = createSampleDigestLeads(2);
    const html = await render(
      DailyDigestEmail({
        userName: "Test User",
        leads,
        dashboardUrl: "http://localhost:3000",
      })
    );

    expect(html).toContain(
      "You are receiving this email because you signed up for GroundPulse"
    );
  });
});

describe("digest-generator: generateDigests respects notification preferences", () => {
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

  it("skips users who have dailyDigest=false in notification_preferences", async () => {
    const { db } = await import("@/lib/db");
    const { isSubscribed } = await import("@/lib/email/unsubscribe");

    // Mock isSubscribed to return false (user unsubscribed)
    vi.mocked(isSubscribed).mockResolvedValue(false);

    // Mock saved searches with one user
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

    const { generateDigests } = await import(
      "@/lib/email/digest-generator"
    );
    const result = await generateDigests();

    expect(isSubscribed).toHaveBeenCalledWith("user-1", "daily_digest");
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });
});

describe("send-digest: includes List-Unsubscribe headers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sends with List-Unsubscribe and List-Unsubscribe-Post headers when unsubscribeUrl provided", async () => {
    vi.resetModules();

    const mockSend = vi
      .fn()
      .mockResolvedValue({ data: { id: "mock-id" }, error: null });

    vi.doMock("resend", () => {
      const MockResend = function () {
        return { emails: { send: mockSend } };
      };
      return { Resend: MockResend };
    });

    const { sendDigest } = await import("@/lib/email/send-digest");
    const leads = createSampleDigestLeads(2);

    await sendDigest(
      "test@example.com",
      "Test User",
      leads,
      "http://localhost:3000",
      "roofing",
      "http://localhost:3000/api/unsubscribe?token=abc"
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.headers).toBeDefined();
    expect(callArgs.headers["List-Unsubscribe"]).toContain(
      "http://localhost:3000/api/unsubscribe?token=abc"
    );
    expect(callArgs.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  });

  it("uses GroundPulse branding in from address", async () => {
    vi.resetModules();

    const mockSend = vi
      .fn()
      .mockResolvedValue({ data: { id: "mock-id" }, error: null });

    vi.doMock("resend", () => {
      const MockResend = function () {
        return { emails: { send: mockSend } };
      };
      return { Resend: MockResend };
    });

    const { sendDigest } = await import("@/lib/email/send-digest");
    const leads = createSampleDigestLeads(1);

    await sendDigest(
      "test@example.com",
      "Test User",
      leads,
      "http://localhost:3000"
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.from).toContain("GroundPulse");
  });
});
