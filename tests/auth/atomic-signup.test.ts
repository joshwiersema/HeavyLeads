import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted for mock functions
const {
  mockSignUpEmail,
  mockCreateOrganization,
  mockSetActiveOrganization,
  mockDbDelete,
  mockWhere,
} = vi.hoisted(() => ({
  mockSignUpEmail: vi.fn(),
  mockCreateOrganization: vi.fn(),
  mockSetActiveOrganization: vi.fn(),
  mockDbDelete: vi.fn(),
  mockWhere: vi.fn(),
}));

// Mock auth module to avoid DB connections
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail: mockSignUpEmail,
      createOrganization: mockCreateOrganization,
      setActiveOrganization: mockSetActiveOrganization,
    },
  },
}));

// Mock db module
vi.mock("@/lib/db", () => ({
  db: {
    delete: mockDbDelete,
  },
}));

// Mock drizzle-orm eq function
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

// Mock schema tables
vi.mock("@/lib/db/schema/auth", () => ({
  organization: { id: "org_id_col" },
  user: { id: "user_id_col" },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe("atomicSignUp server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
  });

  it("returns { success: true, redirectTo } when all 3 steps succeed", async () => {
    mockSignUpEmail.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockCreateOrganization.mockResolvedValue({
      id: "org-1",
    });
    mockSetActiveOrganization.mockResolvedValue({});

    const { atomicSignUp } = await import("@/actions/signup");
    const result = await atomicSignUp({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(true);
    expect(result.redirectTo).toBe("/onboarding");
    expect(mockSignUpEmail).toHaveBeenCalledOnce();
    expect(mockCreateOrganization).toHaveBeenCalledOnce();
    expect(mockSetActiveOrganization).toHaveBeenCalledOnce();
  });

  it("cleans up user if org creation fails", async () => {
    mockSignUpEmail.mockResolvedValue({
      user: { id: "user-cleanup" },
    });
    mockCreateOrganization.mockRejectedValue(new Error("Org creation failed"));

    const { atomicSignUp } = await import("@/actions/signup");
    const result = await atomicSignUp({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
    // Should have tried to clean up the user
    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("cleans up user and org if setActive fails", async () => {
    mockSignUpEmail.mockResolvedValue({
      user: { id: "user-cleanup-2" },
    });
    mockCreateOrganization.mockResolvedValue({
      id: "org-cleanup-2",
    });
    mockSetActiveOrganization.mockRejectedValue(
      new Error("SetActive failed")
    );

    const { atomicSignUp } = await import("@/actions/signup");
    const result = await atomicSignUp({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
    // Should have tried to clean up both org and user (2 delete calls)
    expect(mockDbDelete).toHaveBeenCalledTimes(2);
  });

  it("returns specific error message for email-in-use", async () => {
    mockSignUpEmail.mockRejectedValue(
      new Error("User with this email already exists")
    );

    const { atomicSignUp } = await import("@/actions/signup");
    const result = await atomicSignUp({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("email already exists");
  });

  it("returns specific error message for org-name-taken", async () => {
    mockSignUpEmail.mockResolvedValue({
      user: { id: "user-slug" },
    });
    mockCreateOrganization.mockRejectedValue(
      new Error("UNIQUE constraint failed: slug taken")
    );

    const { atomicSignUp } = await import("@/actions/signup");
    const result = await atomicSignUp({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("company name is already taken");
  });
});
