import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock auth client
const mockRequestPasswordReset = vi
  .fn()
  .mockResolvedValue({ data: { status: true }, error: null });

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: mockRequestPasswordReset,
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    cleanup();
    mockRequestPasswordReset.mockClear();
  });

  it("renders email input and submit button", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("shows validation error for empty email submission", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(
      screen.getByRole("button", { name: /send reset link/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(
      screen.getByRole("button", { name: /send reset link/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });
  });

  it("shows generic success message after valid submission", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: /send reset link/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists/i)
      ).toBeInTheDocument();
    });
  });

  it("disables submit button during loading", async () => {
    // Make the request hang to test loading state
    mockRequestPasswordReset.mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: /send reset link/i })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sending/i })
      ).toBeDisabled();
    });
  });
});
