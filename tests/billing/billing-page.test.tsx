import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { BillingStatus } from "@/components/billing/billing-status";
import { SubscribeButton } from "@/components/billing/subscribe-button";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";

// Mock authClient for client components
const mockUpgrade = vi.fn();
const mockBillingPortal = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    subscription: {
      upgrade: (...args: unknown[]) => mockUpgrade(...args),
      billingPortal: (...args: unknown[]) => mockBillingPortal(...args),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Use explicit noon-UTC dates to avoid timezone-boundary shifts
// (new Date("2026-04-14") is midnight UTC, which can render as April 13 in western timezones)
const TEST_PERIOD_END = new Date("2026-04-14T12:00:00Z");
const EXPECTED_DATE_TEXT = TEST_PERIOD_END.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

afterEach(() => {
  cleanup();
});

describe("BillingStatus", () => {
  it("renders subscription status when subscription exists", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "active",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: false,
        }}
      />
    );

    expect(screen.getByText("HeavyLeads Standard")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(EXPECTED_DATE_TEXT)).toBeInTheDocument();
    expect(screen.getByText("Next renewal")).toBeInTheDocument();
  });

  it("shows correct status badge for active status", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "active",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: false,
        }}
      />
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("Active");
  });

  it("shows correct status badge for trialing status", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "trialing",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: false,
        }}
      />
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("Trialing");
  });

  it("shows correct status badge for past_due status", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "past_due",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: false,
        }}
      />
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("Past Due");
    expect(
      screen.getByText(
        "Your payment failed. Please update your payment method."
      )
    ).toBeInTheDocument();
  });

  it("shows correct status badge for canceled status", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "canceled",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: false,
        }}
      />
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("Canceled");
  });

  it("shows cancellation notice when cancelAtPeriodEnd is true", () => {
    render(
      <BillingStatus
        subscription={{
          plan: "standard",
          status: "active",
          periodEnd: TEST_PERIOD_END,
          cancelAtPeriodEnd: true,
        }}
      />
    );

    expect(screen.getByText("Access until")).toBeInTheDocument();
    expect(
      screen.getByText(/will not renew/)
    ).toBeInTheDocument();
  });
});

describe("SubscribeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders subscribe button", () => {
    render(<SubscribeButton organizationId="org-123" />);
    expect(screen.getByText("Start Free Trial")).toBeInTheDocument();
  });

  it("calls authClient.subscription.upgrade on click", async () => {
    mockUpgrade.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/test" },
    });

    render(<SubscribeButton organizationId="org-123" />);
    fireEvent.click(screen.getByText("Start Free Trial"));

    await waitFor(() => {
      expect(mockUpgrade).toHaveBeenCalledWith({
        plan: "standard",
        successUrl: `${window.location.origin}/dashboard`,
        cancelUrl: `${window.location.origin}/billing`,
        referenceId: "org-123",
        customerType: "organization",
      });
    });
  });

  it("shows loading state while redirecting", async () => {
    mockUpgrade.mockReturnValue(new Promise(() => {})); // never resolves

    render(<SubscribeButton organizationId="org-123" />);
    fireEvent.click(screen.getByText("Start Free Trial"));

    await waitFor(() => {
      expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    });
  });
});

describe("ManageBillingButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manage button", () => {
    render(<ManageBillingButton />);
    expect(screen.getByText("Manage Billing")).toBeInTheDocument();
  });

  it("calls authClient.subscription.billingPortal on click", async () => {
    mockBillingPortal.mockResolvedValue({
      data: { url: "https://billing.stripe.com/test" },
    });

    render(<ManageBillingButton />);
    fireEvent.click(screen.getByText("Manage Billing"));

    await waitFor(() => {
      expect(mockBillingPortal).toHaveBeenCalledWith({
        returnUrl: `${window.location.origin}/billing`,
      });
    });
  });

  it("shows loading state while redirecting", async () => {
    mockBillingPortal.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ManageBillingButton />);
    fireEvent.click(screen.getByText("Manage Billing"));

    await waitFor(() => {
      expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    });
  });
});
