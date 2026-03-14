/**
 * Create a mock session object for testing tenant-scoped operations.
 * Mirrors the shape returned by auth.api.getSession().
 */
export function createMockSession(overrides: {
  userId?: string;
  activeOrganizationId?: string | null;
  role?: string;
  email?: string;
  name?: string;
} = {}) {
  const userId = overrides.userId ?? `test-user-${Date.now()}`;
  const activeOrganizationId = "activeOrganizationId" in overrides
    ? overrides.activeOrganizationId ?? null
    : `test-org-${Date.now()}`;

  return {
    user: {
      id: userId,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? "test@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: `test-session-${Date.now()}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: `test-token-${Date.now()}`,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      userId,
      activeOrganizationId,
    },
  };
}

/**
 * Create a mock session with no active organization (pre-onboarding state).
 */
export function createMockSessionNoOrg(overrides: {
  userId?: string;
  email?: string;
  name?: string;
} = {}) {
  return createMockSession({
    ...overrides,
    activeOrganizationId: null,
  });
}
