import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "fs";
import path from "path";

// Mock next/link with simple <a> tag
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock auth to return null session (unauthenticated visitor)
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock db (not needed for unauthenticated path, but imported by page)
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      companyProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// Mock lucide-react icons used by the landing page
vi.mock("lucide-react", () => ({
  ArrowRight: (props: Record<string, unknown>) => <span {...props} />,
  Zap: (props: Record<string, unknown>) => <span {...props} />,
  MapPin: (props: Record<string, unknown>) => <span {...props} />,
  Clock: (props: Record<string, unknown>) => <span {...props} />,
  Shield: (props: Record<string, unknown>) => <span {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <span {...props} />,
  Flame: (props: Record<string, unknown>) => <span {...props} />,
  Sun: (props: Record<string, unknown>) => <span {...props} />,
  Home: (props: Record<string, unknown>) => <span {...props} />,
  Cable: (props: Record<string, unknown>) => <span {...props} />,
  Database: (props: Record<string, unknown>) => <span {...props} />,
  Filter: (props: Record<string, unknown>) => <span {...props} />,
  Bell: (props: Record<string, unknown>) => <span {...props} />,
  BarChart3: (props: Record<string, unknown>) => <span {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span {...props} />,
  Star: (props: Record<string, unknown>) => <span {...props} />,
  Building2: (props: Record<string, unknown>) => <span {...props} />,
  Truck: (props: Record<string, unknown>) => <span {...props} />,
  Search: (props: Record<string, unknown>) => <span {...props} />,
  Mail: (props: Record<string, unknown>) => <span {...props} />,
}));

// Mock @base-ui/react/merge-props for Badge component
vi.mock("@base-ui/react/merge-props", () => ({
  mergeProps: (...propSets: Record<string, unknown>[]) =>
    Object.assign({}, ...propSets),
}));

// Mock @base-ui/react/use-render for Badge component
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

import Home from "@/app/page";

describe("landing-page regression (bug fix #9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders hero content with main heading for unauthenticated visitors", async () => {
    const page = await Home();
    render(page);

    expect(
      screen.getByText(/your next job is already/i)
    ).toBeInTheDocument();
  });

  it("renders sign-in and sign-up CTA links as <a> tags (not nested Link/Button)", async () => {
    const page = await Home();
    render(page);

    // The header should have Sign In link
    const signInLinks = screen.getAllByText(/sign in/i);
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);

    // Check that sign-in links are <a> tags with correct href
    const signInLink = signInLinks[0].closest("a");
    expect(signInLink).toHaveAttribute("href", "/sign-in");

    // Check sign-up links (now "Start Free Trial" or "Start 7-Day Free Trial")
    const startTrialLinks = screen.getAllByText(/start.*free trial/i);
    expect(startTrialLinks.length).toBeGreaterThanOrEqual(1);
    const startTrialLink = startTrialLinks[0].closest("a");
    expect(startTrialLink).toHaveAttribute("href", "/sign-up");
  });

  it("does not nest <a> inside <a> (no Link/Button nesting)", () => {
    // Structural test: verify the source code does not contain <Link><Button> nesting
    const pageSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/page.tsx"),
      "utf-8"
    );

    // The bug was <Link><Button>...</Button></Link> which creates <a><button><a>
    // After fix, buttons use className-based styling on <Link> directly
    const linkButtonPattern = /<Link[^>]*>\s*<Button/g;
    expect(pageSource.match(linkButtonPattern)).toBeNull();
  });

  it("renders industry showcase sections", async () => {
    const page = await Home();
    render(page);

    expect(screen.getByText("Heavy Equipment")).toBeInTheDocument();
    expect(screen.getByText("Roofing")).toBeInTheDocument();
    expect(screen.getByText("HVAC")).toBeInTheDocument();
    expect(screen.getByText("Solar")).toBeInTheDocument();
    expect(screen.getByText("Electrical")).toBeInTheDocument();
  });

  it("renders the GroundPulse brand name", async () => {
    const page = await Home();
    render(page);

    const brandElements = screen.getAllByText("GroundPulse");
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders how-it-works and feature sections", async () => {
    const page = await Home();
    render(page);

    // How it works section
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("We scrape the sources")).toBeInTheDocument();
    expect(screen.getByText("We score for your trade")).toBeInTheDocument();
    expect(screen.getByText("You show up first")).toBeInTheDocument();

    // Feature cards
    expect(screen.getByText("5-Dimension Scoring")).toBeInTheDocument();
    expect(screen.getByText("Storm Alerts")).toBeInTheDocument();
    expect(screen.getByText("Daily Email Digest")).toBeInTheDocument();
  });
});
