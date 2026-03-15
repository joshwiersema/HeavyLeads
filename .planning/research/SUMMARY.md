# Project Research Summary

**Project:** HeavyLeads v2.0 Production Rework
**Domain:** B2B SaaS lead intelligence platform (construction/heavy machinery)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

HeavyLeads v2.0 is a production rework of an existing B2B SaaS lead generation platform targeting heavy machinery businesses. The application already has a functional base stack (Next.js 16, Better Auth, Stripe, Drizzle/Neon, Crawlee, shadcn/ui), but it has a critical production blocker: the Stripe customer creation flow is broken due to a user-level vs. organization-level customer mismatch. Beyond that fix, v2.0 needs to add a no-credit-card free trial, expand onboarding from 3 to 5 steps with company details and team invites, automate daily lead generation via Vercel Cron (replacing dead `node-cron` code), trigger a first-login lead scrape so new users are never dropped on an empty dashboard, and add a custom search page and guided product tour. The only new npm packages required are `@vercel/blob` (logo upload) and `nextstepjs + motion` (product tour) — everything else builds on the existing stack.

The single most important architectural decision is how free trials work. The `@better-auth/stripe` plugin does not support checkout-free trials (GitHub issue #4631, closed as "not planned"), so the trial subscription must be created directly in the database at onboarding completion, bypassing Stripe Checkout entirely. This is safe because the plugin's existing `getActiveSubscription()` guard already recognizes `status: "trialing"`, and the subscription table already has `trialStart`/`trialEnd` columns. The trial is enforced purely at the application layer with a `trialEnd > now` check — no Stripe involvement until the user converts to a paid plan. This approach is simpler, faster, and fully under our control.

The core execution risk is the scraper pipeline exceeding Vercel's 5-minute function timeout when 8 adapters run sequentially. The current `node-cron` scheduler is dead code on Vercel's serverless infrastructure and must be replaced with a `vercel.json` cron configuration. If adapter execution time proves problematic, the fix is `Promise.allSettled()` parallelization. The second major risk is the first-login user experience: new users who complete onboarding and land on an empty dashboard while the scraper runs will abandon immediately. The fire-and-forget + client polling pattern with a purposeful loading state ("Finding leads near Austin, TX...") is the mitigation — it must be built as part of the scraper trigger work, not as an afterthought.

## Key Findings

### Recommended Stack

The existing stack is well-chosen and requires minimal additions. Three new packages are needed: `@vercel/blob` for logo storage (native Vercel integration, serves via CDN, avoids the 4.5MB serverless body limit), `nextstepjs` for the guided tour (built specifically for Next.js App Router), and `motion` as a required peer dependency. Vercel Cron requires no new package — it is a `vercel.json` configuration change plus a new API route. The free trial and scraper trigger features require no new packages at all.

**Core technology additions:**
- `@vercel/blob`: Company logo upload and CDN storage — avoids Vercel's 4.5MB serverless body limit; logos served directly from Vercel's CDN
- `nextstepjs ^2.2.0`: Guided dashboard tour — native Next.js App Router support, declarative step definitions, cross-page routing; fallback is driver.js (1.4.0) if stability issues arise
- `motion ^11.x`: Required peer dependency for nextstepjs animations — do NOT install "framer-motion", use "motion" (renamed in v11)
- `vercel.json` (config, not a package): Vercel Cron daily scrape at 06:00 UTC — replaces dead `node-cron` scheduler; sends GET requests to API route
- New environment variables: `BLOB_READ_WRITE_TOKEN` (auto-created via Vercel Blob store) and `CRON_SECRET` (random 16+ char string added in Vercel project settings)

### Expected Features

**Must have (table stakes):**
- Free 7-day trial with no credit card — every modern B2B SaaS; missing this loses ~50% of potential signups
- Trial countdown banner in dashboard — users need to know days remaining; without it, trial end is a surprise
- Trial expiry gate — expired trial + no subscription redirects to billing; ungated expired trials train users to never pay
- Company details onboarding step — company name, website, phone, logo, industry segment establish organizational identity
- Empty state with progress on first login — dashboard with zero leads looks broken; users leave within 30 seconds
- Automatic daily lead refresh via Vercel Cron — the core value proposition ("fresh leads every morning") fails without automation
- On-demand refresh button — power users expect to trigger a manual data update

**Should have (competitive differentiators):**
- First-login scraper trigger — ConstructConnect/PlanHub show results instantly from massive databases; HeavyLeads must close this gap; users who complete onboarding and see a populated dashboard convert at dramatically higher rates
- Team invite step in onboarding — getting the whole team on board during the trial window is the highest-leverage conversion tactic
- Guided dashboard tour (nextstepjs, 6 steps) — reduces time-to-value from minutes to seconds; competitors have no guided onboarding
- Custom search page — search by location/keyword/project type beyond org defaults; reuses existing `getFilteredLeads()` with overridden lat/lng
- Pre-expiry conversion emails at 3 days, 1 day, and expiry day

**Defer to v2.1+:**
- One-time 3-day trial extension (auto-granted) — worth building only after seeing conversion metrics
- Onboarding checklist widget — nice to have after core onboarding works
- Smart conversion triggers based on usage analytics — requires analytics foundation first
- Custom search scheduling — depends on custom search proving valuable in v2.0

### Architecture Approach

The v2.0 features integrate cleanly with the existing component structure because the codebase already has all foundational pieces in place: the subscription table has trial columns, `getActiveSubscription()` already accepts trialing status, the onboarding wizard uses an extensible `STEPS` array, the scraper pipeline is stateless and idempotent, and the existing `getFilteredLeads()` function already accepts the parameters needed for custom search. The primary architectural changes are a direct-DB-write trial creation (bypassing plugin checkout), two new wizard steps by extending the STEPS array, a Vercel Cron GET endpoint replacing `node-cron`, and a fire-and-forget + polling mechanism for first-login scraping.

**Major components:**
1. **Trial subscription creation** — new `createTrialSubscription()` server action writes directly to the subscription table with `status: "trialing"` and `trialEnd: now + 7 days`; no Stripe Checkout involved
2. **Dashboard guard update** — `getActiveSubscription()` updated to exclude expired trials (`trialEnd < now`), handling all 5 subscription states: active, trialing, past_due, paused, canceled
3. **Vercel Cron endpoint** — new `GET /api/cron/scrape` route with `CRON_SECRET` auth; existing pipeline code reused unchanged; `export const maxDuration = 300`
4. **First-login trigger + polling** — `triggerFirstScrape()` server action fires pipeline async; client polls `/api/leads/count` every 10s; dashboard shows purposeful loading state until leads appear
5. **Expanded onboarding wizard** — two new steps (StepCompanyDetails, StepTeamInvites) inserted into existing STEPS array; team invites are non-blocking client-side calls, not part of form schema
6. **Custom search** — new `/dashboard/search` page calls existing `getFilteredLeads()` with geocoded user-specified location instead of HQ coordinates; no new query logic needed

### Critical Pitfalls

1. **createCustomerOnSignUp user/org mismatch** — `createCustomerOnSignUp: true` creates a user-level Stripe customer during signup, but subscriptions use `referenceId: organizationId`. This is almost certainly the current production blocker (confirmed via GitHub #3670, #2440). Fix: set `createCustomerOnSignUp: false`; create organization-level customers explicitly during onboarding.

2. **Setup fee charged during free trial checkout** — the existing `getCheckoutSessionParams` adds `PRICES.setupFee` for "first-time" subscribers. A trial IS a first-time subscription, so this fires and charges users $499+ for what was marketed as a free trial. Fix: exclude setup fee line items when the checkout is for a trial; charge setup fee only at trial-to-paid conversion via `onTrialEnd` callback.

3. **Vercel Cron route must use GET, not POST** — Vercel Cron sends GET requests only. The existing `/api/scraper/run` is POST-only. A new `/api/cron/scrape` GET route with `CRON_SECRET` auth is required; the existing POST route remains for user-triggered runs with session auth.

4. **First-login + cron race condition creates duplicate leads** — if a new user signs up near the daily cron time, both triggers run concurrently. The non-permit dedup uses check-then-insert (not atomic), causing duplicates. Fix: add a unique constraint on `(source_id, external_id)` and use `onConflictDoNothing()` for all lead inserts.

5. **trialStart/trialEnd stay NULL in database** — known Better Auth Stripe plugin bug (GitHub #4046, #2345): trial date fields fail to persist after checkout. The recommended direct-DB-write approach sidesteps this bug, but must be verified after implementation with a direct database query.

## Implications for Roadmap

Based on the dependency graph across all four research files, five phases emerge naturally. The critical path is: fix the Stripe production blocker first, then automate lead generation, then polish the user experience.

### Phase 1: Stripe Fix + Free Trial Foundation
**Rationale:** The Stripe customer creation bug is a production blocker — no new user can successfully complete signup. Everything else in v2.0 is built on top of a working auth/billing flow. The free trial system must be designed in this same phase because it touches the same subscription table and guard logic as the Stripe fix; splitting them would require touching the same files twice.
**Delivers:** Working signup flow; 7-day no-CC trial via direct DB write; trial countdown banner; trial expiry gate redirecting to billing; trial-aware billing page showing "X days remaining" vs. "Trial expired" vs. "Active" states
**Addresses:** Free trial (table stakes), trial countdown, trial expiry gate, updated billing page
**Avoids:** createCustomerOnSignUp mismatch (Pitfall 1), setup fee during trial (Pitfall 11), trial status guard failures (Pitfall 2), trialStart/trialEnd NULL bug (Pitfall 3), trial abuse (Pitfall 4)

### Phase 2: Vercel Cron + Automated Lead Generation
**Rationale:** The core value proposition of HeavyLeads — fresh leads delivered automatically — does not work in production because `node-cron` is dead code on Vercel. This phase replaces it with Vercel Cron and adds the first-login trigger that ensures new users see leads within minutes of completing onboarding. This is the single highest-impact v2.0 feature for trial conversion. It must come before onboarding expansion so that the improved onboarding flows into a populated dashboard.
**Delivers:** `vercel.json` Vercel Cron daily job at 06:00 UTC; secured `/api/cron/scrape` GET endpoint; first-login trigger with fire-and-forget + polling; "Finding leads near [city]..." loading state; on-demand refresh button with rate limiting; informative empty state
**Addresses:** Automatic daily lead refresh (table stakes), first-login lead trigger (differentiator), on-demand refresh (table stakes), empty state (table stakes)
**Avoids:** Unauthenticated scraper endpoint (Pitfall 9), cron timeout from sequential adapters (Pitfall 5), first-login + cron race condition duplicates (Pitfall 6), blocking first login on scraper completion (Pitfall 10)

### Phase 3: Professional Onboarding Expansion
**Rationale:** With a working trial flow and a populated dashboard, the onboarding wizard can be safely extended. Existing users need migration defaults for new schema fields. The team invite step depends on the `sendInvitationEmail` callback being wired into auth.ts. Logo upload uses client-side direct upload to Vercel Blob, sidestepping the 4.5MB serverless body limit. This phase comes after automated lead generation because the improved onboarding immediately flows into the first-login trigger — users completing the new 5-step wizard land on a dashboard that starts populating leads right away.
**Delivers:** 5-step onboarding wizard (company details, location, equipment, radius, team invites); company logo upload via Vercel Blob client-side direct upload; team invite flow with email; accept-invite page; team management settings page; migration for existing v1 users with sensible defaults
**Addresses:** Company details step (table stakes), team invite differentiator, logo upload
**Avoids:** Image upload body size limit (Pitfall 8), onboarding expansion breaking existing users (Pitfall 7), invite step blocking onboarding completion (Architecture anti-pattern 3)

### Phase 4: Guided Tour + Pre-Expiry Emails
**Rationale:** The guided tour depends on the dashboard having leads to show — it must fire after the first-login trigger has populated data. Pre-expiry emails depend on a working trial system (Phase 1) and a reliable daily cron (Phase 2) to trigger the checks. Both are conversion-maximizing polish features that have no upstream blockers other than Phases 1-3 being complete.
**Delivers:** nextstepjs dashboard tour (6 steps: lead feed, lead card, filters, lead detail, bookmarks, saved searches); `hasSeenTour` flag preventing re-trigger; pre-expiry conversion emails at 3 days, 1 day, and expiry via Resend and daily cron check
**Addresses:** Guided dashboard tour (differentiator), pre-expiry conversion emails (table stakes)
**Avoids:** Showing tour on empty dashboard (dependency failure), emails blocking other flows on Resend errors

### Phase 5: Custom Search
**Rationale:** Custom search is the most architecturally independent feature — it reuses `getFilteredLeads()` with overridden coordinates and adds a new `/dashboard/search` page. It is listed last because it requires the pipeline to be working reliably (Phase 2) before adding user-initiated pipeline runs, and requires the trial system (Phase 1) for proper rate limiting differentiation between trial and paid users.
**Delivers:** `/dashboard/search` page with location/keyword/project type form; geocoded location override into existing `getFilteredLeads()`; search result display reusing lead-card component; "save this search" extending saved_searches table with `searchLat`/`searchLng`/`searchLocation` columns; rate limits (3/day trial, 10/day paid) with remaining quota shown in UI
**Addresses:** Custom search (differentiator)
**Avoids:** Duplicate query logic (Architecture anti-pattern 5), unbounded custom searches causing scraper rate bans

### Phase Ordering Rationale

- Phase 1 must come first: it fixes the production blocker and establishes the trial data model that all subsequent phases depend on for guard logic and user state.
- Phase 2 comes before onboarding expansion: the expanded wizard flows directly into the first-login trigger — users must land on a populating dashboard, not an empty one. Building onboarding before fixing the scraper would create an improved flow that still ends in disappointment.
- Phase 3 depends on Phase 1 being complete (trial active before onboarding completes) and Phase 2 being complete (first-login trigger available to fire after onboarding).
- Phase 4 depends on Phase 3 (tour requires leads from first-login trigger) and Phase 1 (trial dates for email scheduling).
- Phase 5 is independent of Phases 3-4 and could be parallelized with Phase 4 if resources allow.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** First-login trigger has several edge cases (concurrent cron + user trigger, Vercel function timeout, partial pipeline results) that warrant specific task-level design before implementation. The idempotency strategy (unique constraint vs. `scraper_runs` table) should be decided before writing code. Also verify the actual Vercel plan to confirm Hobby vs. Pro limits.
- **Phase 2:** Pipeline duration on production Vercel is unknown until tested. Must instrument adapters with timing logs after first deployment. If total duration exceeds 240s (leaving 60s buffer under the 300s Hobby limit), parallelize adapters with `Promise.allSettled()` before declaring the phase complete.

Phases with standard patterns (skip research-phase):
- **Phase 1:** The Stripe fix and direct-DB-write trial approach are fully specified in ARCHITECTURE.md with exact code samples. No new research needed.
- **Phase 3:** Onboarding wizard extension via STEPS array is documented in ARCHITECTURE.md. Vercel Blob client upload pattern is from official docs.
- **Phase 4:** nextstepjs integration is a straightforward provider + steps config. Pre-expiry email is a standard cron-triggered Resend call.
- **Phase 5:** Custom search is a parameter override on an existing query function with low implementation risk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new packages verified against official Vercel and library documentation. nextstepjs is MEDIUM confidence (newer library), but driver.js fallback is HIGH confidence. |
| Features | HIGH | Free trial UX patterns verified across multiple B2B SaaS sources. Competitor analysis confirms table stakes. Feature prioritization is grounded in dependency analysis, not opinion. |
| Architecture | HIGH | Integration patterns verified against Better Auth GitHub issues, Vercel Cron docs, and existing codebase analysis. Direct-DB trial approach confirmed safe by subscription table schema inspection. |
| Pitfalls | HIGH | All critical pitfalls traced to specific GitHub issues and official documentation. These are confirmed bugs and constraints, not speculative risks. |

**Overall confidence:** HIGH

### Gaps to Address

- **nextstepjs React 19 compatibility**: MEDIUM confidence. The library is designed for Next.js App Router but its maturity with React 19 is unverified at scale. Validate in a spike before committing to it in Phase 4. Driver.js is the confirmed fallback with zero React dependency.
- **Pipeline actual duration on production Vercel**: Unknown until Phase 2 runs in production. Must instrument each adapter with timing logs. If total duration exceeds 240s, parallelize adapters before declaring Phase 2 complete.
- **Better Auth Stripe plugin version pinning**: The direct-DB-write trial approach is safe at current plugin version (`^1.5.5`) but could break on upgrades if the schema changes. Pin `@better-auth/stripe` version in package.json during Phase 1 and document the constraint.
- **Resend free tier limits**: Free tier is 100 emails/day. Pre-expiry emails (3 per trial user) plus team invites plus daily digest could approach this limit at scale. Verify the Resend plan before Phase 4 ships.
- **Organization-scoped trial timing**: The `onCustomerCreate` hook fires during signup, but the recommended direct-DB-write trial approach fires at onboarding completion (after org creation). This is the correct order — verify the organization ID is available in the `completeOnboarding()` action context before writing the subscription row.

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) — configuration, expressions, security, idempotency
- [Vercel Cron Management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — CRON_SECRET, duration limits, no-retry behavior, production-only
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) — Hobby 300s max, Pro 800s max with Fluid Compute
- [Vercel Blob documentation](https://vercel.com/docs/vercel-blob) — server and client upload patterns, 4.5MB limit workaround
- [Vercel Blob Server Upload](https://vercel.com/docs/vercel-blob/server-upload) — server action pattern, BLOB_READ_WRITE_TOKEN, 4.5MB limit
- [Better Auth Stripe plugin](https://better-auth.com/docs/plugins/stripe) — freeTrial config, subscription lifecycle, organization support
- [Better Auth Organization Plugin](https://better-auth.com/docs/plugins/organization) — inviteMember API, sendInvitationEmail, invitation acceptance flow
- [Stripe trial periods](https://docs.stripe.com/billing/subscriptions/trials) — trial_period_days, payment_method_collection, trial_settings
- [Stripe free trial checkout](https://docs.stripe.com/payments/checkout/free-trials) — no-card trial setup

### Secondary (MEDIUM confidence)
- [GitHub #4631: Trial without checkout](https://github.com/better-auth/better-auth/issues/4631) — confirmed no official API for checkout-free trials; closed "not planned"
- [GitHub #4046: trialStart/trialEnd not updated](https://github.com/better-auth/better-auth/issues/4046) — trial dates NULL bug confirmed
- [GitHub #6863: hasEverTrialed uses wrong subscription](https://github.com/better-auth/better-auth/issues/6863) — trial abuse prevention bug via findOne vs findMany
- [GitHub #3670: Duplicate customers on signup](https://github.com/better-auth/better-auth/issues/3670) — createCustomerOnSignUp conflict
- [GitHub #2440: subscription.upgrade creates new customer](https://github.com/better-auth/better-auth/issues/2440) — duplicate customer creation
- [NextStep.js](https://nextstepjs.com/) — product tour library for Next.js App Router, declarative steps API
- [OnboardJS: 5 best React onboarding libraries 2026](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared) — library comparison confirming driver.js as proven fallback
- Various B2B SaaS sources on free trial UX best practices (Userpilot, Maxio, Encharge) — directional, not precise on statistics

### Tertiary (LOW confidence)
- Competitor analysis sources (PlanHub, ConstructConnect comparisons) — directional only; competitor features may have changed since publication

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
