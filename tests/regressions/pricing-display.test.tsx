import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock authClient for SubscribeButton dependency
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    subscription: {
      upgrade: vi.fn(),
    },
  },
}));

// Mock ensureStripeCustomer server action
vi.mock("@/actions/billing", () => ({
  ensureStripeCustomer: vi.fn().mockResolvedValue({ customerId: "cus_test" }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Check: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="icon-loader" {...props} />
  ),
}));

// Mock @base-ui/react dependencies for Badge and Button
vi.mock("@base-ui/react/merge-props", () => ({
  mergeProps: (...propSets: Record<string, unknown>[]) =>
    Object.assign({}, ...propSets),
}));

vi.mock("@base-ui/react/use-render", () => ({
  useRender: ({
    props,
    defaultTagName,
  }: {
    props: Record<string, unknown>;
    defaultTagName: string;
  }) => {
    const Tag = defaultTagName as unknown as React.ElementType;
    return <Tag {...props} />;
  },
}));

import { PlanSelector } from "@/components/billing/plan-selector";

describe("pricing-display regression (bug fix #10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("displays monthlyPrice value when provided", () => {
    render(
      <PlanSelector
        organizationId="org-123"
        monthlyPrice="$99"
        setupFee="$499"
      />
    );

    expect(screen.getByText("$99/mo")).toBeInTheDocument();
  });

  it("displays setupFee value when provided", () => {
    render(
      <PlanSelector
        organizationId="org-123"
        monthlyPrice="$99"
        setupFee="$499"
      />
    );

    expect(screen.getByText("$499 one-time setup fee")).toBeInTheDocument();
  });

  it("displays fallback text when monthlyPrice is missing", () => {
    render(<PlanSelector organizationId="org-123" />);

    expect(screen.getByText("Standard Plan")).toBeInTheDocument();
  });

  it("displays fallback text when setupFee is missing", () => {
    render(<PlanSelector organizationId="org-123" />);

    expect(
      screen.getByText("Monthly subscription + one-time setup fee")
    ).toBeInTheDocument();
  });

  it("renders both free trial and subscribe options", () => {
    render(
      <PlanSelector
        organizationId="org-123"
        monthlyPrice="$99"
        setupFee="$499"
      />
    );

    expect(screen.getByText("Free Trial")).toBeInTheDocument();
    // "Subscribe Now" appears as both a card title and button text
    const subscribeElements = screen.getAllByText("Subscribe Now");
    expect(subscribeElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders feature list items", () => {
    render(
      <PlanSelector
        organizationId="org-123"
        monthlyPrice="$99"
        setupFee="$499"
      />
    );

    // Features are rendered in both cards
    const feedItems = screen.getAllByText(
      "Daily lead feed from multiple sources"
    );
    expect(feedItems.length).toBeGreaterThanOrEqual(1);
  });
});
