import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StormAlert } from "@/lib/storm-alerts/types";

// Track the mock send function so we can assert on it
const mockSend = vi.fn().mockResolvedValue({
  data: { id: "mock-id" },
  error: null,
});

// Mock resend module with a proper class constructor
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: vi.fn(),
  },
}));

function createMockAlerts(count: number): StormAlert[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${i + 1}`,
    title: `Storm Alert ${i + 1}`,
    description: `Description for storm alert ${i + 1}`,
    severity: i === 0 ? "Extreme" : i === 1 ? "Severe" : "Moderate",
    city: "Dallas",
    state: "TX",
    lat: 32.78 + i * 0.1,
    lng: -96.8 + i * 0.1,
    expiresAt: new Date(Date.now() + (i + 1) * 3600_000),
    sourceUrl: `https://alerts.weather.gov/search?id=alert-${i + 1}`,
  }));
}

describe("sendStormAlertEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    mockSend.mockResolvedValue({ data: { id: "mock-id" }, error: null });
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("skips when RESEND_API_KEY not set", async () => {
    delete process.env.RESEND_API_KEY;
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.resetModules();
    const { sendStormAlertEmail } = await import(
      "@/lib/email/send-storm-alert"
    );

    const alerts = createMockAlerts(2);
    await expect(
      sendStormAlertEmail(
        "test@example.com",
        "Test User",
        alerts,
        "http://localhost:3000"
      )
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_API_KEY not set")
    );
  });

  it("calls Resend with correct subject for single storm", async () => {
    vi.resetModules();
    const { sendStormAlertEmail } = await import(
      "@/lib/email/send-storm-alert"
    );

    const alerts = createMockAlerts(1);
    await sendStormAlertEmail(
      "test@example.com",
      "Test User",
      alerts,
      "http://localhost:3000"
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["test@example.com"],
        subject: "Storm Alert: 1 active storm in your service area",
      })
    );
  });

  it("calls Resend with pluralized subject for multiple storms", async () => {
    vi.resetModules();
    const { sendStormAlertEmail } = await import(
      "@/lib/email/send-storm-alert"
    );

    const alerts = createMockAlerts(3);
    await sendStormAlertEmail(
      "test@example.com",
      "Test User",
      alerts,
      "http://localhost:3000"
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Storm Alert: 3 active storms in your service area",
      })
    );
  });

  it("does not throw on Resend API error", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "API Error" },
    });

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.resetModules();
    const { sendStormAlertEmail } = await import(
      "@/lib/email/send-storm-alert"
    );

    const alerts = createMockAlerts(1);
    await expect(
      sendStormAlertEmail(
        "test@example.com",
        "Test User",
        alerts,
        "http://localhost:3000"
      )
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send storm alert"),
      expect.anything()
    );
  });
});

describe("StormAlertEmail template", () => {
  it("renders with alert data", async () => {
    const { render } = await import("@react-email/components");
    const { StormAlertEmail } = await import(
      "@/components/emails/storm-alert"
    );

    const alerts = createMockAlerts(2);
    const html = await render(
      StormAlertEmail({
        userName: "John Doe",
        alerts,
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Check storm theme is present
    expect(html).toContain("Storm Alert");

    // Check user greeting
    expect(html).toContain("John Doe");

    // Check alert count (React Email inserts comment nodes between interpolated values)
    expect(html).toContain(">2<");
    expect(html).toContain("active storm alert");

    // Check alert titles
    expect(html).toContain("Storm Alert 1");
    expect(html).toContain("Storm Alert 2");

    // Check severity labels are present
    expect(html).toContain("Extreme");
    expect(html).toContain("Severe");

    // Check location
    expect(html).toContain("Dallas");
    expect(html).toContain("TX");

    // Check CTA link includes storm filter
    expect(html).toContain("sourceTypes=storm");
  });

  it("renders brand name GroundPulse", async () => {
    const { render } = await import("@react-email/components");
    const { StormAlertEmail } = await import(
      "@/components/emails/storm-alert"
    );

    const alerts = createMockAlerts(1);
    const html = await render(
      StormAlertEmail({
        userName: "Test",
        alerts,
        dashboardUrl: "http://localhost:3000",
      })
    );

    expect(html).toContain("GroundPulse");
  });

  it("limits displayed alerts to 5", async () => {
    const { render } = await import("@react-email/components");
    const { StormAlertEmail } = await import(
      "@/components/emails/storm-alert"
    );

    const alerts = createMockAlerts(8);
    const html = await render(
      StormAlertEmail({
        userName: "Test",
        alerts,
        dashboardUrl: "http://localhost:3000",
      })
    );

    // Should show "and 3 more" since we display max 5
    // React Email inserts comment nodes, so check for the count and "more" separately
    expect(html).toMatch(/3[\s\S]*?more/);
    // Should not show alerts 6, 7, 8 by title
    expect(html).not.toContain("Storm Alert 6");
    expect(html).not.toContain("Storm Alert 7");
    expect(html).not.toContain("Storm Alert 8");
    // Should show alerts 1-5
    expect(html).toContain("Storm Alert 1");
    expect(html).toContain("Storm Alert 5");
  });
});
