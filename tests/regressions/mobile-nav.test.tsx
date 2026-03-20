import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock next/link with simple <a> tag
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock lucide-react icons to simple spans
vi.mock("lucide-react", () => ({
  LayoutDashboard: (props: Record<string, unknown>) => (
    <span data-testid="icon-dashboard" {...props} />
  ),
  Bookmark: (props: Record<string, unknown>) => (
    <span data-testid="icon-bookmark" {...props} />
  ),
  Search: (props: Record<string, unknown>) => (
    <span data-testid="icon-search" {...props} />
  ),
  Settings: (props: Record<string, unknown>) => (
    <span data-testid="icon-settings" {...props} />
  ),
  Menu: (props: Record<string, unknown>) => (
    <span data-testid="icon-menu" {...props} />
  ),
  X: (props: Record<string, unknown>) => (
    <span data-testid="icon-close" {...props} />
  ),
}));

// Mock SignOutButton since it uses authClient
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button>Sign Out</button>,
}));

// Mock @base-ui/react/separator to avoid jsdom issues
vi.mock("@base-ui/react/separator", () => ({
  Separator: (props: Record<string, unknown>) => <hr {...props} />,
}));

import { MobileNav } from "@/components/dashboard/mobile-nav";

describe("mobile-nav regression (bug fix #8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders navigation link text for all main sections", () => {
    render(<MobileNav userName="Test User" />);

    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
    expect(screen.getByText("Saved Searches")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders a menu toggle button (open trigger)", () => {
    render(<MobileNav userName="Test User" />);

    const openButton = screen.getByRole("button", {
      name: /open navigation menu/i,
    });
    expect(openButton).toBeInTheDocument();
  });

  it("renders a close button inside the drawer", () => {
    render(<MobileNav userName="Test User" />);

    const closeButton = screen.getByRole("button", {
      name: /close navigation menu/i,
    });
    expect(closeButton).toBeInTheDocument();
  });

  it("navigation links have correct href attributes", () => {
    render(<MobileNav userName="Test User" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink).toHaveAttribute("href", "/dashboard");

    const bookmarksLink = screen.getByText("Bookmarks").closest("a");
    expect(bookmarksLink).toHaveAttribute("href", "/dashboard/bookmarks");

    const savedSearchesLink = screen.getByText("Saved Searches").closest("a");
    expect(savedSearchesLink).toHaveAttribute(
      "href",
      "/dashboard/saved-searches"
    );

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("renders the GroundPulse brand link", () => {
    render(<MobileNav userName="Test User" />);

    const brandLink = screen.getByText("GroundPulse");
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("displays user name when provided", () => {
    render(<MobileNav userName="John Smith" />);

    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });
});
