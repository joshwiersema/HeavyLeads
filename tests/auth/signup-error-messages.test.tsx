import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Use vi.hoisted for mocks that need to be available before vi.mock hoisting
const { mockAtomicSignUp, mockPush } = vi.hoisted(() => ({
  mockAtomicSignUp: vi.fn(),
  mockPush: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock the server action
vi.mock("@/actions/signup", () => ({
  atomicSignUp: (...args: unknown[]) => mockAtomicSignUp(...args),
}));

// Mock zodResolver to avoid full zod resolution in test env
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => undefined,
}));

import { SignUpForm } from "@/components/auth/sign-up-form";

describe("SignUpForm error messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a confirmPassword input field", () => {
    render(<SignUpForm />);

    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    expect(confirmPasswordInput).toBeInTheDocument();
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });

  it("displays email-already-exists error from server action", async () => {
    mockAtomicSignUp.mockResolvedValue({
      success: false,
      error: "An account with this email already exists. Please sign in instead.",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    // Fill in form fields
    await user.type(screen.getByLabelText(/full name/i), "John Smith");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "securepassword");
    await user.type(screen.getByLabelText(/confirm password/i), "securepassword");
    await user.type(screen.getByLabelText(/company name/i), "Acme Equipment");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/email already exists/i)
      ).toBeInTheDocument();
    });
  });

  it("displays company-name-taken error from server action", async () => {
    mockAtomicSignUp.mockResolvedValue({
      success: false,
      error: "This company name is already taken. Please choose a different name.",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Smith");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "securepassword");
    await user.type(screen.getByLabelText(/confirm password/i), "securepassword");
    await user.type(screen.getByLabelText(/company name/i), "Acme Equipment");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/company name is already taken/i)
      ).toBeInTheDocument();
    });
  });

  it("redirects to /onboarding on successful signup", async () => {
    mockAtomicSignUp.mockResolvedValue({
      success: true,
      redirectTo: "/onboarding",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/full name/i), "John Smith");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "securepassword");
    await user.type(screen.getByLabelText(/confirm password/i), "securepassword");
    await user.type(screen.getByLabelText(/company name/i), "Acme Equipment");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });
  });
});
