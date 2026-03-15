import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TrialBanner } from "@/components/billing/trial-banner";

afterEach(() => {
  cleanup();
});

describe("TrialBanner", () => {
  it("renders banner with plural days when daysRemaining > 1", () => {
    render(<TrialBanner daysRemaining={5} />);
    expect(screen.getByText("5 days left in your trial")).toBeInTheDocument();
  });

  it("renders banner with singular day when daysRemaining is 1", () => {
    render(<TrialBanner daysRemaining={1} />);
    expect(screen.getByText("1 day left in your trial")).toBeInTheDocument();
  });

  it("renders banner with 'ends today' when daysRemaining is 0", () => {
    render(<TrialBanner daysRemaining={0} />);
    expect(screen.getByText("Your trial ends today")).toBeInTheDocument();
  });

  it("renders banner with 7 days remaining", () => {
    render(<TrialBanner daysRemaining={7} />);
    expect(screen.getByText("7 days left in your trial")).toBeInTheDocument();
  });

  it("includes a link to billing page", () => {
    render(<TrialBanner daysRemaining={3} />);
    const link = screen.getByRole("link", { name: /subscribe|view plans/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("uses Clock icon", () => {
    render(<TrialBanner daysRemaining={3} />);
    // lucide-react renders SVGs with data-testid or class; check for the svg element
    const banner = screen.getByTestId("trial-banner");
    expect(banner.querySelector("svg")).toBeInTheDocument();
  });
});
