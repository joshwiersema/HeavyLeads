import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createMockLead } from "../helpers/leads";
import type { ScoredLead } from "@/lib/leads/types";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons to simple spans
vi.mock("lucide-react", () => ({
  MapPin: (props: Record<string, unknown>) => <span data-testid="icon-map-pin" {...props} />,
  Calendar: (props: Record<string, unknown>) => <span data-testid="icon-calendar" {...props} />,
  User: (props: Record<string, unknown>) => <span data-testid="icon-user" {...props} />,
  CheckIcon: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  Bookmark: (props: Record<string, unknown>) => <span data-testid="icon-bookmark" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
  Gavel: (props: Record<string, unknown>) => <span data-testid="icon-gavel" {...props} />,
  Newspaper: (props: Record<string, unknown>) => <span data-testid="icon-newspaper" {...props} />,
  CloudLightning: (props: Record<string, unknown>) => <span data-testid="icon-cloud-lightning" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="icon-alert-triangle" {...props} />,
  DollarSign: (props: Record<string, unknown>) => <span data-testid="icon-dollar-sign" {...props} />,
}));

// Build scored lead test fixtures
function createScoredLead(overrides?: Partial<ScoredLead>): ScoredLead {
  const base = createMockLead();
  return {
    ...base,
    distance: 12.5,
    scoring: {
      total: 78,
      dimensions: [],
      matchReasons: ["Within service area", "Matches specialization"],
    },
    freshness: "New" as const,
    ...overrides,
  } as ScoredLead;
}

describe("LeadCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders lead title", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead();

    render(<LeadCard lead={lead} />);

    // LeadCard uses title ?? formattedAddress ?? address ?? "Untitled Lead"
    const displayTitle = lead.title ?? lead.formattedAddress ?? lead.address ?? "Untitled Lead";
    expect(screen.getByText(displayTitle)).toBeInTheDocument();
  });

  it("renders freshness badge", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead({ freshness: "This Week" });

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("This Week")).toBeInTheDocument();
  });

  it("renders score value from scoring.total", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead({
      scoring: { total: 85, dimensions: [], matchReasons: [] },
    });

    render(<LeadCard lead={lead} />);

    expect(screen.getByTestId("lead-score")).toHaveTextContent("85");
  });

  it("renders match reasons", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead({
      scoring: {
        total: 78,
        dimensions: [],
        matchReasons: ["Within service area", "Matches specialization"],
      },
    });

    render(<LeadCard lead={lead} />);

    expect(
      screen.getByText("Within service area, Matches specialization")
    ).toBeInTheDocument();
  });

  it("renders distance", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead({ distance: 42.7 });

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("43 mi")).toBeInTheDocument();
  });

  it("renders source type badge", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead();
    // Default source type from createMockLead is "permit"

    render(<LeadCard lead={lead} />);

    expect(screen.getAllByText("Permit").length).toBeGreaterThan(0);
  });

  it("links to lead detail page", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createScoredLead();

    render(<LeadCard lead={lead} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/dashboard/leads/${lead.id}`);
  });
});

describe("LeadCardSkeleton", () => {
  it("renders without errors", async () => {
    const { LeadCardSkeleton } = await import(
      "@/app/(dashboard)/dashboard/lead-card-skeleton"
    );

    const { container } = render(<LeadCardSkeleton />);

    // Should render 3 skeleton cards
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
