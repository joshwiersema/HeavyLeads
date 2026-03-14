import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createMockLead } from "../helpers/leads";
import type { EnrichedLead } from "@/lib/leads/types";

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
}));

// Build enriched lead test fixtures
function createEnrichedLead(overrides?: Partial<EnrichedLead>): EnrichedLead {
  const base = createMockLead();
  return {
    ...base,
    distance: 12.5,
    inferredEquipment: [
      { type: "Excavators", confidence: "high" as const, reason: "keyword match" },
      { type: "Bulldozers", confidence: "medium" as const, reason: "keyword match" },
    ],
    score: 78,
    freshness: "New" as const,
    timeline: [
      {
        phase: "Site Preparation",
        equipment: ["Excavators"],
        urgency: "Now" as const,
        description: "Excavation and grading needed",
      },
    ],
    ...overrides,
  } as EnrichedLead;
}

describe("LeadCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders lead address", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead();

    render(<LeadCard lead={lead} />);

    expect(
      screen.getByText(lead.formattedAddress as string)
    ).toBeInTheDocument();
  });

  it("renders freshness badge", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead({ freshness: "This Week" });

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("This Week")).toBeInTheDocument();
  });

  it("renders score value", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead({ score: 85 });

    render(<LeadCard lead={lead} />);

    expect(screen.getByTestId("lead-score")).toHaveTextContent("85");
  });

  it("renders equipment type badges", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead();

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("Excavators")).toBeInTheDocument();
    expect(screen.getByText("Bulldozers")).toBeInTheDocument();
  });

  it("renders distance", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead({ distance: 42.7 });

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("43 mi away")).toBeInTheDocument();
  });

  it("truncates equipment tags at 4 and shows overflow count", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead({
      inferredEquipment: [
        { type: "Excavators", confidence: "high", reason: "test" },
        { type: "Bulldozers", confidence: "high", reason: "test" },
        { type: "Cranes", confidence: "medium", reason: "test" },
        { type: "Forklifts", confidence: "medium", reason: "test" },
        { type: "Boom Lifts", confidence: "low", reason: "test" },
        { type: "Generators", confidence: "low", reason: "test" },
      ],
    });

    render(<LeadCard lead={lead} />);

    expect(screen.getByText("Excavators")).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(screen.queryByText("Boom Lifts")).not.toBeInTheDocument();
  });

  it("links to lead detail page", async () => {
    const { LeadCard } = await import(
      "@/app/(dashboard)/dashboard/lead-card"
    );
    const lead = createEnrichedLead();

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
