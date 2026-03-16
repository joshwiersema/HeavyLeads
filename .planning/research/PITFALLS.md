# Domain Pitfalls: v2.1 Bug Fixes & Hardening

**Domain:** Adding regression tests, auth features, pagination, query optimization, and dedup improvements to a LIVE production Next.js SaaS app
**Project:** HeavyLeads v2.1 Bug Fixes & Hardening
**Researched:** 2026-03-15
**Confidence:** HIGH (verified against codebase analysis, official docs, and GitHub issues)

**CRITICAL CONTEXT:** The production app is live at heavy-leads.vercel.app. An env validation module added to db/index.ts just caused a production 500. Every change must be safe.

---

## Critical Pitfalls

Mistakes that cause production outages, data corruption, or user lockout on a live app.

---

### Pitfall 1: Enabling `requireEmailVerification` Locks Out Existing Users

**What goes wrong:** When you flip `requireEmailVerification: true` in better-auth's `emailAndPassword` config, every sign-in attempt calls `sendVerificationEmail`. Existing users who signed up before this flag was enabled have `emailVerified: false` (or null) in the database. They cannot log in. On a live app with active users, this is an instant lockout.

**Why it happens:** better-auth treats email verification as a gate on sign-in, not just on sign-up. The better-auth docs state: "If you enable require email verification, users must verify their email before they can log in, and every time a user tries to sign in, the `sendVerificationEmail` function is called." There is no built-in migration path for existing users -- the flag is binary.

**Consequences:** Every existing user (including the admin account) is locked out of the production app immediately upon deploy. The app appears broken. Rolling back requires a redeploy.

**Warning signs:** Test sign-in with an existing account in a Vercel preview deploy. If sign-in redirects to "verify your email" or fails silently, the migration was missed.

**Prevention:**
1. Before enabling `requireEmailVerification`, run a SQL migration to mark all existing users as verified: `UPDATE "user" SET "email_verified" = true WHERE "email_verified" IS NULL OR "email_verified" = false;`
2. Deploy the migration BEFORE deploying the code change that enables the verification flag.
3. Test the full flow locally with a fresh account to confirm the verification email sends, the link works, and the callback URL resolves correctly on Vercel.
4. For the admin account specifically, verify it is marked as `email_verified = true` before enabling the flag.

**Phase mapping:** Email verification feature -- the DB migration is a hard prerequisite, not an optional cleanup step.

**Confidence:** HIGH -- better-auth docs explicitly confirm this behavior, and there is no exemption for pre-existing accounts.

---

### Pitfall 2: Password Reset Token URL Points to Wrong Domain or Contains Invalid Token

**What goes wrong:** better-auth's `sendResetPassword` callback receives a `url` parameter containing the reset link. This URL is constructed from the `baseURL` config. If `BETTER_AUTH_URL` is misconfigured, blank, or has a trailing newline (a known issue in this project -- see the env var feedback note about Vercel paste adding trailing `\n`), the reset link in the email either 404s or points to localhost. Additionally, better-auth issue #3461 documents "invalid token for every reset password request" when the URL is malformed.

**Why it happens:** The reset URL is generated server-side using `baseURL`. In the current auth config, `baseURL` is `(process.env.BETTER_AUTH_URL ?? "").trim()`. The `.trim()` is already there (good), but the `redirectTo` parameter on the client-side `forgetPassword` call must be a relative path (e.g., `/reset-password`), not an absolute URL. better-auth appends it to `baseURL`. If the client sends an absolute URL, the token gets appended to a double-host URL and becomes unparseable.

**Consequences:** Password reset flow is silently broken in production. Users cannot recover their accounts. No server-side error is visible because the email sends successfully -- only the link target is wrong.

**Warning signs:** Send a real password reset email to a test account on the deployed app. Click the link. If it 404s, redirects to localhost, or shows "Invalid token," the URL construction is broken.

