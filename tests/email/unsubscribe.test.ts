import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

// Mock the database module
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

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  sql: vi.fn(),
}));

// Mock schema
vi.mock("@/lib/db/schema/notification-preferences", () => ({
  notificationPreferences: {
    userId: "user_id_col",
    dailyDigest: "daily_digest_col",
    weeklySummary: "weekly_summary_col",
    updatedAt: "updated_at_col",
  },
}));

describe("unsubscribe: generateUnsubscribeToken and validateUnsubscribeToken", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("generates a token that can be validated back to the original userId and emailType", async () => {
    const { generateUnsubscribeToken, validateUnsubscribeToken } =
      await import("@/lib/email/unsubscribe");

    const token = generateUnsubscribeToken("user-123", "daily_digest");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const result = validateUnsubscribeToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-123");
    expect(result!.emailType).toBe("daily_digest");
  });

  it("generates different tokens for different email types", async () => {
    const { generateUnsubscribeToken } = await import(
      "@/lib/email/unsubscribe"
    );

    const token1 = generateUnsubscribeToken("user-123", "daily_digest");
    const token2 = generateUnsubscribeToken("user-123", "weekly_summary");
    expect(token1).not.toBe(token2);
  });

  it("returns null for a tampered token", async () => {
    const { generateUnsubscribeToken, validateUnsubscribeToken } =
      await import("@/lib/email/unsubscribe");

    const token = generateUnsubscribeToken("user-123", "daily_digest");
    // Tamper with the token by changing a character
    const tampered = token.slice(0, -2) + "xx";

    const result = validateUnsubscribeToken(tampered);
    expect(result).toBeNull();
  });

  it("returns null for a completely invalid token", async () => {
    const { validateUnsubscribeToken } = await import(
      "@/lib/email/unsubscribe"
    );

    expect(validateUnsubscribeToken("not-a-real-token")).toBeNull();
    expect(validateUnsubscribeToken("")).toBeNull();
  });

  it("uses UNSUBSCRIBE_SECRET when available, falling back to CRON_SECRET", async () => {
    process.env.UNSUBSCRIBE_SECRET = "special-unsub-secret";
    vi.resetModules();

    const { generateUnsubscribeToken, validateUnsubscribeToken } =
      await import("@/lib/email/unsubscribe");

    const token = generateUnsubscribeToken("user-456", "weekly_summary");
    const result = validateUnsubscribeToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-456");

    delete process.env.UNSUBSCRIBE_SECRET;
  });
});

describe("unsubscribe: unsubscribeUser", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-cron-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("calls db insert with onConflictDoUpdate for upsert behavior", async () => {
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockDb.insert.mockReturnValue({
      values: mockValues,
    });

    const { unsubscribeUser } = await import("@/lib/email/unsubscribe");
    await unsubscribeUser("user-123", "daily_digest");

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalled();
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("handles weekly_summary email type", async () => {
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockDb.insert.mockReturnValue({
      values: mockValues,
    });

    const { unsubscribeUser } = await import("@/lib/email/unsubscribe");
    await unsubscribeUser("user-456", "weekly_summary");

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });
});

describe("unsubscribe: isSubscribed", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-cron-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns true when no preferences row exists (default subscribed)", async () => {
    mockDb.query.notificationPreferences.findFirst.mockResolvedValue(
      undefined
    );

    const { isSubscribed } = await import("@/lib/email/unsubscribe");
    const result = await isSubscribed("user-123", "daily_digest");

    expect(result).toBe(true);
  });

  it("returns true when dailyDigest is true in preferences", async () => {
    mockDb.query.notificationPreferences.findFirst.mockResolvedValue({
      dailyDigest: true,
      weeklySummary: true,
    });

    const { isSubscribed } = await import("@/lib/email/unsubscribe");
    const result = await isSubscribed("user-123", "daily_digest");

    expect(result).toBe(true);
  });

  it("returns false when dailyDigest is false in preferences", async () => {
    mockDb.query.notificationPreferences.findFirst.mockResolvedValue({
      dailyDigest: false,
      weeklySummary: true,
    });

    const { isSubscribed } = await import("@/lib/email/unsubscribe");
    const result = await isSubscribed("user-123", "daily_digest");

    expect(result).toBe(false);
  });

  it("returns false when weeklySummary is false in preferences", async () => {
    mockDb.query.notificationPreferences.findFirst.mockResolvedValue({
      dailyDigest: true,
      weeklySummary: false,
    });

    const { isSubscribed } = await import("@/lib/email/unsubscribe");
    const result = await isSubscribed("user-123", "weekly_summary");

    expect(result).toBe(false);
  });
});

describe("EmailLayout: shared email layout component", () => {
  it("renders with default industry color (blue-800) when no industry specified", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { previewText: "Test" },
        React.createElement("p", null, "Hello")
      )
    );

    expect(html).toContain("#1e40af");
    expect(html).toContain("LeadForge");
  });

  it("renders industry-specific header color for heavy_equipment (blue)", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { industry: "heavy_equipment", previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("#1e40af");
  });

  it("renders industry-specific header color for roofing (red)", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { industry: "roofing", previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("#dc2626");
  });

  it("renders industry-specific header color for solar (amber)", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { industry: "solar", previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("#d97706");
  });

  it("renders industry-specific header color for hvac (teal)", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { industry: "hvac", previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("#0d9488");
  });

  it("renders industry-specific header color for electrical (indigo)", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { industry: "electrical", previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("#4f46e5");
  });

  it("renders CAN-SPAM compliant footer with unsubscribe link", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        {
          unsubscribeUrl: "https://app.leadforge.com/api/unsubscribe?token=abc",
          previewText: "Test",
        },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).toContain("Unsubscribe from these emails");
    expect(html).toContain(
      "https://app.leadforge.com/api/unsubscribe?token=abc"
    );
    expect(html).toContain("LeadForge");
    expect(html).toContain(
      "You are receiving this email because you signed up for LeadForge"
    );
  });

  it("renders without unsubscribe link when not provided", async () => {
    const { render } = await import("@react-email/components");
    const { EmailLayout } = await import(
      "@/components/emails/email-layout"
    );
    const React = await import("react");

    const html = await render(
      React.createElement(
        EmailLayout,
        { previewText: "Test" },
        React.createElement("p", null, "Content")
      )
    );

    expect(html).not.toContain("Unsubscribe from these emails");
    expect(html).toContain("LeadForge");
  });
});
