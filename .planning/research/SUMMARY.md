# Project Research Summary

**Project:** HeavyLeads v2.1 Bug Fixes & Hardening
**Domain:** Multi-tenant B2B SaaS — live production hardening milestone
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

HeavyLeads v2.1 is a hardening and bug-fix milestone on a live production app, not a greenfield build. The product already runs on a validated, deployed stack (Next.js, better-auth, Drizzle, Neon, Vitest, Resend, Vercel). Research confirmed that zero new dependencies are required — all eight target features are achievable with the existing library set. The strategic constraint is sequencing: some changes (enabling `requireEmailVerification: true`) are operationally disruptive and must land after prerequisites (password reset as a recovery path, data migration marking existing users verified) to avoid locking out every existing user the moment the deploy lands on a live production app.

The recommended approach is a four-phase build ordered around risk: (1) establish a regression test safety net first — zero production code changes, and the testing infrastructure is already mature, (2) make the four isolated query optimizations that carry no user-facing risk and benefit from the safety net, (3) implement the auth flows in the correct deployment order — forgot password before email verification — so there is always a recovery path when the verification flag is enabled, (4) finish with UI polish. The biggest architectural complexity is pagination: the existing FETCH_MULTIPLIER pipeline (over-fetch at SQL level, enrich and score in memory, slice to limit) is incompatible with naive SQL-level offset pagination and must be accounted for by paginating the in-memory enriched result set, not the raw SQL output.

The highest-risk change in the milestone is enabling `requireEmailVerification`. It requires a one-time SQL migration (`UPDATE "user" SET email_verified = true`) deployed to Neon before the code change, and must land in the same release as — or after — the forgot password feature, never before it. Secondary risks are the bookmarks batch query (must preserve full enrichment or every lead card crashes at render time), the dedup improvement (must use `sourceUrl` as a supplementary signal, not the sole dedup key, to avoid collapsing multiple distinct projects scraped from one URL), and the env var / URL-construction pattern that has caused production issues before (`.trim()` all env vars; use relative `redirectTo` paths in auth client calls).

---

## Key Findings

### Recommended Stack

All three v2.1 feature areas are fully covered by the installed dependency set. STACK.md verified this against official Drizzle ORM, better-auth, and Next.js/Vitest documentation. The existing testing infrastructure (Vitest 4.1.0, @testing-library/react, jsdom, vitest.config.ts with manual path aliases, 6 test helper modules) and 40+ existing test files are sufficient. The established mocking pattern (`vi.mock("@/lib/db")`, `vi.mock("@/lib/auth")`, `vi.mock("next/headers")`, `vi.mock("next/cache")`) covers server action testing completely.

**Core technologies:**
- Vitest 4.1.0: test runner — existing pattern fully covers server action and pure-function unit testing; no new config changes needed beyond adding `"test": "vitest"` to package.json scripts
- better-auth 1.5.5: auth library — `sendResetPassword` and `emailVerification` callbacks are built-in `emailAndPassword` and `emailVerification` config options; no additional plugins required
- Drizzle ORM 0.45.1: database layer — `inArray()` (batch queries), `count(*)` (pagination count), and `gt`/`lt` (cursor pagination) are already importable from `drizzle-orm`
- Resend 6.9.3: email sending — two new email types reuse the existing `send-digest.ts` integration pattern exactly

**Dependencies explicitly researched and rejected:** `vite-tsconfig-paths` (existing manual alias config works identically — switching is churn), `drizzle-cursor`, `drizzle-pagination`, `@testing-library/user-event`, `playwright`, `better-auth-ui`.

**Configuration-only changes required:**
- `src/lib/auth.ts`: add `sendResetPassword` callback to `emailAndPassword` block + new top-level `emailVerification` config block
- `src/lib/leads/queries.ts`: modify `getFilteredLeads` to accept cursor/pagination params; add `getLeadsByIds` and `countFilteredLeads` functions
- `package.json`: add `"test": "vitest"` script (currently absent)

### Expected Features

FEATURES.md assessed all 8 target features against B2B SaaS production standards. All 8 are table-stakes or high-impact changes; none are safely deferrable.