**Prevention:**
1. The client-side `forgetPassword` call must use `redirectTo: "/reset-password"` (relative path), not `redirectTo: "https://heavy-leads.vercel.app/reset-password"`.
2. Log the generated reset URL in the `sendResetPassword` callback during development to visually confirm the URL shape.
3. After deployment, manually trigger a password reset and click the email link to verify it works end-to-end on the production domain.
4. The reset password page must extract the token from URL searchParams: `const token = new URLSearchParams(window.location.search).get("token")` -- if this returns null, the URL was malformed.

**Phase mapping:** Forgot password flow -- must include manual end-to-end verification as a deployment checklist item.

**Confidence:** HIGH -- the project already has a history of env var issues (trailing newlines breaking API clients), and better-auth issue #3461 documents token errors caused by URL misconfiguration.

---

### Pitfall 3: Adding Pagination Breaks the FETCH_MULTIPLIER Enrichment Pipeline and Nationwide Fallback

**What goes wrong:** The current dashboard page fetches leads in one call to `getFilteredLeads()`, which over-fetches by `FETCH_MULTIPLIER = 4`, applies in-memory scoring and equipment filtering, sorts by score, and slices to a limit. Adding offset-based pagination naively (passing `page` as a SQL offset) breaks the pipeline in three ways:

1. **FETCH_MULTIPLIER collision:** The query already fetches `limit * 4` rows and slices to `limit` after enrichment. If you pass `offset = page * limit` to SQL, page 2 would skip `50 * 4 = 200` database rows (not the 50 the user expects), creating huge gaps.
2. **Sort order mismatch:** SQL orders by `scrapedAt DESC`, but the final user-visible order is `score DESC`. Row 51 by `scrapedAt` might be row 3 by score. SQL-level offset does not correspond to the user-visible page boundary.
3. **Nationwide fallback fires incorrectly:** The nationwide fallback triggers when `leads.length === 0`. If page 2 of a paginated query legitimately returns zero leads (end of results), the fallback fires and shows nationwide leads instead of "no more results."

**Why it happens:** The current query architecture is "fetch everything, enrich in memory, sort by score, slice." Pagination assumes "fetch page N from the database." These two models are fundamentally incompatible without restructuring how pagination interacts with enrichment.

**Consequences:** Users see duplicate leads across pages, missing high-score leads, or a sudden jump to nationwide results on page 2. The feed becomes unreliable.

**Warning signs:** After implementing pagination, navigate to page 2. If you see leads that were also on page 1, or if the page shows "Showing leads nationwide" unexpectedly, the pagination is interacting with FETCH_MULTIPLIER or the fallback incorrectly.

**Prevention:**
1. Do NOT pass a user-facing `offset` directly to the SQL query. Instead, continue to over-fetch with FETCH_MULTIPLIER, enrich and sort in memory, then slice to the requested page window: `enriched.slice(pageOffset, pageOffset + pageSize)`.
2. Return a `hasMore` boolean or `totalCount` alongside the leads so the UI knows when to stop paginating. Compute this from the in-memory enriched array length, not from the SQL row count.
3. Disable the nationwide fallback when a `page` parameter is present (page > 1). It should only fire on page 1 with no filters.
4. Increase the over-fetch amount when pagination is active so deeper pages have enough candidates after in-memory filtering. For example, fetch `(page * pageSize + pageSize) * FETCH_MULTIPLIER` rows from SQL.

**Phase mapping:** Lead feed pagination (BUG 13) -- must account for the existing FETCH_MULTIPLIER architecture. This is not a simple "add .offset() to the query" change.

**Confidence:** HIGH -- the FETCH_MULTIPLIER pattern is visible in `queries.ts` line 223 and the slice at line 375. The nationwide fallback is in `dashboard/page.tsx` lines 158-172.

---

### Pitfall 4: Bookmarks Batch Query Drops Enrichment, Crashing LeadCard Components

**What goes wrong:** The bookmarks page currently calls `getLeadById()` in a loop (N+1 at `bookmarks/page.tsx` lines 43-52). Each call fetches the row AND enriches it with `inferredEquipment`, `score`, `freshness`, `timeline`, and `distance`. Replacing this with a batch `SELECT * FROM leads WHERE id IN (...)` query returns raw database rows without enrichment. The `LeadCard` component expects enriched fields. Accessing `lead.inferredEquipment.some(...)` on an undefined field throws a runtime error on every card.

