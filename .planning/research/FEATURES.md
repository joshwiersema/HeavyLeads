# Feature Landscape: v2.1 Bug Fixes & Hardening

**Domain:** B2B SaaS lead intelligence platform (construction/heavy machinery)
**Researched:** 2026-03-15
**Confidence:** HIGH (features verified against better-auth official docs, Drizzle ORM docs, Next.js App Router patterns, and existing codebase analysis)

## Scope

This research covers the 8 target features for HeavyLeads v2.1: regression tests, lead feed pagination, bookmarks batch query, digest email optimization, non-permit dedup improvement, active nav highlighting, forgot password flow, and email verification on signup. Each is assessed for implementation pattern, complexity, and dependencies.

---

## Table Stakes

Features that production B2B SaaS apps must have. Missing these signals the product is unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Forgot password flow | Every SaaS app has this. Users who cannot recover access leave permanently. No support channel to fall back on as a solo-founder product. | LOW | better-auth has native `sendResetPassword` config on `emailAndPassword`. Requires email sending integration (Resend already configured for digests). Two pages: request form + reset form. |
| Email verification on signup | Prevents fake accounts, ensures digest emails reach real inboxes, maintains Resend sender reputation. B2B users expect this from any tool touching their business data. | LOW-MEDIUM | better-auth has native `emailVerification.sendVerificationEmail` config. Decision: use delayed verification (allow access, gate at first meaningful action like digest subscription) vs immediate verification (block dashboard until verified). Recommend delayed -- see rationale below. |
| Lead feed pagination | Current feed renders up to 50 leads in a single page load. Users with dense metro areas or wide service radii will hit this ceiling immediately. No "load more" or "next page" means stale leads below the fold are invisible. | MEDIUM | Cursor-based pagination using `(scrapedAt, id)` compound cursor at the SQL level, with in-memory score sorting preserved. Server action for loading more. |
| Active nav highlighting (desktop sidebar) | Mobile nav already highlights the active link. Desktop sidebar does not. Users navigating between Leads, Bookmarks, Saved Searches, and Settings have no visual indicator of where they are. Creates cognitive dissonance on desktop. | LOW | Extract desktop sidebar nav into a client component using `usePathname()`. Mirror the existing pattern from `MobileNav` component. |
| Bookmarks batch query | Current bookmarks page fires N individual `getLeadById()` calls via `Promise.all(bookmarkedIds.map(...))`. With 20 bookmarks, that is 20 separate SQL queries. Page load degrades linearly. | LOW-MEDIUM | Replace with a single `SELECT ... WHERE id IN (...)` query using Drizzle's `inArray` operator, then enrich results in a single pass. |
| Digest email query optimization | Current digest generator calls `getFilteredLeads()` once per saved search per user inside a nested loop. A user with 3 saved searches triggers 3 full Haversine geo queries. With 50 users, that could mean 150+ heavy queries per digest run. | MEDIUM | Consolidate: group saved searches by org, batch-fetch company profiles with `inArray`, and cache profile lookups in a Map within the digest run. |
| Non-permit dedup via sourceUrl | Current unique index is `(sourceId, permitNumber)`. Non-permit sources (news, bids, deep-web) have null permitNumber, so duplicates slip through. BUG 9 in the battle test report. | LOW-MEDIUM | Add a partial unique index on `(sourceId, sourceUrl)` where sourceUrl is not null and sourceType is not permit. Also add application-level pre-insert check for non-permit types. |
| Regression tests for v2.0 fixes | 15 bug fixes shipped without test coverage. Any future change risks reintroducing them. Production safety requires automated verification that each fix holds. | MEDIUM-HIGH | 15 individual test cases covering: permit upsert, geocoding null-safe, scoring fetch multiplier, error boundaries, sign-in redirect, onboarding upsert, mobile nav, landing page, lead status, bookmarks, saved searches, email digest, pipeline progress, dedup, and billing fixes. Mix of unit tests and integration tests. |

### Email Verification Strategy: Delayed, Not Blocking

**Recommendation:** Allow dashboard access without email verification. Gate digest email subscriptions and team invites on verified email.

