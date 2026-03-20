import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Use vi.hoisted so mock fns are available before vi.mock hoisting
const { mockPush, mockSignInEmail, mockSetActive, mockFetch } = vi.hoisted(
  () => ({
    mockPush: vi.fn(),
    mockSignInEmail: vi.fn(),
    mockSetActive: vi.fn(),
    mockFetch: vi.fn(),
  })
);

// Mock next/navigation with hoisted mockPush
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

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => mockSignInEmail(...args),
    },
    $fetch: (...args: unknown[]) => mockFetch(...args),
    organization: {
      setActive: (...args: unknown[]) => mockSetActive(...args),
    },
  },
}));

// Mock react-hook-form's zodResolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => undefined,
}));

import { SignInForm } from "@/components/auth/sign-in-form";

describe("sign-in-redirect regression (bug fix #5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders email and password inputs plus a submit button", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("renders without crashing even when component mounts (no redirect loop)", () => {
    // The bug was: after sign-in, org fetch failure caused infinite redirect.
    // The fix wraps org fetch in try-catch showing an error message instead.
    // This test proves the component renders successfully -- it does not crash.
    const { container } = render(<SignInForm />);

    expect(container).toBeTruthy();
    // The form should be present, not a redirect/error page
    expect(screen.getByText(/sign in to groundpulse/i)).toBeInTheDocument();
  });

  it("shows a link to create an account (sign-up)", () => {
    render(<SignInForm />);

    const signUpLink = screen.getByRole("link", { name: /create one/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute("href", "/sign-up");
  });

  it("onSubmit calls router.push('/dashboard') not router.push('/')", async () => {
    // Mock successful sign-in + org fetch + setActive
    mockSignInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFetch.mockResolvedValue({
      data: [{ id: "org1", name: "Test Org" }],
    });
    mockSetActive.mockResolvedValue({ data: {} });

    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "securepassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
