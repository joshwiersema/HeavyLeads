import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import RootError from "@/app/error";
import DashboardError from "@/app/(dashboard)/error";

describe("error-boundaries regression (bug fix #11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Root error boundary (src/app/error.tsx)", () => {
    it("renders 'Something went wrong' text", () => {
      const mockError = new Error("Test error") as Error & { digest?: string };
      const mockReset = vi.fn();

      render(<RootError error={mockError} reset={mockReset} />);

      expect(
        screen.getByText("Something went wrong")
      ).toBeInTheDocument();
    });

    it("renders a 'Try again' button", () => {
      const mockError = new Error("Test error") as Error & { digest?: string };
      const mockReset = vi.fn();

      render(<RootError error={mockError} reset={mockReset} />);

      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });

    it("calls reset() when 'Try again' is clicked", () => {
      const mockError = new Error("Test error") as Error & { digest?: string };
      const mockReset = vi.fn();

      render(<RootError error={mockError} reset={mockReset} />);

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("renders error description text", () => {
      const mockError = new Error("Test error") as Error & { digest?: string };
      const mockReset = vi.fn();

      render(<RootError error={mockError} reset={mockReset} />);

      expect(
        screen.getByText(/unexpected error occurred/i)
      ).toBeInTheDocument();
    });
  });

  describe("Dashboard error boundary (src/app/(dashboard)/error.tsx)", () => {
    it("renders 'Something went wrong' text", () => {
      const mockError = new Error("Dashboard error") as Error & {
        digest?: string;
      };
      const mockReset = vi.fn();

      render(<DashboardError error={mockError} reset={mockReset} />);

      expect(
        screen.getByText("Something went wrong")
      ).toBeInTheDocument();
    });

    it("renders a 'Try again' button", () => {
      const mockError = new Error("Dashboard error") as Error & {
        digest?: string;
      };
      const mockReset = vi.fn();

      render(<DashboardError error={mockError} reset={mockReset} />);

      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });

    it("calls reset() when 'Try again' is clicked", () => {
      const mockError = new Error("Dashboard error") as Error & {
        digest?: string;
      };
      const mockReset = vi.fn();

      render(<DashboardError error={mockError} reset={mockReset} />);

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("renders dashboard-specific error description", () => {
      const mockError = new Error("Dashboard error") as Error & {
        digest?: string;
      };
      const mockReset = vi.fn();

      render(<DashboardError error={mockError} reset={mockReset} />);

      expect(
        screen.getByText(/error loading this page/i)
      ).toBeInTheDocument();
    });
  });
});