**Must have (table stakes):**
- Regression tests for 15 v2.0 bug fixes — without these, every subsequent change in this milestone risks silent regression; P0 safety net; 8-12 hours
- Forgot password flow — locked-out users on a solo-founder product with no support channel churn permanently; two pages + one auth config callback; LOW complexity, 2-3 hours
- Email verification on signup — protects Resend sender reputation, prevents fake accounts; recommended as delayed-not-blocking (dashboard access allowed, digest subscription gated on verified email); LOW-MEDIUM, 3-4 hours
- Lead feed pagination — current 50-lead hard cap makes dense metro areas invisible to users; cursor/offset hybrid; MEDIUM, 6-8 hours
- Active nav highlighting (desktop) — mobile already highlights correctly; desktop inconsistency creates cognitive dissonance; extract to client component; 30 minutes
- Bookmarks batch query — N+1 (up to 21 queries) degrades linearly; replace with single `inArray` query; LOW-MEDIUM, 2-3 hours

**Should have (quality/scale):**
- Digest email query optimization — N*M query pattern (per-search per-user) risks Vercel timeout at scale; batch company profile lookup + union query per user; MEDIUM, 3-4 hours
- Non-permit dedup via sourceUrl — current `NULL` permitNumber unique index allows duplicate non-permit leads through; two-part fix: partial unique index + application-level pre-check; LOW-MEDIUM, 2-3 hours

**Defer to v2+:**
- Total lead count display in pagination header, bookmark count badge in sidebar nav (both polish, addable opportunistically)
- E2E testing (Playwright/Cypress), OAuth/social login, middleware auth guard, full-text search index, password complexity rules beyond 8-char minimum

**Validated UX decisions:**
- Email verification: `requireEmailVerification: false` (delayed, not blocking dashboard) — correct for B2B with 5-step onboarding and 7-day trial
- Pagination: "Load more" button (not infinite scroll, not traditional page numbers) — simpler state management, works with server components, avoids Intersection Observer complexity
- Pagination cursor key: `(scrapedAt, id)` at SQL level; score sort preserved in-memory per-batch (score is not a database column)

### Architecture Approach

The system is a standard Next.js App Router multi-tenant SaaS. ARCHITECTURE.md mapped all 8 features against 25+ source files via direct codebase inspection. The key finding is that v2.1 produces approximately 15 new files and 11 modified files with zero new database tables and one new index. Every change fits cleanly into existing layer boundaries: auth config callbacks wire into the existing `/api/auth/[...all]` catch-all (no new API routes needed), email senders follow the `send-digest.ts` pattern, query functions extend `queries.ts`, and the nav client component extraction mirrors the existing `MobileNav` pattern exactly.

**Major component changes:**
1. `src/lib/auth.ts` (MODIFIED) — add `sendResetPassword` + `emailVerification` callbacks; these are the only auth-layer changes needed
2. `src/lib/leads/queries.ts` (MODIFIED + NEW FUNCTIONS) — add `getLeadsByIds` (batch), `countFilteredLeads` (pagination count); modify `getFilteredLeads` to accept pagination params
3. `src/lib/email/` (NEW FILES) — `send-password-reset.ts` and `send-verification.ts` following existing `send-digest.ts` pattern
4. `src/components/emails/` (NEW FILES) — `password-reset.tsx` and `verify-email.tsx` React Email templates
5. `src/app/(auth)/` (NEW ROUTES) — `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`
6. `src/components/dashboard/sidebar-nav.tsx` + `nav-links.ts` (NEW) — client component + shared nav constant extracted from `MobileNav`
7. `src/lib/email/digest-generator.ts` (MODIFIED) — batch company profile lookup; one broad union query per user
8. `src/lib/scraper/dedup.ts` + `pipeline.ts` (MODIFIED) — two-phase sourceUrl check before existing fuzzy geo+text dedup
9. `tests/**/*.test.ts` (NEW — 15+ files) — pure test files; zero production code changes for this deliverable

**Critical architectural constraint — FETCH_MULTIPLIER and pagination:** The existing `getFilteredLeads` over-fetches `limit * 4` rows at SQL level, enriches and scores in memory, then slices to the limit. SQL-level offset does not correspond to user-visible page boundary because score sort is in-memory. Correct approach: offset applies to the in-memory enriched result array, not to SQL. The nationwide fallback (currently fires when `leads.length === 0`) must be suppressed for page > 1.

### Critical Pitfalls

PITFALLS.md identified 5 critical pitfalls (production-outage class) and 11 moderate/minor pitfalls, all verified against specific line numbers in the codebase.

1. **`requireEmailVerification` locks out all existing users** — SQL migration (`UPDATE "user" SET email_verified = true`) MUST deploy before the code change enabling the flag. Forgot password must be live before verification is enabled. Test against a Vercel preview with an existing account before merging to main. (PITFALL 1)

2. **FETCH_MULTIPLIER breaks naive SQL-level pagination** — offset pagination at the SQL layer with `FETCH_MULTIPLIER=4` means page 2 skips 200 raw rows (not the 50 the user expects), and the score-based sort order is not preserved across pages. Solution: over-fetch the full candidate pool per page, enrich and sort in memory, slice to the page window from the enriched result. Disable nationwide fallback when `page > 1`. (PITFALL 3)

