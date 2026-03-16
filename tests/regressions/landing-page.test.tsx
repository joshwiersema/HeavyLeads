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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Search: (props: Record<string, unknown>) => <span {...props} />,
  Zap: (props: Record<string, unknown>) => <span {...props} />,
  BarChart3: (props: Record<string, unknown>) => <span {...props} />,
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
      screen.getByText(/find construction leads before your competitors/i)
    ).toBeInTheDocument();
  });

  it("renders sign-in and sign-up CTA links as <a> tags (not nested Link/Button)", async () => {
    const page = await Home();
    render(page);

    // The header should have Sign In and Get Started links
    const signInLinks = screen.getAllByText(/sign in/i);
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);

    // Check that sign-in links are <a> tags with correct href
    const signInLink = signInLinks[0].closest("a");
    expect(signInLink).toHaveAttribute("href", "/sign-in");

    // Check sign-up links
    const getStartedLinks = screen.getAllByText(/get started/i);
    expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
    const getStartedLink = getStartedLinks[0].closest("a");
    expect(getStartedLink).toHaveAttribute("href", "/sign-up");
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

  it("renders marketing feature cards", async () => {
    const page = await Home();
    render(page);

    expect(screen.getByText("Daily Lead Feed")).toBeInTheDocument();
    expect(
      screen.getByText("Multi-Source Intelligence")
    ).toBeInTheDocument();
    expect(screen.getByText("Equipment Matching")).toBeInTheDocument();
    expect(screen.getByText("Email Digests")).toBeInTheDocument();
  });

  it("renders the HeavyLeads brand name", async () => {
    const page = await Home();
    render(page);

    expect(screen.getByText("HeavyLeads")).toBeInTheDocument();
  });
});