**Rationale:**
1. HeavyLeads targets sales reps at heavy machinery dealerships -- not a self-serve consumer app. These users sign up with legitimate work emails because their employer told them to.
2. The signup flow already requires org creation + onboarding (5+ steps). Adding email verification before any of that compounds friction during the highest-churn moment.
3. The core risk of unverified emails is digest delivery failure and sender reputation damage. Gating digest subscription on verification addresses this without blocking the core experience.
4. better-auth's `requireEmailVerification: true` returns a 403 on signin for unverified users. This is heavy-handed for a B2B product with a 7-day trial. Every minute of blocked access is lost trial time.

**Implementation:** Set `requireEmailVerification: false` in better-auth config (or omit it, as false is the default). Add a `sendVerificationEmail` handler that fires on signup. Show a non-blocking banner in dashboard: "Verify your email to enable daily digest emails." When user tries to enable digest on a saved search, check `emailVerified` and prompt verification if false.

### Forgot Password: Standard Token-Based Flow

**Pattern:** better-auth's native password reset uses a time-limited token sent via email link.

**Flow:**
1. User clicks "Forgot password?" on sign-in page
2. Client calls `authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })`
3. Server calls configured `sendResetPassword({ user, url, token })` handler
4. Handler sends email via Resend with reset link containing token
5. User clicks link, lands on `/reset-password?token=...`
6. User enters new password, client calls `authClient.resetPassword({ newPassword, token })`
7. Redirect to sign-in with success message

**Security notes from better-auth docs:**
- Use `void sendEmail(...)` (fire-and-forget) in the `sendResetPassword` handler to prevent timing attacks that reveal whether an email exists
- On Vercel serverless, use `waitUntil` or similar to ensure the email actually sends after the response returns
- Token expiration defaults to 1 hour (adequate for B2B)

### Pagination: Cursor-Based with Load More

**Why cursor, not offset:**
1. The current query already uses `OFFSET` but with a fixed `limit=50` and `offset=0` (always page 1). Extending this with offset pagination would degrade for deep pages -- PostgreSQL must scan and discard all rows before the offset.
2. Lead scores change over time (new leads push old ones down). Offset pagination across multiple page loads causes duplicates and missed leads.
3. Cursor pagination using `(scrapedAt, id)` is stable across data mutations.

**Important complication:** The current query sorts by `scrapedAt DESC` in SQL, then re-sorts by `score DESC` in memory after enrichment. This means the SQL-level cursor cannot use the score column directly because scores are computed in application code, not stored in the database.

**Recommended approach:** Use `(scrapedAt, id)` as the SQL-level cursor. This enables efficient keyset pagination in PostgreSQL. The in-memory score sort still happens per-batch, and the FETCH_MULTIPLIER ensures high-score leads within each batch are not dropped. Across batches, leads are roughly time-ordered, which is acceptable because users scrolling deep into the feed are exploring older leads anyway.

**Reduce default page size from 50 to 25:** Faster initial load, more granular loading. The FETCH_MULTIPLIER stays at 4 (fetch 100 from DB, score/filter to 25).

