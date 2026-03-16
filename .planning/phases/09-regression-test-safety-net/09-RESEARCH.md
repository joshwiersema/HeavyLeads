# Phase 9: Regression Test Safety Net - Research

**Researched:** 2026-03-15
**Domain:** Vitest regression testing for Next.js 16 server actions and React components
**Confidence:** HIGH

## Summary

Phase 9 requires writing regression tests for 15 specific v2.0 post-rework bug fixes. The project already has a mature test infrastructure: Vitest 4.1 with jsdom, @testing-library/react, established `vi.mock()` patterns for `@/lib/db`, `@/lib/auth`, `next/headers`, and `next/cache`, plus a helper library with factories for sessions, company profiles, leads, billing, and scrapers. There are 35 passing test files with 279 passing tests across billing, dashboard, email, leads, and scraper domains.

The critical constraint is that zero production source files may be modified -- only test files and test infrastructure. The existing mock patterns are well-established and can be reused directly. There is no `npm run test` script in package.json yet; it needs to be added. Six existing tests in `pipeline.test.ts` are currently failing due to a mock that does not correctly capture `newLeadIds` -- the mock's `returning()` always yields the same ID, so the dedup function sees an empty `allNewLeadIds` array. This must be fixed as part of test infrastructure work.

**Primary recommendation:** Follow the existing `vi.mock()` patterns exactly. Group regression tests into a new `tests/regressions/` directory organized by bug fix domain (data-integrity, auth-flows, ui-components). Add `"test": "vitest run"` to package.json scripts. Fix the 6 failing pipeline tests by making the mock's `returning()` yield unique IDs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Regression test suite covers all 15 v2.0 post-rework bug fixes | Each of the 15 fixes has been traced to specific source files with testable behavior; mocking patterns for all dependencies already exist |
| TEST-02 | Test infrastructure supports mocking server actions, next/headers, and @/lib/db with established patterns | Patterns are already established in tests/billing/access-gate.test.ts, tests/scraper/cron-route.test.ts, tests/billing/auth-config.test.ts; just need to be reused |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.1.0 | Test runner and assertion library | Already installed and configured; modern, fast, native ESM |
| @testing-library/react | ^16.3.2 | React component testing | Already installed; standard for testing React components |
| @testing-library/jest-dom | ^6.9.1 | DOM assertion matchers | Already installed; extends vitest with `.toBeInTheDocument()` etc. |
| jsdom | ^28.1.0 | Browser environment simulation | Already installed; configured as vitest test environment |
| @vitejs/plugin-react | ^6.0.1 | JSX transform for tests | Already installed; enables JSX/TSX in vitest |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest vi.mock() | built-in | Module mocking | Mock `@/lib/db`, `@/lib/auth`, `next/headers`, `next/cache`, `drizzle-orm` |
| vitest vi.fn() | built-in | Function spy/stub | Create mock implementations for db queries and server action deps |

### Alternatives Considered
None -- the stack is fully established. No new dependencies are needed.

**Installation:**
No new packages needed. Only a script addition:
```json
"test": "vitest run"
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
├── helpers/          # Existing: auth.ts, billing.ts, db.ts, email.ts, leads.ts, scraper.ts
├── setup.ts          # Existing: jest-dom import + env var setup
├── smoke.test.ts     # Existing: validates test helpers
├── regressions/      # NEW: All 15 regression tests
│   ├── permit-upsert.test.ts
│   ├── geocoding-null.test.ts
│   ├── lead-query-sort.test.ts
│   ├── org-slug.test.ts
│   ├── sign-in-redirect.test.ts
│   ├── stripe-idempotency.test.ts
│   ├── onboarding-upsert.test.ts
│   ├── mobile-nav.test.tsx
│   ├── landing-page.test.tsx
│   ├── pricing-display.test.tsx
│   ├── error-boundaries.test.tsx
│   ├── date-formatting.test.ts
│   ├── loading-states.test.tsx
│   ├── equipment-types-guard.test.ts
│   └── geocoding-error-handling.test.ts
├── billing/          # Existing tests (8 files)
├── dashboard/        # Existing tests (2 files)
├── email/            # Existing tests (1 file)
├── leads/            # Existing tests (12 files)
└── scraper/          # Existing tests (12 files)
```

