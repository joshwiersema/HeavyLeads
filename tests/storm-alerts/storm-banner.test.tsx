import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { StormAlert } from "@/lib/storm-alerts/types";

// Mock lucide-react icons as simple span elements
vi.mock("lucide-react", () => ({
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="alert-triangle" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <span data-testid="chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <span data-testid="chevron-up" {...props} />,
}));

function createMockAlerts(count: number): StormAlert[] {
  const severities = ["Extreme", "Severe", "Moderate"];
  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${i + 1}`,
    title: `Storm Alert ${i + 1}`,
    description: `Description for storm alert ${i + 1}`,
    severity: severities[i % severities.length],
    city: "Dallas",
    state: "TX",
    lat: 32.78 + i * 0.1,
    lng: -96.8 + i * 0.1,
    expiresAt: new Date(Date.now() + (i + 1) * 3600_000),
    sourceUrl: `https://alerts.weather.gov/search?id=alert-${i + 1}`,
  }));
}

describe("StormAlertBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when alerts is empty", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const { container } = render(<StormAlertBanner alerts={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders banner with alert count when alerts present", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const alerts = createMockAlerts(3);
    render(<StormAlertBanner alerts={alerts} />);

    expect(screen.getByText(/3 active storm alert/i)).toBeDefined();
  });

  it("shows most severe alert title", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    // First alert is "Extreme" severity
    const alerts = createMockAlerts(3);
    render(<StormAlertBanner alerts={alerts} />);

    // The "Most severe:" line references the Extreme-severity alert
    const mostSevereLine = screen.getByText(/Most severe:/);
    expect(mostSevereLine.textContent).toContain("Storm Alert 1");
  });

  it("dismiss button hides the banner", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const alerts = createMockAlerts(2);
    const { container } = render(<StormAlertBanner alerts={alerts} />);

    // Banner should be visible
    expect(screen.getByText(/2 active storm alert/i)).toBeDefined();

    // Click dismiss (aria-label="Dismiss storm alerts")
    const dismissButton = screen.getByLabelText(/dismiss storm alerts/i);
    fireEvent.click(dismissButton);

    // Banner should be gone
    expect(container.innerHTML).toBe("");
  });

  it("expands to show all alerts on click", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const alerts = createMockAlerts(3);
    render(<StormAlertBanner alerts={alerts} />);

    // Click expand button (aria-label="Show details")
    const expandButton = screen.getByLabelText(/show details/i);
    fireEvent.click(expandButton);

    // All alert titles should be visible in the expanded list
    const alertItems = screen.getAllByText(/Storm Alert \d/);
    // Should show at least 3 items in expanded view (plus the "most severe" mention)
    expect(alertItems.length).toBeGreaterThanOrEqual(3);
  });

  it("shows singular form for single alert", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const alerts = createMockAlerts(1);
    render(<StormAlertBanner alerts={alerts} />);

    // Text is split across child nodes in React, so check the containing element
    const alertText = screen.getByText(/active storm alert/);
    expect(alertText.textContent).toMatch(/1\s*active storm alert\s*in your area/);
    expect(alertText.textContent).not.toMatch(/alerts/);
  });

  it("has amber theme classes", async () => {
    const { StormAlertBanner } = await import(
      "@/components/dashboard/storm-alert-banner"
    );

    const alerts = createMockAlerts(1);
    const { container } = render(<StormAlertBanner alerts={alerts} />);

    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain("bg-amber-50");
    expect(banner.className).toContain("border-amber-300");
  });
});
