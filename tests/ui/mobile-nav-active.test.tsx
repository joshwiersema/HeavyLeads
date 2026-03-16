import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mutable pathname ref using vi.hoisted
const { mockPathname } = vi.hoisted(() => ({
  mockPathname: { current: "/dashboard" },
}));

// Mock next/link as simple <a> tag
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

// Mock next/navigation with mutable pathname
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

// Mock lucide-react icons as simple spans
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

// Mock SignOutButton
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button>Sign Out</button>,
}));

// Mock @base-ui/react/separator
vi.mock("@base-ui/react/separator", () => ({
  Separator: (props: Record<string, unknown>) => <hr {...props} />,
}));

import { MobileNav } from "@/components/dashboard/mobile-nav";

describe("MobileNav active state", () => {
  afterEach(() => {
    cleanup();
  });

  it("highlights Leads when pathname is /dashboard", () => {
    mockPathname.current = "/dashboard";
    render(<MobileNav userName="Test User" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(true);

    const bookmarksLink = screen.getByText("Bookmarks").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights Leads for nested route /dashboard/leads/abc123 (bug fix)", () => {
    mockPathname.current = "/dashboard/leads/abc123";
    render(<MobileNav userName="Test User" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(true);

    const bookmarksLink = screen.getByText("Bookmarks").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights only Bookmarks when pathname is /dashboard/bookmarks", () => {
    mockPathname.current = "/dashboard/bookmarks";
    render(<MobileNav userName="Test User" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);

    const bookmarksLink = screen.getByText("Bookmarks").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(true);
  });

  it("highlights Settings for sub-route /settings/company", () => {
    mockPathname.current = "/settings/company";
    render(<MobileNav userName="Test User" />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.classList.contains("bg-accent")).toBe(true);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);
  });
});
