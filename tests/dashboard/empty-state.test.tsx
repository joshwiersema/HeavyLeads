import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
  RefreshCw: (props: Record<string, unknown>) => (
    <span data-testid="refresh-icon" {...props} />
  ),
  Search: (props: Record<string, unknown>) => (
    <span data-testid="search-icon" {...props} />
  ),
  Clock: (props: Record<string, unknown>) => (
    <span data-testid="clock-icon" {...props} />
  ),
  Sparkles: (props: Record<string, unknown>) => (
    <span data-testid="sparkles-icon" {...props} />
  ),
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

// Mock the RefreshLeadsButton since it's a client component
vi.mock("@/components/dashboard/refresh-leads-button", () => ({
  RefreshLeadsButton: () => (
    <button data-testid="refresh-leads-button">Refresh Leads</button>
  ),
}));

import { DashboardEmptyState } from "@/components/dashboard/empty-state";

describe("DashboardEmptyState", () => {
  it('renders "Finding leads" message when pipelineRunning=true', () => {
    render(
      <DashboardEmptyState
        pipelineRunning={true}
        hasEverHadLeads={false}
        hasFilters={false}
      />
    );

    expect(screen.getByText(/finding leads/i)).toBeInTheDocument();
  });

  it('renders "Welcome" message when hasEverHadLeads=false and not running', () => {
    render(
      <DashboardEmptyState
        pipelineRunning={false}
        hasEverHadLeads={false}
        hasFilters={false}
      />
    );

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it('renders "No leads match" when hasFilters=true', () => {
    render(
      <DashboardEmptyState
        pipelineRunning={false}
        hasEverHadLeads={true}
        hasFilters={true}
      />
    );

    expect(screen.getByText(/no leads match/i)).toBeInTheDocument();
  });

  it('renders "No leads available" as default fallback', () => {
    render(
      <DashboardEmptyState
        pipelineRunning={false}
        hasEverHadLeads={true}
        hasFilters={false}
      />
    );

    expect(screen.getByText(/no leads available/i)).toBeInTheDocument();
  });
});