3. **Bookmarks batch query must preserve enrichment** — a naive `SELECT * WHERE id IN (...)` returns raw database rows; `LeadCard` expects enriched fields (`inferredEquipment`, `score`, `freshness`, `timeline`, `distance`). Must extract `enrichLead(row, params)` as a shared function and map it over batch results before returning. (PITFALL 4)

4. **Password reset URL misconfiguration silently breaks account recovery** — `redirectTo` in the client `forgetPassword()` call must be a relative path (`/reset-password`), not an absolute URL. Log the generated reset URL in the `sendResetPassword` callback during development. Test end-to-end on the deployed Vercel domain before declaring done. `.trim()` on `BETTER_AUTH_URL` is already in place in auth.ts. (PITFALL 2)

5. **`sourceUrl`-only dedup over-merges distinct projects** — one news article or search result page can reference multiple distinct projects under a single URL. Using `sourceUrl` as the sole dedup key collapses those distinct leads into one. Use as a supplementary signal: dedup key is `(sourceId + sourceUrl + externalId)` with fallback to `(sourceId + title)`. Only apply to newly scraped leads — retroactive dedup deletes bookmarked leads via cascade FK. (PITFALLS 8, 11)

---

## Implications for Roadmap

Four phases are warranted. Sequencing is driven by: (a) safety-net-first principle, (b) the auth deployment constraint (password reset before email verification), and (c) risk isolation (query changes are independent and low-risk; auth changes are higher-risk and coupled to each other).

### Phase 1: Regression Test Safety Net

**Rationale:** Fifteen v2.0 bug fixes shipped without test coverage. Every subsequent code change in this milestone risks silent regression. The testing infrastructure is already mature — this phase adds only test files, zero production code changes. It establishes the safety net before any behavior is changed.

**Delivers:** 15 regression tests covering all v2.0 post-rework fixes; confirmed `npm run test` script; validated mocking patterns for all server action test types.

**Addresses:** Regression tests (P0 from FEATURES.md).

**Avoids:** Vitest `server-only` import cascade failure (PITFALL 5 — must establish `vi.mock` strategy for `next/headers`, `next/cache`, `@/lib/auth`, `@/lib/db` before writing any server action tests), accidental production Neon database access in tests (PITFALL 13 — add `DATABASE_URL` guard to setup file).

**Implementation notes:** Test pure functions first (no mocking needed: `haversineDistance`, `scoreLead`, `inferEquipmentNeeds`, `normalizeText`, `isLikelyDuplicate`, `getFreshnessBadge`, `getTrialStatus`); then mocked server actions; do NOT attempt to test async server page components (not supported by Vitest).

**Research flag:** Standard patterns — skip `/gsd:research-phase`. Vitest mocking is demonstrated by 40+ existing test files.

### Phase 2: Query Optimizations

**Rationale:** Four isolated, low-risk query improvements that do not touch auth, do not affect user sessions, and each have a clear before/after comparison. They share a common pattern (add a function to `queries.ts`, update the call site). Phase 1 safety net must be in place before merging these.

**Delivers:**
- Bookmarks page: 21 queries collapsed to 2 via `getLeadsByIds` with `inArray`
- Digest generator: N per-user SQL queries reduced to 1 via union query + in-memory filter
- Non-permit dedup: exact sourceUrl pre-check before fuzzy dedup; partial unique index on `(sourceId, sourceUrl)` where sourceUrl is not null
- Lead feed: cursor/offset hybrid pagination with "Load more" button; `countFilteredLeads` for total count display

**Avoids:** Bookmarks enrichment crash (PITFALL 4 — extract `enrichLead()` from `getLeadById()` first, then batch), FETCH_MULTIPLIER pagination collision (PITFALL 3 — in-memory slice after enrichment, not SQL offset), sourceUrl over-dedup (PITFALL 8 — compound key), retroactive dedup deleting bookmarks (PITFALL 11 — new leads only), digest Vercel timeout (PITFALL 7 — batch profile lookup with Map cache), scroll position loss post-mutation (PITFALL 9 — accept as known limitation for v2.1, document it).

**Recommended internal order:** bookmarks batch (smallest, most isolated) → digest optimization (similar batch pattern, more complex refactor) → sourceUrl dedup (requires schema migration + deployment window) → pagination (largest scope, touches main dashboard page and introduces new server action).

