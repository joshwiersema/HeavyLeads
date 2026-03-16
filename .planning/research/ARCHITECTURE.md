# Architecture Research: v2.1 Bug Fixes & Hardening

**Domain:** Multi-tenant SaaS lead generation (HeavyLeads) -- hardening milestone
**Researched:** 2026-03-15
**Confidence:** HIGH

This document maps how testing infrastructure, better-auth password reset/email verification, offset pagination, and batch DB queries integrate with the existing Next.js + better-auth + Drizzle architecture. For each feature, it identifies what existing code is modified vs. what is new, the data flow changes, and the build order dependencies.

## System Overview: Current Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Auth Forms   │  │ Dashboard    │  │ Settings     │               │
│  │ (sign-in,    │  │ (leads,      │  │ (account,    │               │
│  │  sign-up)    │  │  bookmarks,  │  │  company,    │               │
│  │              │  │  filters)    │  │  billing)    │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
├─────────┴─────────────────┴─────────────────┴────────────────────────┤
│                    NEXT.JS APP ROUTER (Server)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ (auth)/      │  │ (dashboard)/ │  │ api/         │               │
│  │ layout.tsx   │  │ layout.tsx   │  │ auth/[...all]│               │
│  │              │  │ (guards:     │  │ cron/scrape  │               │
│  │              │  │  session,    │  │ email-digest  │               │
│  │              │  │  onboarding, │  │ scraper/*     │               │
│  │              │  │  subscription│  │ health        │               │
│  │              │  │  )           │  │               │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
├─────────┴─────────────────┴─────────────────┴────────────────────────┤
│                        LIB / ACTIONS LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ auth.ts  │  │ leads/   │  │ scraper/ │  │ email/   │            │
│  │ auth-    │  │ queries  │  │ pipeline │  │ digest   │            │
│  │ client   │  │ scoring  │  │ dedup    │  │ send     │            │
│  │          │  │ equip.   │  │ adapters │  │          │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │             │                    │
├───────┴─────────────┴─────────────┴─────────────┴────────────────────┤
│                        DATA LAYER                                     │
│  ┌───────────────────────────────────────────────────────────┐       │
│  │  Drizzle ORM (neon-http driver)                           │       │
│  │  Schema: auth (user, session, account, verification,      │       │
│  │    organization, member, invitation), leads, lead-sources, │       │
│  │    bookmarks, lead-statuses, saved-searches,              │       │
│  │    company-profiles, subscriptions, pipeline-runs         │       │
│  └──────────────────────┬────────────────────────────────────┘       │
│                         │                                            │
├─────────────────────────┴────────────────────────────────────────────┤
│                    EXTERNAL SERVICES                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Neon PG  │  │ Stripe   │  │ Resend   │  │ Google   │            │
│  │          │  │          │  │          │  │ Maps API │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

## What Changes Per Feature

### 1. Regression Test Suite (15 bug fixes)

**Status: ALL NEW -- no existing components change**

The testing infrastructure already exists and is mature:
- Vitest + jsdom + React Testing Library
- `vitest.config.ts` with path aliases and setup file
- `tests/setup.ts` with mock env vars for all services
- 6 test helper modules: `auth.ts`, `db.ts`, `email.ts`, `leads.ts`, `billing.ts`, `scraper.ts`
- 40+ existing test files across `tests/scraper/`, `tests/leads/`, `tests/billing/`, `tests/dashboard/`, `tests/email/`

This work adds test files only. Zero production code changes.

| Component | Status | What Happens |
|-----------|--------|--------------|
| `tests/**/*.test.ts` (15+ files) | NEW | Regression tests for v2.0 post-rework bug fixes |
| `tests/helpers/*` | POSSIBLY MODIFIED | May need additional mock factories for edge cases |
| `vitest.config.ts` | UNCHANGED | Current config is sufficient |
| `tests/setup.ts` | UNCHANGED | Mock env vars cover all services |

**Architecture impact:** Zero. Tests mock `@/lib/db` and `@/lib/auth` at the module level. No production code changes needed.

**Testing approach by function type:**

| Function Type | Test Strategy | Examples |
|---------------|---------------|----------|
| Pure functions | Direct import + assert | `haversineDistance`, `filterByEquipment`, `buildFilterConditions`, `applyInMemoryFilters`, `isLikelyDuplicate`, `normalizeText`, `scoreLead`, `mapTimeline`, `getTrialStatus`, `buildCheckoutSessionParams`, `getFreshnessBadge` |
| DB-dependent functions | `vi.mock("@/lib/db")` + assert | `getFilteredLeads`, `getLeadById`, `getBookmarkedLeads`, `deduplicateNewLeads` |
| Server actions | `vi.mock("@/lib/auth")` + `vi.mock("@/lib/db")` | `toggleBookmark`, `completeOnboarding` |
| React components | React Testing Library render + assert | `LeadCard`, `SignInForm`, `PipelineProgress` |
| API routes | Mock request/response objects | `cron/scrape/route.ts` |

**Mocking strategy (established pattern in codebase):**

```
[Test] --> vi.mock("@/lib/auth")       --> Mock session object
       --> vi.mock("next/headers")     --> Mock Headers constructor
       --> vi.mock("next/cache")       --> Mock revalidatePath
       --> vi.mock("@/lib/db")         --> Mock chainable query builder
       --> vi.mock("@/lib/db/schema/*") --> Mock table column refs
```

Server actions use dynamic import after mocks are registered:

```typescript
vi.mock("@/lib/auth", () => ({ ... }));
import { auth } from "@/lib/auth";

describe("myAction", () => {
  it("works", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({...});
    const { myAction } = await import("@/actions/my-action");
    await myAction("arg");
  });
});
```

---

### 2. Forgot Password Flow

**Status: MODIFIED (auth config, sign-in form) + NEW (3 pages, 1 email sender, 1 email template)**

better-auth has built-in password reset support. The `verification` table already exists in the schema (used by better-auth internally for token storage). Resend is already integrated for digest emails.

#### Server-Side Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/auth.ts` | MODIFIED | Add `sendResetPassword` callback to `emailAndPassword` config |
| `src/lib/email/send-password-reset.ts` | NEW | Sends reset email via Resend (mirrors `send-digest.ts` pattern) |
| `src/components/emails/password-reset.tsx` | NEW | React Email template for reset link |

**Auth config change (`src/lib/auth.ts`):**

The `emailAndPassword` block currently has only `enabled: true`. Add the `sendResetPassword` callback:

```typescript
emailAndPassword: {
  enabled: true,
  // NEW: password reset callback
  sendResetPassword: async ({ user, url, token }, request) => {
    // Fire-and-forget (void) to prevent timing attacks
    void sendPasswordResetEmail(user.email, user.name, url);
  },
},
```

better-auth handles: token generation, storage in `verification` table, token expiry (default 1 hour), token validation on reset, password hash update in `account` table, and deletion of used tokens. No schema changes needed.

#### Client-Side Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/auth-client.ts` | UNCHANGED | `authClient.requestPasswordReset()` and `authClient.resetPassword()` already available on the client |
| `src/components/auth/forgot-password-form.tsx` | NEW | Email input form, calls `authClient.requestPasswordReset({ email, redirectTo })` |
| `src/components/auth/reset-password-form.tsx` | NEW | New password input, reads `?token=` from URL, calls `authClient.resetPassword({ newPassword, token })` |
| `src/app/(auth)/forgot-password/page.tsx` | NEW | Route page rendering ForgotPasswordForm |
| `src/app/(auth)/reset-password/page.tsx` | NEW | Route page rendering ResetPasswordForm |
| `src/components/auth/sign-in-form.tsx` | MODIFIED | Add "Forgot password?" link below password field |

#### Data Flow: Password Reset

```
User clicks "Forgot password?" link on sign-in form
    |
    v
/forgot-password page (new route under (auth) layout)
    |
    v
ForgotPasswordForm: user enters email, submits
    |
    v
authClient.requestPasswordReset({
  email: "user@example.com",
  redirectTo: "/reset-password"
})
    |
    v
POST /api/auth/[...all] (better-auth handler, already exists)
    |
    +--> Looks up user by email
    +--> Generates token, stores in `verification` table
    +--> Calls sendResetPassword callback
    |       |
    |       v
    |   send-password-reset.ts --> Resend API --> Email with link
    |   (link = BETTER_AUTH_URL/reset-password?token=xxx)
    |
    v
User receives email, clicks link
    |
    v
/reset-password?token=xxx page (new route under (auth) layout)
    |
    v
ResetPasswordForm: reads token from searchParams, user enters new password
    |
    v
authClient.resetPassword({ newPassword, token })
    |
    v
POST /api/auth/[...all] (better-auth handler)
    +--> Validates token from `verification` table
    +--> Updates password hash in `account` table
    +--> Deletes used verification token
    |
    v
Success message --> user clicks "Sign in" --> /sign-in
```

**Tables involved (all pre-existing):**
- `verification` -- stores reset token (managed by better-auth)
- `account` -- password hash updated on reset (managed by better-auth)
- `user` -- lookup by email (managed by better-auth)

**Important: No new API routes needed.** better-auth's catch-all at `app/api/auth/[...all]/route.ts` already handles all auth endpoints. Password reset endpoints are served automatically when the config callback is added.

---

### 3. Email Verification on Signup

**Status: MODIFIED (auth config, sign-up form, sign-in form) + NEW (1 page, 1 email sender, 1 email template)**

better-auth supports email verification natively via the `emailVerification` top-level config. The `user.emailVerified` column already exists (defaults to `false`). The `verification` table stores verification tokens.

#### Server-Side Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/auth.ts` | MODIFIED | Add `emailVerification` config block with `sendVerificationEmail` callback; add `requireEmailVerification: true` to `emailAndPassword` |
| `src/lib/email/send-verification.ts` | NEW | Sends verification email via Resend |
| `src/components/emails/verify-email.tsx` | NEW | React Email template for verification link |

**Auth config additions (`src/lib/auth.ts`):**

```typescript
export const auth = betterAuth({
  // ... existing config ...

  // NEW: top-level emailVerification config
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      void sendVerificationEmail(user.email, user.name, url);
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,  // NEW: blocks sign-in for unverified users
    sendResetPassword: async ({ user, url, token }, request) => {
      void sendPasswordResetEmail(user.email, user.name, url);
    },
  },
  // ... plugins unchanged ...
});
```

#### Client-Side Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/components/auth/sign-up-form.tsx` | MODIFIED | After signup, redirect to `/verify-email` instead of `/onboarding`; defer org creation to post-verification |
| `src/components/auth/sign-in-form.tsx` | MODIFIED | Handle 403 error (unverified email) with message and "Resend verification" button |
| `src/app/(auth)/verify-email/page.tsx` | NEW | "Check your email" interstitial with resend button |

#### Data Flow: Email Verification

```
User submits sign-up form
    |
    v
authClient.signUp.email({ email, password, name })
    |
    v
POST /api/auth/[...all] (better-auth handler)
    +--> Creates user row (emailVerified = false)
    +--> sendOnSignUp = true triggers sendVerificationEmail callback
    |       |
    |       v
    |   send-verification.ts --> Resend API --> Email with verify link
    |
    v
Sign-up form redirects to /verify-email (interstitial page)
    |
    v
User clicks link in email
    |
    v
GET /api/auth/[...all] (better-auth verification endpoint)
    +--> Validates token from `verification` table
    +--> Sets user.emailVerified = true
    +--> autoSignInAfterVerification = true --> creates session
    +--> Deletes used verification token
    |
    v
Redirect to / (root)
    +--> User has no org yet --> dashboard layout redirects to /onboarding
    +--> (Org creation + onboarding proceeds as before)
```

**Sign-up flow change:** Currently, the sign-up form creates the user AND the organization AND sets it active all in one step, then redirects to `/onboarding`. With email verification, the flow changes:

1. Sign-up creates user only (emailVerified = false)
2. User verifies email
3. On first sign-in (post-verification), user has no org --> dashboard layout redirects to `/onboarding`
4. Onboarding page handles org creation (move org creation logic from sign-up form to onboarding)

This separation is cleaner because it avoids creating an org for a user who never verifies.

**Tables involved (all pre-existing):**
- `user` -- `emailVerified` column set to `true` on verification
- `verification` -- stores verification token
- No schema changes needed

#### Critical Migration Requirement

Enabling `requireEmailVerification: true` locks out ALL users with `emailVerified = false`. This includes every existing user (the admin account and any test accounts). Before deploying:

```sql
-- One-time migration: mark all existing users as verified
UPDATE "user" SET email_verified = true WHERE email_verified = false;
```

This MUST run before the deploy that enables `requireEmailVerification`.

---

### 4. Lead Feed Pagination (BUG 13)

**Status: MODIFIED (queries, dashboard page) + NEW (pagination component)**

The `getFilteredLeads` function already accepts `limit` and `offset` parameters. The dashboard page currently calls it without explicit pagination (defaults to `limit: 50, offset: 0`). The fix wires up URL-based offset pagination.

#### Offset vs Cursor Pagination Decision

Use **offset pagination** because:

1. The dashboard is a server-rendered page navigated via URL searchParams. Cursor-based requires client state (or encoding cursor in URL), while offset maps naturally to `?page=2`.
2. The existing `getFilteredLeads` already has `limit` and `offset` params -- zero query layer changes for offset.
3. Lead data changes slowly (daily cron scrape). The "stale data between pages" problem of offset pagination is negligible when new leads arrive once per day.
4. Page numbers give users a sense of scale ("page 3 of 12" vs. an endless "Load More" scroll).
5. Cursor pagination would require scoring all leads globally to maintain stable cursor position, which defeats pagination's purpose.

#### Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/leads/queries.ts` | NEW FUNCTION | Add `countFilteredLeads()` for total count |
| `src/app/(dashboard)/dashboard/page.tsx` | MODIFIED | Parse `page` searchParam, compute offset, pass to query, render pagination |
| `src/components/dashboard/pagination.tsx` | NEW | Pagination UI (prev/next + page numbers using `<Link>`) |

#### Data Flow: Pagination

```
User visits /dashboard?page=2&radius=100&equipment=Excavators
    |
    v
dashboard/page.tsx (server component)
    |
    +--> Parse page from searchParams (default: 1)
    +--> const PAGE_SIZE = 50
    +--> const offset = (page - 1) * PAGE_SIZE
    |
    v
Two queries (can run in parallel with Promise.all):
    +--> getFilteredLeads({ ..., limit: PAGE_SIZE, offset })
    |       Returns enriched leads for this page
    |
    +--> countFilteredLeads({ same WHERE params })
    |       Returns total count for pagination math
    |
    v
Render lead cards + <Pagination
  totalCount={count}
  currentPage={page}
  pageSize={PAGE_SIZE}
/>
    |
    v
Pagination component renders:
    [< Prev]  [1]  [2]  [3]  ...  [12]  [Next >]
    Each link preserves existing searchParams (filters) and updates page only
    e.g., /dashboard?page=3&radius=100&equipment=Excavators
```

#### New Function: `countFilteredLeads`

```typescript
export async function countFilteredLeads(params: {
  hqLat: number;
  hqLng: number;
  radiusMiles: number;
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minProjectSize?: number;
  maxProjectSize?: number;
}): Promise<number> {
  const filterConditions = buildFilterConditions({ ... });

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(
      isNotNull(leads.lat),
      isNotNull(leads.lng),
      sql`3959 * acos(...) <= ${params.radiusMiles}`, // Same Haversine
      ...filterConditions
    ));

  return Number(result[0].count);
}
```

The count query reuses `buildFilterConditions()` (already exported) and the same Haversine WHERE clause, but skips enrichment entirely (no scoring, equipment inference, or timeline mapping). One extra DB round-trip (~10-50ms on Neon).

#### FETCH_MULTIPLIER Interaction

The over-fetch strategy (`limit * 4` at SQL level, then slice after scoring) means offset applies to the raw SQL query before scoring. Page 2 fetches rows 201-400 (with FETCH_MULTIPLIER=4, PAGE_SIZE=50), scores them in memory, and returns the top 50. This means per-page results are "best leads from this SQL window" rather than globally ranked. This is an acceptable tradeoff for the intended UX (leads change daily, not in real-time).

---

### 5. Bookmarks Batch Query (BUG 14)

**Status: MODIFIED (bookmarks page, queries)**

The current bookmarks page has an N+1 query:

```typescript
// CURRENT: N+1 -- one getLeadById call per bookmark
const bookmarkedIds = await getBookmarkedLeads();
const leads = await Promise.all(
  bookmarkedIds.map((id) => getLeadById(id, { ... }))
);
```

With 20 bookmarks, this fires 21 queries (1 for IDs + 20 for lead data).

#### Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/leads/queries.ts` | NEW FUNCTION | Add `getLeadsByIds(ids, params)` using Drizzle `inArray()` |
| `src/app/(dashboard)/dashboard/bookmarks/page.tsx` | MODIFIED | Replace `Promise.all(ids.map(getLeadById))` with single `getLeadsByIds(ids)` |

#### New Function: `getLeadsByIds`

```typescript
import { inArray } from "drizzle-orm";

export async function getLeadsByIds(
  ids: string[],
  params?: GetLeadByIdParams
): Promise<EnrichedLead[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.id, ids));

  return rows.map((row) => {
    // Same enrichment as getLeadById:
    const inferred = inferEquipmentNeeds(row.projectType, row.description);
    let distance: number | null = null;
    if (params?.hqLat != null && params?.hqLng != null
        && row.lat != null && row.lng != null) {
      distance = haversineDistance(params.hqLat, params.hqLng, row.lat, row.lng);
    }
    // ... scoring, freshness, timeline ...
    return { ...row, distance, inferredEquipment: inferred, score, freshness, timeline };
  });
}
```

**Data flow change:**
```
BEFORE (N+1):
  getBookmarkedLeads() --> [id1, id2, ..., id20]   (1 query)
  getLeadById(id1)                                   (query 2)
  getLeadById(id2)                                   (query 3)
  ...
  getLeadById(id20)                                  (query 21)
  Total: 21 queries

AFTER (batch):
  getBookmarkedLeads() --> [id1, id2, ..., id20]   (1 query)
  getLeadsByIds([id1, ..., id20])                    (1 query: WHERE id IN (...))
  Total: 2 queries
```

---

### 6. Digest Email Query Optimization (BUG 10)

**Status: MODIFIED (digest-generator.ts)**

The current digest generator runs one `getFilteredLeads()` call per saved search per user. With a user who has 3 digest-enabled searches, that is 3 full geo+filter queries.

#### Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/email/digest-generator.ts` | MODIFIED | Compute union of search params, run 1 broad query per user, then filter per-search in memory |

#### Optimization: Union Query

For a user with multiple saved searches, compute the broadest parameters:
- `radiusMiles` = MAX of all searches' radii (or service radius)
- `equipmentFilter` = omit from broad query (apply per-search in memory)
- `dateFrom` = MIN of (24h ago, all searches' date constraints)
- `keyword` = omit from broad query (apply per-search via `applyInMemoryFilters`)

Run one broad `getFilteredLeads()` with union params, then filter results per-search in memory using `applyInMemoryFilters()` and `filterByEquipment()` (both already exported from `queries.ts`).

**Data flow change:**
```
BEFORE (per user with 3 searches):
  For search S1: getFilteredLeads(S1.params)  --> SQL query 1
  For search S2: getFilteredLeads(S2.params)  --> SQL query 2
  For search S3: getFilteredLeads(S3.params)  --> SQL query 3
  Merge + dedup results
  Total: 3 queries per user

AFTER (per user):
  Compute unionParams = broadest(S1, S2, S3)
  getFilteredLeads(unionParams)               --> 1 SQL query
  For each search Si:
    applyInMemoryFilters(results, Si.filters)
    filterByEquipment(filtered, Si.equipment)
  Merge + dedup filtered results
  Total: 1 query per user
```

---

### 7. Non-Permit Dedup via sourceUrl (BUG 9)

**Status: MODIFIED (dedup.ts, pipeline.ts, leads schema)**

Currently, non-permit records check for duplicates by matching `sourceId + title`, which is fragile (different titles for same URL). The fix adds `sourceUrl` as a first-pass exact-match check.

#### Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/lib/scraper/dedup.ts` | MODIFIED | Add sourceUrl exact-match before geo+text fuzzy match |
| `src/lib/scraper/pipeline.ts` | MODIFIED | For non-permit records, check `sourceUrl` for existing lead before insert |
| `src/lib/db/schema/leads.ts` | MODIFIED | Add index on `sourceUrl` column for fast lookups |

#### Dedup Enhancement: Two-Phase Check

```
New non-permit lead arrives with sourceUrl
    |
    v
PHASE 1: Exact sourceUrl match (NEW)
    |
    +--> Does record.sourceUrl exist and is non-null?
    |       |
    |       +--> YES: SELECT id FROM leads WHERE source_url = ? LIMIT 1
    |       |       |
    |       |       +--> MATCH: Known URL. Add source reference, skip lead insert.
    |       |       +--> NO MATCH: Continue to Phase 2
    |       |
    |       +--> NO (null sourceUrl): Continue to Phase 2
    |
    v
PHASE 2: Geo + text fuzzy match (EXISTING, unchanged)
    |
    +--> Bounding box query for nearby leads
    +--> isLikelyDuplicate() with Haversine + text similarity
    +--> MATCH: Merge. NO MATCH: Insert as new lead.
```

**Pipeline change (non-permit branch in `processRecords`):**

```typescript
// CURRENT: fragile title-based check
const existing = await db.select({ id: leads.id }).from(leads)
  .where(and(eq(leads.sourceId, sourceId), eq(leads.title, externalId ?? "")))
  .limit(1);

// NEW: sourceUrl check first, then fall back to title
let existing: { id: string }[] = [];
if (record.sourceUrl) {
  existing = await db.select({ id: leads.id }).from(leads)
    .where(eq(leads.sourceUrl, record.sourceUrl))
    .limit(1);
}
if (existing.length === 0) {
  existing = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.sourceId, sourceId), eq(leads.title, externalId ?? "")))
    .limit(1);
}
```

**Schema addition:** The `leads` table has `sourceUrl` but no index. Add:

```typescript
index("leads_source_url_idx").on(table.sourceUrl),
```

---

### 8. Active Nav Highlighting in Sidebar

**Status: MODIFIED (dashboard layout) + NEW (sidebar nav component)**

The mobile nav (`MobileNav`) already has active nav highlighting using `usePathname()`. The desktop sidebar in `(dashboard)/layout.tsx` uses static `<Link>` elements with no active state. The fix extracts nav to a client component.

#### Changes

| Component | Status | What Changes |
|-----------|--------|--------------|
| `src/components/dashboard/sidebar-nav.tsx` | NEW | Client component with `usePathname()` for active highlighting |
| `src/app/(dashboard)/layout.tsx` | MODIFIED | Replace inline nav links with `<SidebarNav />` component |

**Architecture rationale:** The dashboard layout is a server component (it does `await auth.api.getSession()`). `usePathname()` requires a client component. Extract nav into a client component -- exactly what `MobileNav` already does. The layout stays as a server component.

**The `navLinks` array is duplicated between `MobileNav` and the new `SidebarNav`.** Extract to a shared constant to keep them in sync:

```typescript
// src/components/dashboard/nav-links.ts
export const navLinks = [
  { href: "/dashboard", label: "Leads", icon: LayoutDashboard },
  { href: "/dashboard/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/dashboard/saved-searches", label: "Saved Searches", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

Both `SidebarNav` and `MobileNav` import from here.

---

## Component Boundary Summary

| Boundary | Direction | Protocol | v2.1 Changes |
|----------|-----------|----------|--------------|
| Browser <-> Next.js | HTTP | App Router (RSC, server actions) | New auth pages (forgot-password, reset-password, verify-email) |
| Server Components <-> Auth | Direct import | `auth.api.getSession({ headers })` | Unchanged |
| Server Components <-> DB | Direct import | Drizzle query builder on `db` | NEW: count query, batch query |
| Auth <-> DB | Drizzle adapter | better-auth manages its own tables | Unchanged (verification table pre-exists) |
| Auth <-> Email | Callback functions | `sendResetPassword`, `sendVerificationEmail` | NEW callbacks in auth config |
| Email sending <-> Resend | HTTP | Resend SDK | NEW: 2 email types (reset, verify) |
| Client <-> Auth | HTTP | `authClient.*` hits `/api/auth/[...all]` | NEW: `requestPasswordReset`, `resetPassword`, `sendVerificationEmail` calls |
| Tests <-> Code | Import + vi.mock | Mock DB, auth; test pure functions directly | 15+ new test files |

## Build Order (Dependencies)

```
Phase 1: Regression Tests
    |  No dependencies -- start immediately
    |  Validates existing behavior BEFORE changes
    |  Safety net for subsequent phases
    v
Phase 2: DB Query Optimizations (all 4 independent of each other)
    |  2a. Bookmarks batch query (BUG 14)
    |  2b. Digest email optimization (BUG 10)
    |  2c. Non-permit dedup via sourceUrl (BUG 9)
    |  2d. Lead feed pagination (BUG 13)
    v
Phase 3: Auth Flows (sequential: 3a before 3b)
    |  3a. Forgot password flow
    |      Requires: Resend (already integrated)
    |      Produces: password reset as recovery mechanism
    |
    |  3b. Email verification on signup
    |      Requires: forgot password DONE first
    |      Requires: data migration (set emailVerified=true for existing users)
    |      Reason: requireEmailVerification blocks unverified users;
    |              password reset is the escape hatch
    v
Phase 4: UI Polish
    |  Active nav highlighting
    |  No dependencies, lowest risk
    v
Done
```

**Rationale:**

1. **Tests first** -- project constraint: "every fix needs a corresponding test before merge." Regression tests for existing v2.0 behavior establish the safety net before making any changes.

2. **Query optimizations second** -- isolated, low-risk changes (new functions, modified WHERE clauses, new index). Do not touch auth, do not affect existing users. Independently testable. Can be done in any internal order.

3. **Auth flows third** -- `requireEmailVerification: true` is the most disruptive change. It changes the sign-up flow, blocks unverified users, and requires a data migration. Forgot password MUST deploy before verification because:
   - `requireEmailVerification` gives 403 to any user with `emailVerified = false`
   - Even with migration, something could go wrong
   - Password reset works regardless of verification status (recovery path)

4. **UI polish last** -- trivial, zero-risk, no dependencies.

## NEW vs MODIFIED Summary

| Component | Status | Feature |
|-----------|--------|---------|
| `tests/**/*.test.ts` (15+ files) | NEW | Regression tests |
| `src/lib/leads/queries.ts` -- `getLeadsByIds()` | NEW FUNCTION | Bookmarks batch |
| `src/lib/leads/queries.ts` -- `countFilteredLeads()` | NEW FUNCTION | Pagination count |
| `src/components/dashboard/pagination.tsx` | NEW | Pagination UI |
| `src/app/(dashboard)/dashboard/page.tsx` | MODIFIED | Parse page param, render pagination |
| `src/app/(dashboard)/dashboard/bookmarks/page.tsx` | MODIFIED | Use batch query |
| `src/lib/email/digest-generator.ts` | MODIFIED | Union query optimization |
| `src/lib/scraper/dedup.ts` | MODIFIED | sourceUrl pre-check |
| `src/lib/scraper/pipeline.ts` | MODIFIED | sourceUrl in non-permit path |
| `src/lib/db/schema/leads.ts` | MODIFIED | Add sourceUrl index |
| `src/lib/auth.ts` | MODIFIED | sendResetPassword + emailVerification config |
| `src/lib/email/send-password-reset.ts` | NEW | Reset email sender |
| `src/lib/email/send-verification.ts` | NEW | Verification email sender |
| `src/components/emails/password-reset.tsx` | NEW | Reset email template |
| `src/components/emails/verify-email.tsx` | NEW | Verification email template |
| `src/components/auth/forgot-password-form.tsx` | NEW | Forgot password form |
| `src/components/auth/reset-password-form.tsx` | NEW | Reset password form |
| `src/app/(auth)/forgot-password/page.tsx` | NEW | Forgot password route |
| `src/app/(auth)/reset-password/page.tsx` | NEW | Reset password route |
| `src/app/(auth)/verify-email/page.tsx` | NEW | Verification interstitial |
| `src/components/auth/sign-in-form.tsx` | MODIFIED | Forgot link + 403 handling |
| `src/components/auth/sign-up-form.tsx` | MODIFIED | Redirect to verify-email, defer org creation |
| `src/components/dashboard/sidebar-nav.tsx` | NEW | Active nav client component |
| `src/components/dashboard/nav-links.ts` | NEW | Shared nav link definitions |
| `src/app/(dashboard)/layout.tsx` | MODIFIED | Use SidebarNav component |

**Totals: ~15 new files, ~11 modified files, 0 new schema tables, 1 new index**

## Anti-Patterns to Avoid

### Anti-Pattern 1: Testing Against Real Database

**What people do:** Write integration tests that hit Neon PostgreSQL.
**Why it's wrong:** Flaky (network), slow, pollutes data, costs money, fails in CI.
**Do this instead:** Mock `@/lib/db` at the module level. Test pure functions directly without mocks. The existing 40+ test files already follow this pattern.

### Anti-Pattern 2: Making Dashboard Layout a Client Component for Active Nav

**What people do:** Convert the server layout to `"use client"` to use `usePathname()`.
**Why it's wrong:** Breaks server-side auth, subscription, and onboarding checks. All data fetching moves client-side, adding waterfalls.
**Do this instead:** Extract nav into a `"use client"` component (`SidebarNav`). Keep layout as server component. `MobileNav` already demonstrates this.

### Anti-Pattern 3: Enabling requireEmailVerification Without Migration

**What people do:** Flip `requireEmailVerification: true` without updating existing users.
**Why it's wrong:** All existing users (admin included) locked out -- `emailVerified` defaults to `false`.
**Do this instead:** Run `UPDATE "user" SET email_verified = true` before deploying. Deploy forgot password first as escape hatch.

### Anti-Pattern 4: Scoring-Aware Pagination via Full Table Scan

**What people do:** Load all leads, score them all, then paginate the scored list.
**Why it's wrong:** Defeats pagination. At 10k+ leads, slow and memory-intensive on Vercel (1GB limit).
**Do this instead:** Accept approximate pagination (SQL sorts by `scrapedAt DESC`, per-page re-sort by score). Users get "best leads from this time window" per page.

### Anti-Pattern 5: Awaiting Email Sends in Auth Callbacks

**What people do:** `await resend.emails.send()` inside `sendResetPassword` or `sendVerificationEmail`.
**Why it's wrong:** Creates timing oracle that leaks whether an email exists in the system. Also risks Vercel function timeout if Resend is slow.
**Do this instead:** Use `void sendEmail()` (fire-and-forget). The email send is not on the critical path.

### Anti-Pattern 6: Deploying Email Verification Before Password Reset

**What people do:** Implement verification first because it seems like the "primary" feature.
**Why it's wrong:** `requireEmailVerification` immediately locks out unverified users. Without password reset, there is no recovery mechanism.
**Do this instead:** Deploy forgot password first, then verification. Or deploy both simultaneously, never verification alone.

## Integration Points

### External Services

| Service | Integration Pattern | v2.1 Notes |
|---------|---------------------|------------|
| Neon PostgreSQL | Drizzle ORM via neon-http | NEW: `inArray()` for batch, `count(*)` for pagination, sourceUrl index |
| Resend | Direct SDK in `src/lib/email/` | NEW: 2 additional email types (reset, verify) |
| Stripe | better-auth Stripe plugin | Unchanged |
| Google Maps | `geocodeAddress()` | Unchanged |
| better-auth | `/api/auth/[...all]` catch-all | MODIFIED: New config callbacks, no new routes |

### Internal Boundaries

| Boundary | Communication | v2.1 Notes |
|----------|---------------|------------|
| Auth config <-> Email senders | Callback (fire-and-forget `void`) | NEW: `sendResetPassword`, `sendVerificationEmail` |
| Dashboard <-> Lead queries | Direct import | MODIFIED: pagination params + count query |
| Bookmarks <-> Lead queries | Direct import | MODIFIED: `getLeadsByIds` replaces N+1 |
| Digest <-> Lead queries | Direct import | MODIFIED: single broad query per user |
| Pipeline <-> Dedup | Direct import | MODIFIED: sourceUrl pre-check |
| Server layout <-> Nav | Props/children | MODIFIED: extract to client component |

## Sources

- [better-auth Email & Password docs](https://better-auth.com/docs/authentication/email-password) -- `sendResetPassword`, `requireEmailVerification`, `forgetPassword`/`resetPassword` client methods (HIGH confidence: official docs)
- [better-auth Email concepts](https://better-auth.com/docs/concepts/email) -- `sendVerificationEmail`, `sendOnSignUp`, `autoSignInAfterVerification` (HIGH confidence: official docs)
- Codebase analysis of 25+ source files (HIGH confidence: direct code inspection of `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/leads/queries.ts`, `src/actions/bookmarks.ts`, `src/lib/scraper/dedup.ts`, `src/lib/scraper/pipeline.ts`, `src/lib/email/digest-generator.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/bookmarks/page.tsx`, `src/components/dashboard/mobile-nav.tsx`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/lib/db/schema/*.ts`, `tests/setup.ts`, `tests/helpers/*.ts`)

---
*Architecture research for: HeavyLeads v2.1 Bug Fixes & Hardening*
*Researched: 2026-03-15*
