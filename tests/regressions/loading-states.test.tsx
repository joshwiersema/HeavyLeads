import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Mock next/link (used by some card components)
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import DashboardLoading from "@/app/(dashboard)/dashboard/loading";
import BookmarksLoading from "@/app/(dashboard)/dashboard/bookmarks/loading";
import LeadDetailLoading from "@/app/(dashboard)/dashboard/leads/[id]/loading";

describe("loading-states regression (bug fix #13)", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Dashboard loading (src/app/(dashboard)/dashboard/loading.tsx)", () => {
    it("renders Skeleton placeholder elements with animate-pulse", () => {
      const { container } = render(<DashboardLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders multiple skeleton elements for the layout", () => {
      const { container } = render(<DashboardLoading />);

      // Should have skeletons for the heading area plus lead card skeletons
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      // At minimum: 2 heading skeletons + skeletons from LeadCardSkeleton
      expect(skeletons.length).toBeGreaterThanOrEqual(4);
    });

    it("skeleton elements have animate-pulse class for visual feedback", () => {
      const { container } = render(<DashboardLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      // Every skeleton should have the animate-pulse class
      skeletons.forEach((skeleton) => {
        expect(skeleton.className).toContain("animate-pulse");
      });
    });
  });

  describe("Bookmarks loading (src/app/(dashboard)/dashboard/bookmarks/loading.tsx)", () => {
    it("renders Skeleton placeholder elements", () => {
      const { container } = render(<BookmarksLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("skeleton elements have animate-pulse class", () => {
      const { container } = render(<BookmarksLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      skeletons.forEach((skeleton) => {
        expect(skeleton.className).toContain("animate-pulse");
      });
    });
  });

  describe("Lead detail loading (src/app/(dashboard)/dashboard/leads/[id]/loading.tsx)", () => {
    it("renders Skeleton placeholder elements", () => {
      const { container } = render(<LeadDetailLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders skeletons within a Card layout", () => {
      const { container } = render(<LeadDetailLoading />);

      // Should have card elements
      const cards = container.querySelectorAll('[data-slot="card"]');
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    it("skeleton elements have animate-pulse class", () => {
      const { container } = render(<LeadDetailLoading />);

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      skeletons.forEach((skeleton) => {
        expect(skeleton.className).toContain("animate-pulse");
      });
    });
  });
});