**Research flag:** Standard patterns — skip `/gsd:research-phase`. Exception: the FETCH_MULTIPLIER pagination interaction is non-obvious; implementation should include a code comment explaining the in-memory pagination approach and why SQL-level offset is not used.

### Phase 3: Auth Flows

**Rationale:** The auth features are the highest-risk changes in the milestone. Forgot password deploys first; email verification deploys second. This is non-negotiable: enabling `requireEmailVerification: true` without an operational password recovery path creates a potential permanent lockout scenario for users who receive corrupted or expired verification links.

**Delivers:**
- Forgot password: `/forgot-password` + `/reset-password` pages, `sendResetPassword` callback in `auth.ts`, password reset email template
- Email verification: `sendVerificationEmail` callback in `auth.ts`, `requireEmailVerification: true` (with migration), `/verify-email` interstitial page, non-blocking amber dashboard banner, digest-enable gate checking `emailVerified`

**Critical deployment prerequisite:** SQL migration `UPDATE "user" SET email_verified = true WHERE email_verified IS NULL OR email_verified = false` must execute against Neon BEFORE the deploy that enables `requireEmailVerification: true`. This is a hard blocker.

**Sign-up flow structural change:** Currently sign-up creates user + org in one step. With email verification, sign-up creates user only → user verifies → first dashboard visit has no org → redirect to `/onboarding` for org creation (existing path). This separation avoids creating orphaned orgs for users who never verify. The onboarding route must handle both new users (no org) and returning verified users (already have org — skip to dashboard).

**Avoids:** Existing user lockout (PITFALL 1 — migration first), reset URL misconfiguration (PITFALL 2 — relative `redirectTo`, log URL in dev, manual end-to-end test on Vercel), deploying verification before password reset (PITFALL 6 — staged deployment), timing attack on email sends (PITFALL 14 — `void sendEmail()` fire-and-forget or `after()`), spam delivery (PITFALL 16 — configure custom Resend domain before launch), route collision (PITFALL 12 — pages in `(auth)` group, never under `/api/auth/`).

**Recommended internal order:** forgot password complete and tested → SQL migration deployed to Neon → email verification enabled in same or next deploy.

**Research flag:** better-auth auth flows are well-documented. No `/gsd:research-phase` needed. Implementation focus: the sign-up form structural change (defer org creation) needs careful testing to ensure the onboarding redirect guard handles both new and returning users correctly.

### Phase 4: UI Polish

**Rationale:** Lowest risk, zero dependencies on other phases. Trivial `usePathname()` client component extraction that mirrors existing `MobileNav` pattern exactly. Placed last so it does not consume time that could block higher-priority work, and the codebase is fully tested before touching the layout.

**Delivers:** Active nav highlighting on desktop sidebar via `SidebarNav` client component; shared `nav-links.ts` constant that keeps desktop and mobile nav link definitions in sync.

**Avoids:** Breaking the server component dashboard layout by converting it to a client component (ARCHITECTURE.md anti-pattern — extract nav only, keep layout server), nested route matching failure (PITFALL 15 — use `pathname.startsWith(href)` for parent nav items, exact match only for `/dashboard` root).

**Research flag:** Standard pattern already in codebase via `MobileNav` — skip `/gsd:research-phase`.

### Phase Ordering Rationale

- Tests before code changes: every query and auth refactor in Phases 2-3 risks regression without the Phase 1 safety net
- Query optimizations before auth: query changes are isolated and independently testable; auth changes have a deployment-order dependency that adds coordination overhead — doing auth second keeps Phase 2 unblocked
- Forgot password before email verification: non-negotiable operational safety constraint; violating this order risks locking all users out of the live production app
- UI polish last: no dependencies, no risk, does not gate anything else

### Research Flags

No additional `/gsd:research-phase` is needed for any phase. All patterns are either well-documented in official sources or already demonstrated in the codebase:

- Phase 1: Vitest mocking demonstrated by 40+ existing test files
- Phase 2: Drizzle query patterns in official docs; FETCH_MULTIPLIER pagination behavior documented in PITFALLS.md
- Phase 3: better-auth email flow in official docs; risks are deployment-order and operational, not technical unknowns
- Phase 4: `usePathname()` pattern already in the codebase via `MobileNav`

One area requiring extra care during implementation (not additional research): the pagination + FETCH_MULTIPLIER interaction and the nationwide fallback guard. The logic is fully understood but the code path in `getFilteredLeads` and `dashboard/page.tsx` is non-obvious; the implementation should add a comment explaining the in-memory pagination approach.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed against official docs and existing codebase; all capabilities pre-installed and in use |
| Features | HIGH | All 8 features verified against official docs and 25+ source files; effort estimates grounded in direct code inspection |
| Architecture | HIGH | Component modification map covers all 8 features with specific line-number references; 25+ source files inspected directly |
| Pitfalls | HIGH | 5 critical pitfalls with codebase line references; all major ones have confirmed prevention strategies from official docs and GitHub issues |

