import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Schema tests ----

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", async () => {
    const { forgotPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = forgotPasswordSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty email", async () => {
    const { forgotPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", async () => {
    const { forgotPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords >= 8 chars", async () => {
    const { resetPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = resetPasswordSchema.safeParse({
      newPassword: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", async () => {
    const { resetPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = resetPasswordSchema.safeParse({
      newPassword: "password123",
      confirmPassword: "different456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const { resetPasswordSchema } = await import(
      "@/lib/validators/auth"
    );
    const result = resetPasswordSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

// ---- Email template tests ----

describe("PasswordResetEmail", () => {
  it("renders with url and userName props", async () => {
    const { PasswordResetEmail } = await import(
      "@/components/emails/password-reset"
    );
    const result = PasswordResetEmail({
      url: "https://example.com/reset?token=abc",
      userName: "John",
    });
    expect(result).toBeDefined();
    // The component should return a React element (JSX)
    expect(result.type).toBeDefined();
  });

  it("includes the reset URL in the rendered output", async () => {
    const { PasswordResetEmail } = await import(
      "@/components/emails/password-reset"
    );
    const { render } = await import("@react-email/components");
    const html = await render(
      PasswordResetEmail({
        url: "https://example.com/reset?token=abc",
        userName: "John",
      })
    );
    expect(html).toContain("https://example.com/reset?token=abc");
    expect(html).toContain("Reset Your Password");
  });
});

// ---- sendResetPassword callback tests ----

const mockSend = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

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

describe("sendResetPassword callback in auth config", () => {
  beforeEach(() => {
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("calls Resend with correct from/to/subject/react args", async () => {
    const { auth } = await import("@/lib/auth");
    const config = auth.options as Record<string, unknown>;
    const emailAndPassword = config.emailAndPassword as Record<string, unknown>;
    const sendResetPassword = emailAndPassword.sendResetPassword as (
      args: { user: { email: string; name: string }; url: string }
    ) => Promise<void>;

    expect(sendResetPassword).toBeDefined();
    expect(typeof sendResetPassword).toBe("function");

    await sendResetPassword({
      user: { email: "test@example.com", name: "Test User" },
      url: "https://example.com/reset?token=abc",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("test@example.com");
    expect(callArgs.subject).toBe("Reset your GroundPulse password");
    expect(callArgs.react).toBeDefined();
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const { auth } = await import("@/lib/auth");
    const config = auth.options as Record<string, unknown>;
    const emailAndPassword = config.emailAndPassword as Record<string, unknown>;
    const sendResetPassword = emailAndPassword.sendResetPassword as (
      args: { user: { email: string; name: string }; url: string }
    ) => Promise<void>;

    await expect(
      sendResetPassword({
        user: { email: "test@example.com", name: "Test User" },
        url: "https://example.com/reset?token=abc",
      })
    ).rejects.toThrow("Email service not configured");
  });
});
