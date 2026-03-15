import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
}));

import { PipelineProgress } from "@/components/dashboard/pipeline-progress";

describe("PipelineProgress", () => {
  it("renders spinner and progress message", () => {
    render(<PipelineProgress />);

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it('renders "Searching for leads" text', () => {
    render(<PipelineProgress />);

    const matches = screen.getAllByText(/searching for leads in your area/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toBeInTheDocument();
  });
});
