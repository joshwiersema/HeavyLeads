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
  Kanban: (props: Record<string, unknown>) => (
    <span data-testid="icon-kanban" {...props} />
  ),
  Search: (props: Record<string, unknown>) => (
    <span data-testid="icon-search" {...props} />
  ),
  Settings: (props: Record<string, unknown>) => (
    <span data-testid="icon-settings" {...props} />
  ),
}));

import { SidebarNav } from "@/components/dashboard/sidebar-nav";

describe("SidebarNav active state", () => {
  afterEach(() => {
    cleanup();
  });

  it("highlights only Leads when pathname is /dashboard", () => {
    mockPathname.current = "/dashboard";
    render(<SidebarNav industry="heavy_equipment" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(true);

    const bookmarksLink = screen.getByText("Pipeline").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(false);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights Leads for nested route /dashboard/leads/abc123", () => {
    mockPathname.current = "/dashboard/leads/abc123";
    render(<SidebarNav industry="heavy_equipment" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(true);

    const bookmarksLink = screen.getByText("Pipeline").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights only Pipeline when pathname is /dashboard/bookmarks", () => {
    mockPathname.current = "/dashboard/bookmarks";
    render(<SidebarNav industry="heavy_equipment" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);

    const bookmarksLink = screen.getByText("Pipeline").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(true);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights only Saved Searches when pathname is /dashboard/saved-searches", () => {
    mockPathname.current = "/dashboard/saved-searches";
    render(<SidebarNav industry="heavy_equipment" />);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(true);

    const bookmarksLink = screen.getByText("Pipeline").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights Settings when pathname is /settings", () => {
    mockPathname.current = "/settings";
    render(<SidebarNav industry="heavy_equipment" />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.classList.contains("bg-accent")).toBe(true);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("highlights Settings for sub-route /settings/account", () => {
    mockPathname.current = "/settings/account";
    render(<SidebarNav industry="heavy_equipment" />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.classList.contains("bg-accent")).toBe(true);

    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink?.classList.contains("bg-accent")).toBe(false);
  });

  it("non-active links do not have bg-accent class", () => {
    mockPathname.current = "/dashboard";
    render(<SidebarNav industry="heavy_equipment" />);

    const bookmarksLink = screen.getByText("Pipeline").closest("a");
    expect(bookmarksLink?.classList.contains("bg-accent")).toBe(false);
    expect(
      bookmarksLink?.classList.contains("text-accent-foreground")
    ).toBe(false);

    const savedSearchesLink = screen
      .getByText("Saved Searches")
      .closest("a");
    expect(savedSearchesLink?.classList.contains("bg-accent")).toBe(false);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.classList.contains("bg-accent")).toBe(false);
  });
});
