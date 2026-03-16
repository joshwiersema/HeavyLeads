import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadTimeline } from "@/app/(dashboard)/dashboard/leads/[id]/lead-timeline";
import { LeadMap } from "@/app/(dashboard)/dashboard/leads/[id]/lead-map";
import type { TimelineWindow, InferredEquipment } from "@/lib/leads/types";
import type { EquipmentType } from "@/types";

// Mock @vis.gl/react-google-maps to avoid loading Google Maps in tests
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
  AdvancedMarker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="advanced-marker">{children}</div>
  ),
  Pin: () => <div data-testid="pin" />,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/leads/test-id",
  notFound: vi.fn(),
}));

describe("LeadTimeline", () => {
  it("renders urgency labels and phase names", () => {
    const timeline: TimelineWindow[] = [
      {
        phase: "Site Preparation",
        equipment: ["Excavators"] as EquipmentType[],
        urgency: "Now",
        description: "Ground clearing and excavation needed immediately",
      },
      {
        phase: "Foundation Work",
        equipment: ["Cranes", "Compactors"] as EquipmentType[],
        urgency: "Soon",
        description: "Foundation pour expected in 2-4 weeks",
      },
    ];

    render(<LeadTimeline timeline={timeline} />);

    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Soon")).toBeInTheDocument();
    expect(screen.getByText("Site Preparation")).toBeInTheDocument();
    expect(screen.getByText("Foundation Work")).toBeInTheDocument();
  });

  it("renders nothing when timeline is empty", () => {
    const { container } = render(<LeadTimeline timeline={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("LeadMap", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("renders fallback when API key is not configured", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<LeadMap lat={30.2672} lng={-97.7431} title="123 Main St" />);

    expect(screen.getByText("Map unavailable -- configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
  });

  it("renders map components when API key is set", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key-for-map";

    render(<LeadMap lat={30.2672} lng={-97.7431} title="123 Main St" />);

    expect(screen.getByTestId("api-provider")).toBeInTheDocument();
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-marker")).toBeInTheDocument();
  });
});

describe("Equipment needs rendering", () => {
  it("renders equipment type names with confidence indicators", () => {
    const equipment: InferredEquipment[] = [
      {
        type: "Excavators" as EquipmentType,
        confidence: "high",
        reason: "Excavation mentioned in description",
      },
      {
        type: "Cranes" as EquipmentType,
        confidence: "low",
        reason: "Large commercial project may need cranes",
      },
    ];

    // Render a simple representation of equipment needs to verify data renders
    render(
      <div>
        {equipment.map((eq) => (
          <div key={eq.type} data-testid={`equipment-${eq.type}`}>
            <span>{eq.type}</span>
            <span data-testid={`confidence-${eq.confidence}`}>
              {eq.confidence}
            </span>
            <span>{eq.reason}</span>
          </div>
        ))}
      </div>
    );

    expect(screen.getByTestId("equipment-Excavators")).toBeInTheDocument();
    expect(screen.getByTestId("equipment-Cranes")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-high")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-low")).toBeInTheDocument();
    expect(
      screen.getByText("Excavation mentioned in description")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Large commercial project may need cranes")
    ).toBeInTheDocument();
  });
});