### Pattern 1: Server Action Testing via vi.mock()
**What:** Mock `@/lib/db`, `@/lib/auth`, `next/headers`, `next/cache` at module level, then import the server action under test
**When to use:** Testing server actions that call auth, db, or Next.js server APIs
**Example (from existing codebase):**
```typescript
// Mock db module with query interface
const mockFindFirst = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      subscription: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import after mocks
import { completeOnboarding } from "@/actions/onboarding";
```

### Pattern 2: React Component Testing via render + screen
**What:** Use @testing-library/react to render components and assert on DOM content
**When to use:** Testing UI components like mobile nav, error boundaries, loading states
**Example (from existing codebase):**
```typescript
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { render, screen } from "@testing-library/react";
import { MobileNav } from "@/components/dashboard/mobile-nav";

it("renders navigation links", () => {
  render(<MobileNav userName="Test User" />);
  expect(screen.getByText("Leads")).toBeInTheDocument();
});
```

### Pattern 3: Pure Function Unit Testing
**What:** Import and test pure functions directly without mocking
**When to use:** Testing formatDate, slugify, haversineDistance, Array.isArray guard
**Example:**
```typescript
import { formatDate, safeFormatDate } from "@/lib/utils";

it("formats dates deterministically with en-US locale", () => {
  const date = new Date("2026-03-15T12:00:00Z");
  expect(formatDate(date)).toBe("Mar 15, 2026");
});
```

### Pattern 4: Drizzle Insert Chain Mocking
**What:** Mock the chained Drizzle ORM API: `db.insert().values().onConflictDoUpdate().returning()`
**When to use:** Testing data integrity fixes (permit upsert, onboarding upsert)
**Example (from existing pipeline.test.ts):**
```typescript
vi.mock("@/lib/db", () => {
  const createInsertChain = () => {
    const valuesReturn = {
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
      }),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([{ id: "mock-lead-id-001" }]),
    };
    return {
      values: vi.fn().mockReturnValue(valuesReturn),
    };
  };
  return {
    db: { insert: vi.fn().mockImplementation(() => createInsertChain()) },
  };
});
```