**Why it happens:** `getLeadById()` does two things: (1) fetches the row from the database, (2) enriches it by calling `inferEquipmentNeeds()`, `scoreLead()`, `getFreshnessBadge()`, and `mapTimeline()`. A naive batch query only does step 1. The enrichment logic is embedded inside `getLeadById()` (lines 400-432 in `queries.ts`) and is not extracted into a reusable function.

**Consequences:** The bookmarks page throws runtime errors for every lead card. Since this is a server component, the error boundary catches it and users see the error state instead of their bookmarks.

**Warning signs:** After replacing the N+1, render the bookmarks page with at least 2 bookmarked leads. If any card shows "undefined" for score, equipment, or freshness, or if the error boundary fires, enrichment was skipped.

**Prevention:**
1. Extract the enrichment logic from `getLeadById()` into a standalone `enrichLead(row, params)` function that can be called on any raw lead row.
2. The batch query should be: `SELECT * FROM leads WHERE id IN (...)`, followed by `rows.map(row => enrichLead(row, params))`.
3. For distance computation, the batch version needs the same haversine calculation that `getLeadById()` does (using the company profile's HQ coordinates).
4. Write a regression test that compares the output of batch enrichment against `getLeadById()` output for the same lead to verify shape compatibility.

**Phase mapping:** Bookmarks batch query (BUG 14) -- must refactor enrichment into a shared function before changing the query pattern.

**Confidence:** HIGH -- the coupling is visible in `queries.ts` lines 387-433 and `bookmarks/page.tsx` lines 43-52.

---

### Pitfall 5: Vitest Cannot Import Server Components, Server Actions, or `next/headers`

**What goes wrong:** Importing any file that transitively imports `next/headers`, `next/cache`, or uses `"use server"` into a Vitest test throws a build error. This project's server actions (bookmarks, lead-status, onboarding, billing, saved-searches, settings) all use `auth.api.getSession({ headers: await headers() })`. The auth module imports `better-auth` and `drizzle-orm`. The db module requires `DATABASE_URL`. Naive test imports cascade into the entire server dependency graph and crash immediately.

**Why it happens:** Vitest runs in a Node/jsdom environment, not the Next.js server runtime. The `server-only` package throws when imported outside server context. The `next/headers` module requires the Next.js request context. The Next.js official Vitest docs explicitly state: "Since async Server Components are new to the React ecosystem, Vitest currently does not support them."

**Consequences:** Tests fail to compile. All 15 planned regression tests are blocked if the mocking strategy is not established first.

**Warning signs:** First `vitest --run` fails with `This module cannot be imported from a Client Component module` or `Cannot find module 'next/headers'`.

**Prevention:**
1. **Test pure logic separately from Next.js plumbing.** This codebase has excellent testable pure functions that need zero mocking: `haversineDistance`, `filterByEquipment`, `buildFilterConditions`, `applyInMemoryFilters`, `normalizeText`, `isLikelyDuplicate`, `scoreLead`, `inferEquipmentNeeds`, `mapTimeline`, `getFreshnessBadge`. These cover the core business logic and should be the primary test targets.
2. **For server action tests, mock the entire dependency chain.** At the top of any test file that touches server code:
   ```ts
   vi.mock("next/headers", () => ({ headers: vi.fn() }));
   vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
   vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
   vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), query: {} } }));
   ```
3. **Do NOT import page components into Vitest.** Every page in this app is an async server component. Test page-level behavior with E2E tests only.
4. **Add a `server-only` mock** to the Vitest config so it does not throw:
   ```ts
   // vitest.config.ts resolve.alias
   'server-only': fileURLToPath(new URL('./__mocks__/server-only.ts', import.meta.url))
   ```
   Where `__mocks__/server-only.ts` is an empty file.
5. **Structure test files by layer:** `__tests__/unit/` for pure functions (no mocking needed), `__tests__/integration/` for mocked server actions.

**Phase mapping:** Regression tests -- this is THE first task. The mocking infrastructure must be established before any individual test can be written.

**Confidence:** HIGH -- confirmed by Next.js official Vitest docs, GitHub issue #60038, and the project architecture where every page uses `await auth.api.getSession()`.

---

## Moderate Pitfalls

Mistakes that cause bugs, degraded UX, or rework but are recoverable.

---

### Pitfall 6: Offset Pagination + Concurrent Scraping Causes Duplicate/Missing Leads Across Pages

**What goes wrong:** If new leads are scraped between page 1 and page 2 requests (via the daily cron or manual Refresh Leads), offset-based pagination can show the same lead on both pages or skip a lead. The scoring sort adds another dimension: if a newly scraped lead scores higher than existing leads, it shifts the entire ranking.

**Why it happens:** Offset pagination is positional. When rows are inserted or deleted before the offset boundary, all subsequent rows shift. This is a fundamental limitation of offset-based pagination with mutable data, documented by Google AIP-158 and Drizzle ORM's own pagination guide.

**Warning signs:** Scrape leads, view page 1, scrape again, view page 2. Check if any lead appears on both pages or if a lead from page 1 is missing when you go back.

**Prevention:**
1. At current data volumes (< 100k leads) and scraping frequency (daily cron), this is a minor UX issue. Accept it for v2.1.
2. Document it as a known limitation in the code.
3. For future improvement, switch to cursor-based pagination using `(score, scrapedAt, id)` as a composite cursor. Drizzle ORM has a dedicated cursor pagination guide.
4. The in-memory pagination approach (Pitfall 3 prevention) partially mitigates this: since we fetch a large batch and paginate in memory within a single request, the data is at least consistent within one page load.

**Phase mapping:** Lead feed pagination (BUG 13) -- document as known limitation, not a blocker.

**Confidence:** MEDIUM -- well-documented limitation of offset pagination, but practical impact at current scale is low.

---

### Pitfall 7: Digest Email N+1 Becomes N*M with Multiple Saved Searches, Risking Vercel Timeout

**What goes wrong:** `generateDigests()` runs `getFilteredLeads()` once per saved search per user (inner loop at `digest-generator.ts` line 108-129). Each call runs a full Haversine-distance SQL query, fetches `limit * FETCH_MULTIPLIER` rows, and performs in-memory enrichment. If a user has 5 digest-enabled saved searches, that is 5 full lead queries. With 20 users averaging 3 searches each = 60 full lead queries on one function invocation.

**Why it happens:** Each saved search has different filter parameters (radius, equipment, keyword, date range), so they cannot trivially be merged into one SQL query. The digest generator also queries `companyProfiles` once per user group in the loop (line 87), adding more serial database calls.

**Warning signs:** The `/api/email-digest` endpoint execution time exceeds 5 seconds with < 10 users. Vercel logs show timeout errors on the digest cron.

**Prevention:**
1. Batch the company profile lookup: fetch all relevant org profiles in one query before the user loop, index them by orgId.
2. For the lead queries, consider a two-phase approach: (a) run a single broad query per org (max radius, no filters, last 24h), (b) apply each saved search's filters in memory against the cached result set using the existing `applyInMemoryFilters()` and `filterByEquipment()` functions.
3. Add `console.time`/`console.timeEnd` around the digest endpoint to monitor performance from the start.
4. Set `export const maxDuration = 60;` on the digest API route.

**Phase mapping:** Digest email query optimization (BUG 10) -- batch the profile lookup first, then consider the two-phase approach.

**Confidence:** MEDIUM -- the N*M pattern is visible in the code, but actual impact depends on user count which is currently low.

---

### Pitfall 8: Non-Permit Dedup by `sourceUrl` Alone Over-Merges Distinct Projects

**What goes wrong:** The current non-permit dedup checks `sourceId + title` for duplicates (pipeline.ts lines 200-210). Switching to `sourceUrl` for dedup seems more robust, but non-permit sources can share URLs. A "top 10 construction projects" news article has one URL but references 10 distinct projects. A Google dorking result page lists multiple projects under one URL. Using `sourceUrl` as the sole dedup key would collapse multiple distinct leads into one.

**Why it happens:** `sourceUrl` uniquely identifies the *source document*, not the *real-world project*. One document can contain multiple projects (aggregated news articles, search result pages), and multiple documents can reference one project (different outlets covering the same project).

**Consequences:** Legitimate distinct leads are silently merged. Users see fewer leads. The merged lead retains only the first project's data; the other projects are lost with no way to recover them.

**Warning signs:** After changing dedup logic, compare lead counts before and after a scrape run for non-permit sources. A significant drop indicates over-aggressive merging.

**Prevention:**
1. Use `sourceUrl` as an *additional* dedup signal, not the *primary* key. The dedup check should be: `(sourceId + sourceUrl + externalId)` when sourceUrl is available, with fallback to `(sourceId + title)` when sourceUrl is null.
2. For sources that aggregate multiple projects per URL (news articles, search results), the `externalId` or `title` must remain part of the dedup key to distinguish between different projects from the same source URL.
3. Before changing dedup logic, audit existing non-permit lead data to understand URL patterns per source type.
4. Test with real data: run the new dedup against existing leads in a dry-run mode before enabling it on the pipeline.

**Phase mapping:** Non-permit dedup improvement (BUG 9) -- requires data audit of existing non-permit sources before implementation.

**Confidence:** MEDIUM -- depends on the specific URL patterns of each adapter. The news adapters likely have unique URLs per article, but Google dorking may not.

---

### Pitfall 9: `revalidatePath("/dashboard")` Resets Scroll Position After Pagination Is Added

**What goes wrong:** The `toggleBookmark` action and `updateLeadStatus` action both call `revalidatePath("/dashboard")` after mutations. When pagination is added and the user is on page 3, `revalidatePath` triggers a full server re-render of the dashboard. The browser resets scroll position to the top. This is a known Next.js issue (#49087).

**Why it happens:** `revalidatePath` invalidates the entire route cache. Next.js re-fetches the server component tree. While pagination state in URL searchParams is preserved (the user stays on page 3), the DOM replacement causes a scroll-to-top.

**Consequences:** User bookmarks a lead on page 3, the page flashes and scrolls to the top. They must scroll back down to continue. Frustrating on mobile.

**Warning signs:** Bookmark a lead while scrolled down on the dashboard. If the page jumps to the top, this is active.

**Prevention:**
1. For v2.1, accept the scroll reset as a known limitation. The fix requires either optimistic client-side updates or `revalidateTag` with granular cache tagging, both of which are substantial refactors.
2. Ensure pagination state is preserved in URL searchParams so the user at least stays on the same page number.
3. Document as a known UX limitation for future improvement.
4. Future fix: convert bookmark/status toggles to use optimistic updates via `useOptimistic` + `useTransition`.

**Phase mapping:** Affects both pagination (BUG 13) and bookmarks UX. Not a blocker for v2.1 but should be documented.

**Confidence:** HIGH -- Next.js issue #49087 is well-documented and `revalidatePath` behavior is confirmed at `bookmarks.ts` lines 54 and 68.

---

### Pitfall 10: Vitest Config Missing `vite-tsconfig-paths` -- All `@/` Imports Fail

**What goes wrong:** The project uses TypeScript path aliases (`@/lib/...`, `@/components/...`) extensively. Vitest uses Vite's module resolution, which does not natively understand TypeScript path aliases. Without `vite-tsconfig-paths`, every import with `@/` fails with "Cannot find module" errors. The Next.js official Vitest setup guide explicitly includes this plugin, but it is NOT in the current `package.json`.

**Why it happens:** The project has `@vitejs/plugin-react` and `vitest` in devDependencies but is missing `vite-tsconfig-paths`.

**Warning signs:** First test run fails with `Error: Cannot find module '@/lib/leads/queries'`.

**Prevention:**
1. Install: `npm install -D vite-tsconfig-paths`
2. Create or update `vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import tsconfigPaths from 'vite-tsconfig-paths'
   export default defineConfig({
     plugins: [tsconfigPaths(), react()],
     test: { environment: 'jsdom' }
   })
   ```
3. Add `"test": "vitest"` and `"test:run": "vitest run"` to package.json scripts.

**Phase mapping:** Regression tests infrastructure -- must be done first before writing any tests.

**Confidence:** HIGH -- confirmed by Next.js official Vitest setup docs and the absence of `vite-tsconfig-paths` in the current `package.json`.

---

### Pitfall 11: Retroactive Dedup Deletes Leads That Users Have Bookmarked

**What goes wrong:** If the improved dedup logic is run retroactively against existing leads (not just new pipeline output), merging a lead that a user has bookmarked cascade-deletes the bookmark via the foreign key `ON DELETE CASCADE` on `bookmarks.leadId`. Same for `lead_statuses.leadId`. The user's bookmark and status data is silently destroyed.

**Why it happens:** The `mergeLeads()` function in `dedup.ts` (lines 165-178) transfers `lead_sources` entries from the duplicate to the canonical lead, then deletes the duplicate. But it does NOT transfer `bookmarks` or `lead_statuses`. The cascade delete on the foreign key handles the orphan cleanup, but that "cleanup" is actually data loss.

**Warning signs:** After a dedup run, check bookmark count before and after. If bookmarks decreased without user action, the merge deleted bookmarked leads.

**Prevention:**
1. Only apply the improved dedup logic to newly scraped leads going forward, not retroactively against existing data.
2. If retroactive dedup is desired, extend `mergeLeads()` to transfer bookmarks and lead_statuses from the duplicate to the canonical lead before deletion:
   ```ts
   // In mergeLeads(), before deleting duplicate:
   await tx.update(bookmarks).set({ leadId: canonicalId })
     .where(eq(bookmarks.leadId, duplicateId)).onConflictDoNothing();
   await tx.update(leadStatuses).set({ leadId: canonicalId })
     .where(eq(leadStatuses.leadId, duplicateId)).onConflictDoNothing();
   ```
3. Handle the unique constraint: if both the canonical and duplicate leads are bookmarked by the same user, the transfer would violate the unique index. Use `ON CONFLICT DO NOTHING` for the transfer (keep the canonical's bookmark, discard the duplicate's).

**Phase mapping:** Non-permit dedup improvement (BUG 9) -- decide whether to apply retroactively; if yes, extend `mergeLeads()` first.

**Confidence:** HIGH -- the cascade delete is defined in `bookmarks.ts` line 22-23.

---

## Minor Pitfalls

Issues that cause friction or tech debt but are not immediately dangerous.

---

### Pitfall 12: Forgot Password Page Route Placement Collision

**What goes wrong:** better-auth handles all auth API routes at `/api/auth/[...all]`. If the password reset page is placed under `/api/auth/reset-password`, it collides with better-auth's catch-all API route and the page never renders.

**Prevention:** Place the reset password page at `/reset-password` or under the `(auth)` route group. The `redirectTo` in the client `forgetPassword()` call should be `/reset-password`. The page must be a client component (it reads `searchParams` for the token and calls `authClient.resetPassword()`).

**Phase mapping:** Forgot password flow.

**Confidence:** HIGH.

---

### Pitfall 13: Tests That Accidentally Hit the Production Neon Database

**What goes wrong:** If integration tests import `@/lib/db` without mocking it, and `DATABASE_URL` is set in `.env.local` (pointing to the Neon production database), tests will read from and potentially write to production data.

**Prevention:**
1. For regression tests of pure functions, no DB access is needed -- these are pure input/output tests.
2. For tests that touch server actions, mock the `db` module: `vi.mock("@/lib/db")`.
3. Add a safeguard in the Vitest setup file:
   ```ts
   beforeAll(() => {
     if (process.env.DATABASE_URL?.includes('neon.tech')) {
       throw new Error('Refusing to run tests against production database');
     }
   });
   ```

**Phase mapping:** Regression tests -- establish in the test setup file during infrastructure setup.

**Confidence:** HIGH.

---

### Pitfall 14: `sendVerificationEmail` Awaiting the Email Send Leaks Account Existence

**What goes wrong:** better-auth docs warn: "Avoid awaiting the email sending to prevent timing attacks." If `sendVerificationEmail` awaits the Resend API call, the response time differs between "new user (email sent)" and "existing user (no email or different path)." An attacker can enumerate which email addresses have accounts.

**Prevention:**
1. Use Next.js `after()` from `next/server` to schedule the email send after the response:
   ```ts
   sendVerificationEmail: async ({ user, url }) => {
     after(async () => {
       const resend = new Resend(process.env.RESEND_API_KEY);
       await resend.emails.send({ ... });
     });
   }
   ```
2. If `after()` is not available in the better-auth callback context, fire-and-forget with `void`: `void sendEmail(...)` -- but be aware this may not complete on Vercel if the function exits.
3. For a B2B SaaS with no public-facing mass signup, this is low risk but still best practice.

**Phase mapping:** Email verification on signup.

**Confidence:** MEDIUM -- timing attack is real but low-risk for B2B.

---

### Pitfall 15: Active Nav Highlighting Breaks on Nested Routes

**What goes wrong:** Implementing active nav highlighting by checking `pathname === href` fails for nested routes. If the "Dashboard" nav links to `/dashboard` but the user is on `/dashboard/leads/abc123`, strict equality shows Dashboard as inactive.

**Prevention:**
1. Use `pathname.startsWith(href)` for parent-level nav items (Dashboard, Settings).
2. Use `pathname === href` only for exact-match items if needed.
3. The `/dashboard` prefix is shared by `/dashboard`, `/dashboard/bookmarks`, `/dashboard/saved-searches`, and `/dashboard/leads/[id]`. Decide intentionally whether "Dashboard" should highlight for all of these or only `/dashboard`.
4. Test with the mobile nav drawer too -- it uses the same nav items.

**Phase mapping:** Active nav highlighting -- minor feature but easy to get subtly wrong.

**Confidence:** HIGH.

---

### Pitfall 16: Email Templates Using Domain `onboarding@resend.dev` Go to Spam

**What goes wrong:** Verification and password reset emails sent from `onboarding@resend.dev` (Resend's default sandbox domain) land in spam for many corporate email servers. Heavy machinery company sales reps use corporate email with strict spam filters. Password reset and verification emails never arrive.

**Prevention:** Configure a custom sending domain in Resend (e.g., `noreply@heavyleads.com`) with proper SPF/DKIM/DMARC records before launching email verification. The existing `send-digest.ts` already uses `process.env.RESEND_FROM_EMAIL ?? "HeavyLeads <onboarding@resend.dev>"`, so setting the env var is sufficient -- but the domain itself must be verified in Resend.

**Phase mapping:** Email verification and forgot password -- both features depend on email delivery.

**Confidence:** HIGH.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Regression tests (infrastructure) | Vitest + server-only imports (P5), missing tsconfig paths (P10), accidental DB access (P13) | Set up mocking strategy, install `vite-tsconfig-paths`, add DB safeguard FIRST before writing any tests |
| Regression tests (writing) | Trying to test async server components directly (P5) | Test only pure functions and mocked server actions; defer page-level tests to E2E |
| Lead feed pagination (BUG 13) | FETCH_MULTIPLIER interaction (P3), offset instability (P6), scroll position loss (P9) | In-memory pagination over enriched results; return `hasMore` flag; disable nationwide fallback for page > 1 |
| Bookmarks batch query (BUG 14) | Missing enrichment crashes LeadCard (P4) | Extract `enrichLead()` from `getLeadById()` into shared function; batch fetch + map through enrichment |
| Digest email optimization (BUG 10) | N*M query explosion (P7) | Batch profile lookup; add timing instrumentation; consider broad-query + in-memory filter |
| Non-permit dedup (BUG 9) | Over-merging on sourceUrl (P8), deleting bookmarked leads (P11) | Use sourceUrl as supplementary signal only; only dedup new leads; transfer bookmarks/statuses on merge |
| Forgot password flow | URL pointing to wrong domain (P2), route collision (P12), spam delivery (P16) | Verify BETTER_AUTH_URL on deploy; use relative `redirectTo`; place page outside `/api/auth/`; configure custom email domain |
| Email verification | Existing user lockout (P1), timing attack (P14), spam delivery (P16) | Migrate existing users to `email_verified = true` BEFORE enabling flag; use `after()` for email send; configure custom email domain |
| Active nav highlighting | Nested route matching (P15) | Use `startsWith` for parent nav items; test all route combinations |

---

## Production Safety Checklist

Given the recent production 500 from the env.ts module, every v2.1 change must pass these checks:

- [ ] **No module-level side effects on critical paths.** Never `throw` at module load time in files imported by pages or API routes. The env.ts lesson: validate at usage points, not import time.
- [ ] **Preview deploy test.** Every PR should be tested on a Vercel preview deployment before merging to main. The production URL is live.
- [ ] **Backward compatibility.** Changes to `getFilteredLeads()` must not break the existing call sites (dashboard page, digest generator, nationwide fallback). Add new parameters with defaults.
- [ ] **Database migrations before code deploys.** If enabling email verification or adding indexes for dedup, the migration must land before the code that depends on it.
- [ ] **No test code in production bundles.** Vitest config should be separate from Next.js config. Test files should not be in `src/app/` where Next.js might try to route them.
- [ ] **Rollback plan.** For auth changes (P1, P2), know how to quickly revert. The git revert should be testable in a preview deploy before force-pushing to main.

---

## Sources

- [Better Auth Email & Password Docs](https://better-auth.com/docs/authentication/email-password) -- `requireEmailVerification` behavior, `sendResetPassword` callback, timing attack warning
- [Better Auth Email Concepts](https://better-auth.com/docs/concepts/email) -- `sendVerificationEmail` configuration, avoid awaiting
- [Better Auth Issue #3461](https://github.com/better-auth/better-auth/issues/3461) -- invalid token errors from URL misconfiguration
- [Better Auth Issue #2082](https://github.com/better-auth/better-auth/issues/2082) -- forget password flow problems
- [Next.js Vitest Setup Guide](https://nextjs.org/docs/app/guides/testing/vitest) -- official, confirms async server component limitation, `vite-tsconfig-paths` requirement
- [Next.js GitHub Issue #60038](https://github.com/vercel/next.js/issues/60038) -- server-only + Vitest incompatibility
- [Next.js GitHub Issue #49087](https://github.com/vercel/next.js/issues/49087) -- scroll position reset on searchParams update
- [Next.js `after()` Function Docs](https://nextjs.org/docs/app/api-reference/functions/after) -- background task scheduling for serverless
- [Drizzle ORM Offset Pagination Guide](https://orm.drizzle.team/docs/guides/limit-offset-pagination) -- offset performance degradation, dynamic query pagination
- [Drizzle ORM Cursor Pagination Guide](https://orm.drizzle.team/docs/guides/cursor-based-pagination) -- cursor-based alternative for future
- [Google AIP-158: Pagination](https://google.aip.dev/158) -- backward-compatible pagination design
- [Google AIP-180: Backwards Compatibility](https://google.aip.dev/180) -- adding pagination is a breaking change
- [Slack Engineering: Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/) -- real-world pagination migration lessons
- [Email Verification with better-auth Tutorial](https://dev.to/daanish2003/email-verification-using-betterauth-nextjs-and-resend-37gn) -- practical setup with Resend
- [Forgot/Reset Password with better-auth Tutorial](https://dev.to/daanish2003/forgot-and-reset-password-using-betterauth-nextjs-and-resend-ilj) -- client-side token extraction pattern
- [Vercel waitUntil Docs](https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions) -- background task execution on serverless

---
*Pitfalls research for: HeavyLeads v2.1 Bug Fixes & Hardening*
*Researched: 2026-03-15*