**Client-side implementation:**
- Initial page load: server component fetches first batch (25 leads) via `getFilteredLeads()`
- "Load more" button at bottom of feed (not infinite scroll -- avoids scroll position bugs, simpler state management, works better with server components)
- Button calls a server action with the cursor (last lead's scrapedAt + id)
- Client component appends results to existing list
- Shows "No more leads" when fewer results than limit are returned

**Why "Load more" button, not infinite scroll:**
- Infinite scroll requires an Intersection Observer, scroll position management, and complex state handling for the accumulated leads list
- With server components, search param-based pagination causes re-renders of the entire page
- A "Load more" button with a server action is simpler, more predictable, and matches the mental model of batch-loaded data
- Can upgrade to infinite scroll in a future polish pass if user feedback requests it

**Complexity:** MEDIUM
**Estimated effort:** 6-8 hours

### Active Nav: Client Component Extraction

**Current state:** Desktop sidebar in `layout.tsx` uses plain `<Link>` components with no active state. Mobile nav (`MobileNav` component) already implements active highlighting using `usePathname()`.

**Pattern:** Extract the desktop sidebar nav links into a `SidebarNav` client component. Reuse the same `navLinks` array and `isActive` logic already in `MobileNav`. Keep the rest of the layout as a server component.

**Matching logic (from existing MobileNav):**
```typescript
const isActive = href === "/dashboard"
  ? pathname === "/dashboard"
  : pathname.startsWith(href);
```

This correctly handles exact match for the root dashboard path and prefix match for nested routes like `/dashboard/bookmarks`.

---

## Differentiators

Features that go beyond baseline expectations for a hardening release but add meaningful value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Total lead count in pagination | Show "Showing 25 of 142 leads" instead of just "25 leads within X miles". Gives users confidence the system found comprehensive results and encourages scrolling. | LOW | Add a `COUNT(*)` query alongside the main query (or use a window function). Display total in the header. |
| Bookmark count badge in sidebar | Show number of bookmarked leads next to "Bookmarks" in sidebar nav. Provides at-a-glance visibility without navigating to the page. | LOW | Query bookmark count during layout render. Pass to SidebarNav component. |
| "Verify email" inline prompt on saved search digest toggle | Instead of a generic banner, show the verification prompt exactly when it matters -- when the user tries to enable digest emails. Context-sensitive prompting converts better than global banners. | LOW | Check `user.emailVerified` when toggling `isDigestEnabled`. If false, show modal/toast with "Verify your email to receive digest emails" and a resend button. |

---

## Anti-Features

Features to explicitly NOT build in v2.1, even if they seem adjacent.

| Anti-Feature | Why It Seems Relevant | Why Avoid | What to Do Instead |
|--------------|----------------------|-----------|-------------------|
| Traditional page numbers (1, 2, 3...) | Familiar pagination pattern | Offset-based page numbers are a poor fit for a score-sorted feed where scores change between page loads. Users clicking "page 3" would see different results than the first time. Creates confusion. | "Load more" button with cursor pagination. This matches the mental model of a feed, not a catalog. |
| Infinite scroll | Modern UX for feeds | Adds Intersection Observer complexity, scroll position management bugs, and state management overhead for accumulated results. The existing page is a server component -- infinite scroll pushes more logic client-side. | "Load more" button. Simpler, more predictable, upgradeable to infinite scroll later. |
| OAuth / social login (Google, GitHub) | Seems like it should ship with auth hardening | Adds complexity (OAuth provider configuration, callback handling, account linking edge cases). B2B users at heavy machinery companies use work email -- not personal Google accounts. The existing email/password flow is the right fit. | Keep email/password. Add OAuth in a future milestone if user feedback requests it. |
| Password complexity rules beyond minimum | "Enterprise" feel | Overly strict rules (uppercase, special chars, etc.) frustrate users without meaningfully improving security. NIST guidelines discourage composition rules. | Enforce minimum 8 characters. Consider `zxcvbn` password strength meter in a future polish pass. |
| Rate limiting on password reset requests | Security hardening | better-auth already returns 200 for both valid and invalid emails (prevents enumeration). Rate limiting the endpoint adds implementation complexity for a problem that does not exist yet at current scale. | Monitor Resend send volume. Add rate limiting if abuse appears. |
| Full-text search index (tsvector) | Keyword search optimization | Current `ILIKE` queries on title, description, address are adequate for <100K leads. Full-text search adds migration complexity and Neon compatibility considerations. | Keep ILIKE. Revisit when lead volume exceeds 100K and keyword search latency becomes measurable. |
| Middleware auth guard (BUG 17) | Centralized auth checking | Evaluated in v2.0 battle test. Layout-level checks are sufficient for current route count. Middleware adds complexity and a new failure point. | Keep layout-level session checks in dashboard layout. |
| Env var startup validation | Catch config errors early | Caused production 500 in v2.0. Validate at usage points with `.trim()` instead. | Continue point-of-use validation. |
| E2E test suite (Playwright/Cypress) | Comprehensive testing | Valuable but out of scope for a hardening milestone. Unit and integration tests cover the regression needs. E2E adds CI complexity and flakiness risk. | Defer to future milestone. Unit tests for v2.1. |

---

## Feature Dependencies

```
[Regression Tests]
    |-- independent of all other features
    |-- should be written FIRST to establish safety net
    |-- enables: safe refactoring of queries, auth, and dedup logic

[Active Nav Highlighting]
    |-- independent of all other features
    |-- requires: extracting sidebar nav into client component
    |-- no schema changes, no API changes

[Forgot Password Flow]
    |-- requires --> [Resend email integration] (already configured for digests)
    |-- requires --> [Two new pages: /forgot-password, /reset-password]
    |-- requires --> [better-auth emailAndPassword.sendResetPassword config]
    |-- independent of email verification

[Email Verification on Signup]
    |-- requires --> [Resend email integration] (already configured)
    |-- requires --> [better-auth emailVerification.sendVerificationEmail config]
    |-- requires --> [Verification banner component in dashboard layout]
    |-- gates --> [Digest email subscription toggle]
    |-- should-follow --> [Forgot Password] (share email sending patterns)

[Lead Feed Pagination]
    |-- requires --> [Modified getFilteredLeads to accept cursor params]
    |-- requires --> [New Server Action for loading next page]
    |-- requires --> [Client component for "Load more" button + lead list]
    |-- impacts --> [Dashboard page.tsx must change from rendering all leads to first batch]
    |-- should-follow --> [Regression Tests] (query changes need safety net)

[Bookmarks Batch Query]
    |-- requires --> [New getLeadsByIds() function in queries.ts]
    |-- requires --> [Drizzle inArray operator for WHERE id IN (...)]
    |-- replaces --> [Current N+1 pattern in bookmarks/page.tsx]
    |-- should-follow --> [Regression Tests] (query refactor needs safety net)

[Digest Email Query Optimization]
    |-- requires --> [Refactored digest-generator.ts]
    |-- requires --> [Company profile caching within digest run]
    |-- should-follow --> [Regression Tests] (digest logic refactor needs safety net)

[Non-Permit Dedup via sourceUrl]
    |-- requires --> [New partial unique index on leads table]
    |-- requires --> [Migration: add index on (sourceId, sourceUrl) WHERE conditions]
    |-- requires --> [Updated dedup logic in pipeline to check sourceUrl for non-permit types]
    |-- should-follow --> [Regression Tests] (dedup logic change needs safety net)
```

### Critical Path

```
Regression Tests (safety net)
    |
    +---> [Auth Features]      +---> [Query Optimizations]     +---> [UI Polish]
    |     - Forgot password    |     - Bookmarks batch         |     - Active nav
    |     - Email verification |     - Digest optimization     |
    |                          |     - sourceUrl dedup         |
    |                          |     - Pagination              |
```

Auth features, query optimizations, and UI polish can proceed in parallel after regression tests establish the safety net. Within each track, the ordering matters:

- **Auth track:** Forgot password first (simpler, establishes email sending pattern), then email verification (builds on same pattern, adds gate logic).
- **Query track:** Bookmarks batch query first (smallest scope, isolated change), then digest optimization (similar pattern, more complex), then sourceUrl dedup (schema migration required), then pagination (largest scope, touches the main dashboard page).
- **UI track:** Active nav is a single independent change.

---

## MVP Recommendation

All 8 features are in scope and should ship. Prioritize in this order:

### Priority 0: Safety Net
1. **Regression tests for 15 bug fixes** -- Without these, every subsequent change in this milestone risks reintroducing bugs. This is the foundation.

### Priority 1: Core Deliverables (Low Risk, High Visibility)
2. **Forgot password flow** -- Lowest complexity auth feature. Establishes the email sending pattern reused by verification. Two new pages + one config change.
3. **Email verification on signup** -- Builds on the forgot password email pattern. Adds verification banner + digest gate. Does not block dashboard access.
4. **Bookmarks batch query** -- Replace N+1 with single `inArray` query. Isolated change, clear before/after comparison.
5. **Active nav highlighting** -- Quick win. Extract client component, reuse existing mobile nav pattern.

### Priority 2: Larger Scope (Medium Risk, High Impact)
6. **Digest email query optimization** -- Reduce per-user query count. More complex refactor but contained within `digest-generator.ts`.
7. **Non-permit dedup via sourceUrl** -- Schema migration + dedup logic update. Test carefully against existing permit dedup.
8. **Lead feed pagination** -- Largest scope feature. Touches the main dashboard page, adds new server action, requires cursor encoding, and changes the feed UX. Ship last when all regression tests are passing.

### Defer
- Total lead count display (nice-to-have, add with pagination if time permits)
- Bookmark count badge (polish, not blocking)
- E2E testing, middleware auth, any new feature development

---

## Detailed Feature Specifications

### 1. Forgot Password Flow

**Pages to create:**
- `/forgot-password` -- Email input form. Calls `authClient.requestPasswordReset()`. Shows "If an account exists, we sent a reset link" message (same response regardless of email existence to prevent enumeration).
- `/reset-password` -- New password form. Reads `token` from URL search params. Calls `authClient.resetPassword({ newPassword, token })`. Redirects to `/sign-in` on success.

**Server config change in `src/lib/auth.ts`:**
```typescript
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url, token }, request) => {
    // Fire-and-forget to prevent timing attacks
    void sendPasswordResetEmail(user.email, url);
  },
},
```

**Email sending:** Create a `sendPasswordResetEmail` function in `src/lib/email/` using the existing Resend client pattern from `send-digest.ts`. Simple text/HTML email with reset link. Reuse existing Resend API key and from address.

**Complexity:** LOW
**Estimated effort:** 2-3 hours

### 2. Email Verification on Signup

**Server config change in `src/lib/auth.ts`:**
```typescript
emailVerification: {
  sendVerificationEmail: async ({ user, url, token }, request) => {
    void sendVerificationEmail(user.email, user.name, url);
  },
  // Do NOT set requireEmailVerification: true
  // We gate specific features, not dashboard access
},
```

**Dashboard banner:** Non-blocking yellow/amber banner below trial banner: "Please verify your email address to enable daily digest emails. [Resend verification email]". Only shown when `!session.user.emailVerified`.

**Digest gate:** In the saved search card's digest toggle handler, check `session.user.emailVerified`. If false, show a prompt instead of toggling.

**Complexity:** LOW-MEDIUM
**Estimated effort:** 3-4 hours

### 3. Lead Feed Pagination

**Query changes to `getFilteredLeads()`:**
- Add optional `cursor` parameter: `{ scrapedAt: Date; id: string }`
- When cursor is provided, add WHERE clause: `(scrapedAt < cursor.scrapedAt) OR (scrapedAt = cursor.scrapedAt AND id > cursor.id)`
- Return `{ leads: EnrichedLead[]; nextCursor: Cursor | null }` instead of just `EnrichedLead[]`
- `nextCursor` is null when fewer leads than `limit` are returned (end of feed)

**Page size:** Reduce from 50 to 25. FETCH_MULTIPLIER stays at 4 (fetch 100 from DB, score/filter to 25).

**Client-side implementation:**
```
[Dashboard page.tsx - server component]
  renders initial 25 leads + nextCursor
  passes to:
    [LeadFeed client component]
      manages accumulated leads state
      renders lead cards
      renders "Load more" button when nextCursor exists
      on click: calls loadMoreLeads server action with cursor
      appends results to leads state
      shows loading state during fetch
      hides button when nextCursor is null
```

**Complexity:** MEDIUM
**Estimated effort:** 6-8 hours

### 4. Bookmarks Batch Query

**New function in `queries.ts`:**
```typescript
export async function getLeadsByIds(
  ids: string[],
  params?: GetLeadByIdParams
): Promise<EnrichedLead[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.id, ids));

  return rows.map(row => {
    // Same enrichment as getLeadById but batched
    const inferred = inferEquipmentNeeds(row.projectType, row.description);
    const inferredTypes = inferred.map(i => i.type);
    let distance: number | null = null;
    if (params?.hqLat != null && params?.hqLng != null
        && row.lat != null && row.lng != null) {
      distance = haversineDistance(params.hqLat, params.hqLng, row.lat, row.lng);
    }
    const score = params?.dealerEquipment && params?.serviceRadiusMiles && distance != null
      ? scoreLead({ inferredEquipment: inferredTypes, dealerEquipment: params.dealerEquipment,
          distanceMiles: distance, serviceRadiusMiles: params.serviceRadiusMiles,
          estimatedValue: row.estimatedValue })
      : 0;
    return {
      ...row, distance, inferredEquipment: inferred, score,
      freshness: getFreshnessBadge(row.scrapedAt),
      timeline: mapTimeline(row.projectType, row.description),
    } as EnrichedLead;
  });
}
```

**Bookmarks page change:**
```typescript
// BEFORE (N+1):
const leads = await Promise.all(
  bookmarkedIds.map(id => getLeadById(id, { ... }))
);

// AFTER (batch):
const leads = await getLeadsByIds(bookmarkedIds, { ... });
```

**Complexity:** LOW-MEDIUM
**Estimated effort:** 2-3 hours

### 5. Digest Email Query Optimization

**Current N+1 pattern (two levels):**
1. Per-user: fetches company profile individually (`db.query.companyProfiles.findFirst`)
2. Per-saved-search: calls `getFilteredLeads()` with full Haversine computation

**Recommended optimization (pragmatic):**
Pre-fetch all needed company profiles at the start of the digest run and cache in a Map:

```typescript
// At start of generateDigests():
const orgIds = [...new Set(searchesWithUsers.map(r => r.saved_searches.organizationId))];
const profiles = await db.select().from(companyProfiles).where(inArray(companyProfiles.organizationId, orgIds));
const profileMap = new Map(profiles.map(p => [p.organizationId, p]));

// In the per-user loop:
const profile = profileMap.get(group.organizationId);
// No DB query needed -- already cached
```

This eliminates N profile lookups. The per-search `getFilteredLeads()` calls remain because each saved search has different filter params, and the Haversine query is already indexed. Consolidating search queries would require merging incompatible filter sets, adding complexity with marginal benefit.

**Complexity:** MEDIUM (refactoring the generator function while preserving behavior)
**Estimated effort:** 3-4 hours

### 6. Non-Permit Dedup via sourceUrl

**Problem:** The unique index `leads_source_permit_idx` on `(sourceId, permitNumber)` only catches duplicate permits. Non-permit sources insert `permitNumber = null`, and PostgreSQL treats `NULL != NULL` in unique indexes, so duplicates pass through.

**Solution (two-part):**

**Part 1: Database index migration**
```sql
CREATE UNIQUE INDEX leads_source_url_idx
ON leads (source_id, source_url)
WHERE source_url IS NOT NULL AND source_type != 'permit';
```
This catches exact-URL duplicates for non-permit sources without affecting permit dedup.

**Part 2: Application-level check in pipeline**
Before inserting a non-permit lead, check if a lead with the same `sourceId` + `sourceUrl` already exists. If so, skip insertion (or merge the source reference to the existing lead). This mirrors the existing `ON CONFLICT` pattern used for permits.

**Edge case:** Some adapters may scrape the same article/bid from different sourceIds (e.g., same bid appears on SAM.gov and a state bid board). The current Haversine + text similarity dedup handles cross-source dedup. The sourceUrl index handles same-source dedup. These are complementary.

**Complexity:** LOW-MEDIUM
**Estimated effort:** 2-3 hours

### 7. Active Nav Highlighting

**Implementation:**
1. Create `src/components/dashboard/sidebar-nav.tsx` as a `"use client"` component
2. Import `usePathname` from `next/navigation`
3. Reuse the `navLinks` array from `MobileNav` (or extract to shared constant)
4. Apply conditional className: `isActive ? "bg-accent text-accent-foreground" : ""`
5. Replace the inline `<nav>` in `layout.tsx` with `<SidebarNav />`

**Complexity:** LOW
**Estimated effort:** 30 minutes

### 8. Regression Tests

**Test categories needed:**

| Bug Fix | Test Type | What to Assert |
|---------|-----------|---------------|
| Permit upsert (excluded.* pattern) | Unit | Upsert does not create duplicates for same sourceId + permitNumber |
| Geocoding null-safe | Unit | Returns null coords (not 0,0) when geocoding fails |
| Lead scoring fetch multiplier | Unit | High-score older leads are not dropped when FETCH_MULTIPLIER is applied |
| Error boundaries | Component | Error boundary renders fallback UI, not white screen |
| Sign-in redirect loop | Integration | Authenticated user on /sign-in redirects to /dashboard once |
| Onboarding upsert (double-submit) | Integration | Rapid double-submit creates one profile, not two |
| Mobile nav drawer | Component | Drawer opens/closes, links navigate correctly |
| Landing page (unauthenticated) | Integration | Unauthenticated request to / renders landing page |
| Lead status tracking | Unit | Status CRUD operations work, default is 'new' |
| Bookmark toggle | Unit | Toggle creates/deletes bookmark, ON CONFLICT handles race |
| Saved search CRUD | Unit | Create, update, delete saved searches with filters |
| Email digest generation | Unit | Digest generates for enabled searches, skips disabled |
| Pipeline progress tracking | Unit | Pipeline status updates correctly per adapter |
| Dedup (permit) | Unit | Same-address leads within proximity merge correctly |
| Billing trial status | Unit | Trial active/expired computed correctly from dates |

**Testing stack:** Vitest (standard for Next.js projects). For unit tests, mock DB calls. For integration tests touching auth/routing, use Next.js test utilities or lightweight mocks.

**Complexity:** MEDIUM-HIGH (15 tests, mix of unit and integration)
**Estimated effort:** 8-12 hours

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk if Skipped | Priority |
|---------|------------|---------------------|-----------------|----------|
| Regression tests | HIGH (prevents regressions) | HIGH (15 tests) | HIGH (any change could rebreak) | P0 |
| Forgot password | HIGH (access recovery) | LOW | HIGH (locked-out users churn) | P1 |
| Email verification | MEDIUM (data quality) | LOW-MEDIUM | MEDIUM (digest emails bounce) | P1 |
| Bookmarks batch query | MEDIUM (performance) | LOW-MEDIUM | LOW (N+1 noticeable with many bookmarks) | P1 |
| Active nav highlighting | LOW (UX polish) | LOW | LOW (visual inconsistency) | P1 |
| Digest query optimization | MEDIUM (performance) | MEDIUM | LOW (digest slow with many users) | P2 |
| Non-permit dedup | MEDIUM (data quality) | LOW-MEDIUM | MEDIUM (duplicate leads confuse users) | P2 |
| Lead feed pagination | HIGH (core UX) | MEDIUM | MEDIUM (50-lead cap limits discovery) | P2 |

**Priority key:**
- P0: Must complete first (safety net for all other work)
- P1: Core deliverables, implement after safety net
- P2: Important but larger scope, implement after P1s

---

## Sources

### better-auth
- [Email & Password Authentication](https://better-auth.com/docs/authentication/email-password) -- HIGH confidence (official docs, password reset and email verification config)
- [Email Concepts](https://better-auth.com/docs/concepts/email) -- HIGH confidence (email delivery overview)
- [Email OTP Plugin](https://better-auth.com/docs/plugins/email-otp) -- MEDIUM confidence (alternative approach, not recommended for this use case)

### Pagination
- [Cursor Pagination for PostgreSQL: Complete Developer Guide 2025](https://bun.uptrace.dev/guide/cursor-pagination.html) -- HIGH confidence
- [Five ways to paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/) -- HIGH confidence (canonical reference)
- [Keyset Cursors, Not Offsets, for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) -- HIGH confidence
- [Understanding Cursor Pagination and Why It's So Fast](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive) -- MEDIUM confidence

### Next.js Patterns
- [Implementing Infinite Scroll in Next.js with Server Actions](https://blog.logrocket.com/implementing-infinite-scroll-next-js-server-actions/) -- MEDIUM confidence
- [How to Style Active Links in Next.js App Router](https://spacejelly.dev/posts/how-to-style-active-links-in-next-js-app-router) -- MEDIUM confidence
- [Next.js Learn: Navigating Between Pages](https://nextjs.org/learn/dashboard-app/navigating-between-pages) -- HIGH confidence (official tutorial)

### Drizzle ORM
- [Drizzle ORM Filters (inArray)](https://orm.drizzle.team/docs/operators) -- HIGH confidence (official docs)
- [Drizzle ORM Batch API](https://orm.drizzle.team/docs/batch-api) -- HIGH confidence (official docs)

### Email Verification
- [Implementing the Right Email Verification Flow](https://supertokens.com/blog/implementing-the-right-email-verification-flow) -- MEDIUM confidence
- [Why SaaS Signups Need Email Verification](https://unwrap.email/blogs/why-saas-signups-need-email-verification) -- MEDIUM confidence

### Deduplication
- [PostgreSQL Unique Constraint](https://www.vervecopilot.com/interview-questions/can-postgres-unique-constraint-be-your-secret-weapon-for-robust-database-design) -- MEDIUM confidence
- [PostgreSQL Data Deduplication Methods](https://www.alibabacloud.com/blog/postgresql-data-deduplication-methods_596032) -- MEDIUM confidence

---
*Feature research for: HeavyLeads v2.1 Bug Fixes & Hardening*
*Researched: 2026-03-15*