### Anti-Patterns to Avoid
- **Importing before mocking:** `vi.mock()` must be hoisted above imports in the file. Vitest hoists them automatically, but the pattern `const mock = vi.fn(); vi.mock("...", () => ({ fn: (...args) => mock(...args) }))` is the established way to get a handle on the mock for assertions.
- **Testing implementation details:** Test the behavior (e.g., "returns null coords when API key missing") not the implementation (e.g., "calls console.warn with specific message").
- **Modifying production source:** Phase constraint explicitly forbids it. All test assertions must work against the current source as-is.
- **Using Date constructor without timezone:** Use `new Date("2026-03-15T12:00:00Z")` (noon UTC) to avoid timezone boundary shifts in assertions. The existing billing tests demonstrate this pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM assertions | Custom DOM traversal | @testing-library/jest-dom matchers | `.toBeInTheDocument()`, `.toHaveAttribute()` etc. are standard |
| Module mocking | Manual dependency injection | vi.mock() with factory functions | Vitest handles hoisting and cleanup automatically |
| Component rendering | Manual ReactDOM.render | @testing-library/react render() | Proper cleanup, async utilities, accessibility queries |
| Mock factories | Inline object literals | Existing tests/helpers/*.ts | DRY factories already exist for sessions, leads, billing, scrapers |

**Key insight:** The existing test helpers are comprehensive. Every regression test should reuse `createMockSession`, `createMockLead`, `createTestCompanyProfile`, etc. rather than creating inline mock objects.

## Common Pitfalls

### Pitfall 1: Mock Leaking Between Tests
**What goes wrong:** A mock set in one test affects assertions in another
**Why it happens:** `vi.mock()` is module-level; mock state persists across tests
**How to avoid:** Use `beforeEach(() => { vi.clearAllMocks(); })` in every describe block
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: Drizzle SQL Template Literal Testing
**What goes wrong:** Trying to assert on `sql\`excluded.description\`` content directly
**Why it happens:** Drizzle's `sql` template tag creates opaque SQL objects, not strings
**How to avoid:** Assert that `onConflictDoUpdate` was called (proving the upsert path was taken), and that the `set` parameter contains the expected keys. Don't try to deep-equal the SQL objects.
**Warning signs:** Tests that break when Drizzle internals change

### Pitfall 3: Server Component vs Client Component Testing
**What goes wrong:** Trying to render a server component (async function) with @testing-library
**Why it happens:** Server components are async and use `headers()`, `redirect()` which don't work in jsdom
**How to avoid:** For server components like `page.tsx` and `landing page`, test the underlying logic (server actions, utility functions) rather than rendering the component. For client components (mobile-nav, error boundaries, loading states, plan-selector), use standard @testing-library render.
**Warning signs:** "Cannot read property of undefined" errors from `next/headers`

### Pitfall 4: Mock returning() Yielding Same ID
**What goes wrong:** The pipeline dedup test expects unique lead IDs but the mock returns the same ID every time
**Why it happens:** The existing mock uses `.mockResolvedValue([{ id: "mock-lead-id-001" }])` which always returns the same ID
**How to avoid:** Use `.mockImplementation(() => [{ id: crypto.randomUUID() }])` or sequential `.mockResolvedValueOnce()` calls
**Warning signs:** `allNewLeadIds` array has duplicates or length doesn't match expected count (this is the current 6-test failure)

### Pitfall 5: Testing `sql` Imports from drizzle-orm
**What goes wrong:** Tests that import server code using `sql` from drizzle-orm fail because the mock doesn't include it
**Why it happens:** The `vi.mock("drizzle-orm", ...)` only mocks `eq` and `and` but the source also uses `sql`, `isNotNull`, `desc`, etc.
**How to avoid:** Include all used drizzle-orm exports in the mock factory. For pipeline tests, `sql` must be a tagged template function that returns a mock object.
**Warning signs:** "sql is not a function" runtime errors

## Code Examples

### Regression Test: Permit Upsert (sql`excluded.*` Pattern)
```typescript
// Verifies BUG: permit upsert was re-writing existing values instead of incoming values
vi.mock("@/lib/db", () => {
  const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "lead-1" }]),
  });
  return {
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflictDoUpdate,
          returning: vi.fn().mockResolvedValue([{ id: "lead-1" }]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
    mockOnConflictDoUpdate, // export for assertion
  };
});

it("uses onConflictDoUpdate for permit records (not doNothing)", async () => {
  // Run pipeline with a permit record
  // Assert that onConflictDoUpdate was called (not onConflictDoNothing)
  // Assert the set parameter contains keys like 'description', 'title', etc.
});
```

### Regression Test: Geocoding Returns Null (not 0,0)
```typescript
// Pure function test -- no mocking needed for the function itself,
// just need to verify the geocodeAddress return shape
import { geocodeAddress } from "@/lib/geocoding";

// Mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
  // Test with missing API key
  delete process.env.GOOGLE_MAPS_API_KEY;
});

it("returns null lat/lng when API key is missing (not 0,0)", async () => {
  const result = await geocodeAddress("123 Main St");
  expect(result.lat).toBeNull();
  expect(result.lng).toBeNull();
  expect(result.lat).not.toBe(0);
  expect(result.lng).not.toBe(0);
});
```

### Regression Test: Lead Query Sort (Score DESC, not just Date DESC)
```typescript
// Pure function test on the sort behavior
it("sorts enriched leads by score DESC then scrapedAt DESC", () => {
  const leads = [
    { score: 50, scrapedAt: new Date("2026-03-15") },
    { score: 80, scrapedAt: new Date("2026-03-14") },
    { score: 80, scrapedAt: new Date("2026-03-15") },
  ];

  leads.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.scrapedAt.getTime() - a.scrapedAt.getTime();
  });

  expect(leads[0].score).toBe(80);
  expect(leads[0].scrapedAt).toEqual(new Date("2026-03-15"));
  expect(leads[2].score).toBe(50);
});
```

### Regression Test: equipmentTypes Array.isArray Guard
```typescript
// Tests the guard: Array.isArray(profile.equipmentTypes) ? ... : []
it("returns empty array when equipmentTypes is not an array", () => {
  const profile = { equipmentTypes: null };
  const result = Array.isArray(profile.equipmentTypes)
    ? (profile.equipmentTypes as string[])
    : [];
  expect(result).toEqual([]);
});

it("returns equipmentTypes when it is a valid array", () => {
  const profile = { equipmentTypes: ["Excavators", "Cranes"] };
  const result = Array.isArray(profile.equipmentTypes)
    ? (profile.equipmentTypes as string[])
    : [];
  expect(result).toEqual(["Excavators", "Cranes"]);
});
```

### Regression Test: Date Formatting (Deterministic Locale)
```typescript
import { formatDate, safeFormatDate } from "@/lib/utils";

it("uses en-US locale for deterministic server/client formatting", () => {
  const date = new Date("2026-03-15T12:00:00Z");
  const formatted = formatDate(date);
  // Must be deterministic -- same output regardless of system locale
  expect(formatted).toMatch(/Mar\s+15,\s+2026/);
});

it("returns null for invalid date input", () => {
  expect(safeFormatDate(null)).toBeNull();
  expect(safeFormatDate(undefined)).toBeNull();
  expect(safeFormatDate(new Date("invalid"))).toBeNull();
});
```

## 15 Bug Fixes Mapped to Test Strategy

| # | Bug Fix | Source File(s) | Test Type | What to Assert |
|---|---------|---------------|-----------|----------------|
| 1 | Permit upsert (`sql\`excluded.*\``) | `src/lib/scraper/pipeline.ts` | unit (mock db) | `onConflictDoUpdate` called with `set` keys using excluded references |
| 2 | Geocoding null (not 0,0) | `src/lib/geocoding.ts` | unit (mock env) | Returns `{ lat: null, lng: null }` when API key missing |
| 3 | Lead query sort (score DESC) | `src/lib/leads/queries.ts` | unit (pure fn) | FETCH_MULTIPLIER = 4; sort is score DESC then scrapedAt DESC |
| 4 | Org slug random suffix | `src/components/auth/sign-up-form.tsx` | unit (pure fn) | `slugify()` + random suffix produces unique slugs |
| 5 | Sign-in redirect (try-catch org fetch) | `src/components/auth/sign-in-form.tsx` | component | Error in org fetch shows error message, not redirect loop |
| 6 | Stripe idempotency key | `src/actions/billing.ts` | unit (mock stripe) | `customers.create` called with `{ idempotencyKey: \`create-customer-\${orgId}\` }` |
| 7 | Onboarding upsert (onConflictDoUpdate) | `src/actions/onboarding.ts` | unit (mock db) | Uses `onConflictDoUpdate` on `companyProfiles.organizationId` |
| 8 | Mobile nav drawer | `src/components/dashboard/mobile-nav.tsx` | component | Renders nav links, has open/close toggle, hidden on md+ |
| 9 | Landing page (unauthenticated visitors) | `src/app/page.tsx` | unit (logic) + component (UI parts) | Shows hero content, CTA links to sign-up/sign-in; uses `<Link>` not `<Link><Button>` |
| 10 | Pricing display (env vars) | `src/components/billing/plan-selector.tsx` | component | Shows `monthlyPrice` and `setupFee` when passed; shows fallback text when not |
| 11 | Error boundaries | `src/app/error.tsx`, `src/app/(dashboard)/error.tsx` | component | Renders "Something went wrong" + "Try again" button |
| 12 | Date formatting (deterministic) | `src/lib/utils.ts` | unit (pure fn) | `formatDate` uses en-US, `safeFormatDate` handles null/invalid |
| 13 | Loading states (skeletons) | `src/app/(dashboard)/dashboard/loading.tsx` etc. | component | Renders Skeleton components |
| 14 | equipmentTypes Array.isArray guard | `src/app/(dashboard)/dashboard/page.tsx` | unit (logic) | Returns `[]` when `equipmentTypes` is not an array |
| 15 | Geocoding error handling in forms | `src/actions/onboarding.ts`, `src/actions/settings.ts` | unit (mock geocoding) | Returns `{ success: false, error: "..." }` when geocoding returns null coords |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest 4.x | 2024+ | Faster, native ESM, Vite-compatible |
| enzyme | @testing-library/react | 2020+ | Testing behavior, not implementation |
| Manual test setup | vitest setupFiles | Vitest 1.x+ | Automatic env var and matcher setup |

**Deprecated/outdated:**
- None relevant -- the project's testing stack is current

## Open Questions

1. **Pipeline test failures (6 tests)**
   - What we know: Mock `returning()` always yields `{ id: "mock-lead-id-001" }`, so `allNewLeadIds` after flatMap has duplicates/zeros instead of the expected unique IDs. The dedup function is never called because `allNewLeadIds.length === 0` after dedup.
   - What's unclear: Whether fixing the mock constitutes "modifying production source" -- it doesn't, these are test files only.
   - Recommendation: Fix the pipeline test mock as part of test infrastructure work. This is clearly within scope as it's a test-only change.

2. **npm run test script missing**
   - What we know: No `"test"` script in package.json. `npx vitest run` works.
   - What's unclear: Whether adding a script to package.json counts as "modifying production source" per the phase constraint.
   - Recommendation: package.json scripts are test infrastructure, not production source code. Adding `"test": "vitest run"` is required by success criterion #1. This is within scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/regressions/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01-a | Permit upsert uses excluded.* | unit | `npx vitest run tests/regressions/permit-upsert.test.ts -x` | Wave 0 |
| TEST-01-b | Geocoding returns null not 0,0 | unit | `npx vitest run tests/regressions/geocoding-null.test.ts -x` | Wave 0 |
| TEST-01-c | Lead query sort score DESC | unit | `npx vitest run tests/regressions/lead-query-sort.test.ts -x` | Wave 0 |
| TEST-01-d | Org slug gets random suffix | unit | `npx vitest run tests/regressions/org-slug.test.ts -x` | Wave 0 |
| TEST-01-e | Sign-in redirect fix | component | `npx vitest run tests/regressions/sign-in-redirect.test.ts -x` | Wave 0 |
| TEST-01-f | Stripe idempotency key | unit | `npx vitest run tests/regressions/stripe-idempotency.test.ts -x` | Wave 0 |
| TEST-01-g | Onboarding upsert safety | unit | `npx vitest run tests/regressions/onboarding-upsert.test.ts -x` | Wave 0 |
| TEST-01-h | Mobile nav drawer | component | `npx vitest run tests/regressions/mobile-nav.test.tsx -x` | Wave 0 |
| TEST-01-i | Landing page for visitors | component | `npx vitest run tests/regressions/landing-page.test.tsx -x` | Wave 0 |
| TEST-01-j | Pricing display env vars | component | `npx vitest run tests/regressions/pricing-display.test.tsx -x` | Wave 0 |
| TEST-01-k | Error boundaries | component | `npx vitest run tests/regressions/error-boundaries.test.tsx -x` | Wave 0 |
| TEST-01-l | Date formatting deterministic | unit | `npx vitest run tests/regressions/date-formatting.test.ts -x` | Wave 0 |
| TEST-01-m | Loading states skeletons | component | `npx vitest run tests/regressions/loading-states.test.tsx -x` | Wave 0 |
| TEST-01-n | equipmentTypes Array.isArray guard | unit | `npx vitest run tests/regressions/equipment-types-guard.test.ts -x` | Wave 0 |
| TEST-01-o | Geocoding error in forms | unit | `npx vitest run tests/regressions/geocoding-error-handling.test.ts -x` | Wave 0 |
| TEST-02 | Mock patterns for server actions | infra | `npx vitest run tests/smoke.test.ts -x` | Existing (extend in Wave 0) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/regressions/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (`npx vitest run` exits 0) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/regressions/` directory -- create new directory for all 15 regression tests
- [ ] `package.json` -- add `"test": "vitest run"` script
- [ ] Fix 6 failing tests in `tests/scraper/pipeline.test.ts` -- mock returning() needs unique IDs
- No new framework installs needed -- all dependencies already present

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: vitest.config.ts, tests/setup.ts, 38 existing test files
- Source file analysis: all 15 bug fix source files examined directly
- Existing mock patterns: tests/billing/access-gate.test.ts, tests/scraper/cron-route.test.ts, tests/scraper/pipeline.test.ts, tests/billing/auth-config.test.ts, tests/billing/billing-page.test.tsx

### Secondary (MEDIUM confidence)
- Vitest documentation for vi.mock() hoisting behavior and clearAllMocks semantics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and configured, test patterns established
- Architecture: HIGH - 35 existing test files provide clear patterns to follow; no invention needed
- Pitfalls: HIGH - identified from actual failing tests and codebase analysis; 6 pipeline failures explained
- Bug fix mapping: HIGH - every fix traced to source files with specific testable behaviors

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- test framework and source code are not changing)
