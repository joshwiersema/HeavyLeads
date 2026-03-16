import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Resend mock (hoisted) ----
const mockSend = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

// Mock all the heavy dependencies that auth.ts imports so the module loads
// in a test environment without real DB/Stripe connections.
vi.mock("@/lib/db", () => ({
  db: { query: { member: { findFirst: vi.fn() } } },
}));

vi.mock("@/lib/db/schema/auth", () => ({
  member: { userId: "userId", organizationId: "organizationId" },
}));

vi.mock("@/lib/stripe", () => ({
  stripeClient: {},
  PRICES: { monthlySubscription: "price_test" },
}));

vi.mock("@/lib/billing", () => ({
  buildCheckoutSessionParams: vi.fn(),
}));

// ---- Tests ----

describe("Email verification in auth config", () => {
  beforeEach(() => {
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("has emailVerification configured within emailAndPassword", async () => {
    const { auth } = await import("@/lib/auth");
    const config = auth.options as Record<string, unknown>;
    const emailAndPassword = config.emailAndPassword as Record<string, unknown>;

    expect(emailAndPassword.emailVerification).toBeDefined();
    const verification = emailAndPassword.emailVerification as Record<string, unknown>;
    expect(verification.sendOnSignUp).toBe(true);
    expect(verification.autoSignInAfterVerification).toBe(true);
    expect(typeof verification.sendVerificationEmail).toBe("function");
  });

  it("sendVerificationEmail uses Resend to send email with verification link", async () => {
    const { auth } = await import("@/lib/auth");
    const config = auth.options as Record<string, unknown>;
    const emailAndPassword = config.emailAndPassword as Record<string, unknown>;
    const verification = emailAndPassword.emailVerification as Record<string, unknown>;
    const sendVerificationEmail = verification.sendVerificationEmail as (
      args: { user: { email: string; name: string }; url: string; token: string }
    ) => Promise<void>;

    await sendVerificationEmail({
      user: { email: "test@example.com", name: "Test User" },
      url: "https://example.com/verify?token=abc",
      token: "abc",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("test@example.com");
    expect(callArgs.subject).toContain("Verify");
    expect(callArgs.react).toBeDefined();
  });

  it("sendVerificationEmail throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const { auth } = await import("@/lib/auth");
    const config = auth.options as Record<string, unknown>;
    const emailAndPassword = config.emailAndPassword as Record<string, unknown>;
    const verification = emailAndPassword.emailVerification as Record<string, unknown>;
    const sendVerificationEmail = verification.sendVerificationEmail as (
      args: { user: { email: string; name: string }; url: string; token: string }
    ) => Promise<void>;

    await expect(
      sendVerificationEmail({
        user: { email: "test@example.com", name: "Test User" },
        url: "https://example.com/verify?token=abc",
        token: "abc",
      })
    ).rejects.toThrow("Email service not configured");
  });
});

describe("VerifyEmail email template", () => {
  it("renders with userName and verificationUrl props", async () => {
    const { VerifyEmail } = await import(
      "@/components/emails/verify-email"
    );
    const result = VerifyEmail({
      userName: "John",
      verificationUrl: "https://example.com/verify?token=abc",
    });
    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
  });

  it("includes the verification URL in rendered output", async () => {
    const { VerifyEmail } = await import(
      "@/components/emails/verify-email"
    );
    const { render } = await import("@react-email/components");
    const html = await render(
      VerifyEmail({
        userName: "John",
        verificationUrl: "https://example.com/verify?token=abc",
      })
    );
    expect(html).toContain("https://example.com/verify?token=abc");
    expect(html).toContain("Verify");
  });
});

describe("Dashboard layout email verification gate", () => {
  it("LEGACY_USER_CUTOFF is exported and is a valid date string", async () => {
    // We can't fully test the layout redirect without a full Next.js server
    // context, but we can verify the cutoff constant is exported correctly.
    const { LEGACY_USER_CUTOFF } = await import(
      "@/app/(dashboard)/layout"
    );
    expect(LEGACY_USER_CUTOFF).toBeDefined();
    expect(typeof LEGACY_USER_CUTOFF).toBe("string");
    // Should be a valid ISO date
    const parsed = new Date(LEGACY_USER_CUTOFF);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