**Overall confidence:** HIGH

### Gaps to Address

- **FETCH_MULTIPLIER deep-page over-fetch formula:** The recommended in-memory pagination approach is correct but the exact SQL fetch size for page N needs validation during implementation. Guidance: fetch `(page * pageSize + pageSize) * FETCH_MULTIPLIER` rows from SQL. Verify this produces correct results at page 3+ and that the nationwide fallback guard triggers correctly at the boundary.

- **sourceUrl dedup adapter audit:** PITFALLS.md flags that some adapters may produce multiple projects per URL (news aggregators, Google dorking search result pages). The exact URL patterns per adapter are not fully characterized. Mitigation: implement compound key `(sourceId + sourceUrl + externalId)` with fallback to `(sourceId + title)`; run new dedup logic against existing data in dry-run mode before enabling on the live pipeline.

- **Sign-up flow org-creation refactor edge case:** Moving org creation from `sign-up-form.tsx` to post-verification onboarding is architecturally clean but introduces a flow guard: returning verified users who already have an org must not be re-directed to `/onboarding`. The onboarding layout guard needs to handle this case — it likely already does (checks for existing org), but must be verified.

- **Custom Resend domain status:** PITFALL 16 flags that `onboarding@resend.dev` goes to spam for corporate email filters. Password reset and email verification emails landing in spam defeats the features entirely. Verify whether a custom sending domain (e.g., `noreply@heavyleads.com`) with SPF/DKIM/DMARC is configured in Resend before enabling these features in production. The env var `RESEND_FROM_EMAIL` controls the from address — setting it is sufficient if the domain is already verified in Resend.

---

## Sources

### Primary (HIGH confidence)
- [better-auth Email & Password Docs](https://better-auth.com/docs/authentication/email-password) — `sendResetPassword`, `requireEmailVerification`, `forgetPassword`/`resetPassword` client methods
- [better-auth Email Concepts](https://better-auth.com/docs/concepts/email) — `sendVerificationEmail`, `sendOnSignUp`, `autoSignInAfterVerification`, timing attack guidance
- [Drizzle ORM Cursor-Based Pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) — official cursor guide
- [Drizzle ORM Offset Pagination](https://orm.drizzle.team/docs/guides/limit-offset-pagination) — official offset guide
- [Drizzle ORM Operators (inArray)](https://orm.drizzle.team/docs/operators) — batch query pattern
- [Next.js Vitest Testing Guide](https://nextjs.org/docs/app/guides/testing/vitest) — official Vitest setup, async server component limitation
- [Next.js `after()` Function Docs](https://nextjs.org/docs/app/api-reference/functions/after) — background task scheduling for serverless email sends
- Codebase analysis of 25+ source files — direct inspection of `src/lib/auth.ts`, `src/lib/leads/queries.ts`, `src/actions/bookmarks.ts`, `src/lib/scraper/dedup.ts`, `src/lib/email/digest-generator.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `tests/setup.ts`, `tests/helpers/*.ts`

### Secondary (MEDIUM confidence)
- [better-auth Issue #3461](https://github.com/better-auth/better-auth/issues/3461) — invalid token errors from URL misconfiguration
- [better-auth Issue #2082](https://github.com/better-auth/better-auth/issues/2082) — forget password flow edge cases
- [Next.js GitHub Issue #49087](https://github.com/vercel/next.js/issues/49087) — scroll position reset on `revalidatePath` after pagination
- [Next.js GitHub Issue #60038](https://github.com/vercel/next.js/issues/60038) — server-only + Vitest incompatibility
- [Email verification with better-auth + Resend tutorial](https://dev.to/daanish2003/email-verification-using-betterauth-nextjs-and-resend-37gn) — practical setup
- [Forgot/reset password with better-auth + Resend tutorial](https://dev.to/daanish2003/forgot-and-reset-password-using-betterauth-nextjs-and-resend-ilj) — client-side token extraction pattern
- [Five ways to paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/) — canonical reference
- [Keyset Cursors, Not Offsets, for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) — cursor pagination rationale

### Tertiary (MEDIUM confidence)
- [Google AIP-158](https://google.aip.dev/158) — pagination design guidance
- [Slack Engineering: Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/) — real-world migration lessons
- [Vercel waitUntil Docs](https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions) — background task execution on serverless

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
