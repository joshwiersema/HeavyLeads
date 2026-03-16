import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    $fetch: vi.fn().mockResolvedValue({ data: [] }),
    organization: {
      setActive: vi.fn(),
    },
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

import { SignInForm } from "@/components/auth/sign-in-form";

describe("SignInForm forgot password link", () => {
  afterEach(() => {
    cleanup();
  });

  it("contains a 'Forgot password?' link with href='/forgot-password'", () => {
    render(<SignInForm />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});
