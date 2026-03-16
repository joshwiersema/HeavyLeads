import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Use vi.hoisted to ensure mock functions are available before vi.mock hoisting
const { mockResetPassword, mockUseSearchParams } = vi.hoisted(() => ({
  mockResetPassword: vi.fn().mockResolvedValue({
    data: {},
    error: null,
  }),
  mockUseSearchParams: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: mockResetPassword,
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mockUseSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

describe("ResetPasswordForm", () => {
  afterEach(() => {
    cleanup();
    mockResetPassword.mockClear();
    mockUseSearchParams.mockReset();
  });

  describe("Error states", () => {
    it("shows error state when error=INVALID_TOKEN search param is present", () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("error=INVALID_TOKEN")
      );
      render(<ResetPasswordForm />);

      expect(
        screen.getByText(/this reset link has expired or is invalid/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/request a new reset link/i)
      ).toBeInTheDocument();

      const link = screen.getByRole("link", {
        name: /request a new reset link/i,
      });
      expect(link).toHaveAttribute("href", "/forgot-password");
    });

    it("shows error state when no token and no error search params are present", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
      render(<ResetPasswordForm />);

      expect(
        screen.getByText(/this reset link has expired or is invalid/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /request a new reset link/i })
      ).toHaveAttribute("href", "/forgot-password");
    });
  });

  describe("Form rendering", () => {
    it("renders password and confirm password inputs when valid token is present", () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=valid-test-token")
      );
      render(<ResetPasswordForm />);

      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/confirm new password/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset password/i })
      ).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows validation error for passwords under 8 characters", async () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=valid-test-token")
      );
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await user.type(screen.getByLabelText(/new password/i), "short");
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "short"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 8 characters/i)
        ).toBeInTheDocument();
      });
    });

    it("shows validation error when passwords don't match", async () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=valid-test-token")
      );
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await user.type(
        screen.getByLabelText(/new password/i),
        "validpassword123"
      );
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "differentpassword"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/passwords do not match/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Submission", () => {
    it("calls authClient.resetPassword with { newPassword, token } on valid submission", async () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=test-reset-token")
      );
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await user.type(
        screen.getByLabelText(/new password/i),
        "newpassword123"
      );
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "newpassword123"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith({
          newPassword: "newpassword123",
          token: "test-reset-token",
        });
      });
    });

    it("shows success message and link to sign-in after successful reset", async () => {
      mockResetPassword.mockResolvedValue({ data: {}, error: null });
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=test-reset-token")
      );
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await user.type(
        screen.getByLabelText(/new password/i),
        "newpassword123"
      );
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "newpassword123"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/your password has been reset successfully/i)
        ).toBeInTheDocument();
      });

      const signInLink = screen.getByRole("link", {
        name: /sign in with your new password/i,
      });
      expect(signInLink).toHaveAttribute("href", "/sign-in");
    });

    it("shows error message when resetPassword returns an error", async () => {
      mockResetPassword.mockResolvedValue({
        data: null,
        error: { message: "Token has expired" },
      });
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("token=expired-token")
      );
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await user.type(
        screen.getByLabelText(/new password/i),
        "newpassword123"
      );
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "newpassword123"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeInTheDocument();
      });
    });
  });
});
