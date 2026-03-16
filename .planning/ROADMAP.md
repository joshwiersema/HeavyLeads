# Roadmap: HeavyLeads

## Milestones

- [x] **v1.0 Core Product** - Phases 1-6 (shipped 2026-03-14)
- [x] **v2.0 Production Rework** - Phases 7-8 (shipped 2026-03-15)
- [ ] **v2.1 Bug Fixes & Hardening** - Phases 9-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Core Product (Phases 1-6) - SHIPPED 2026-03-14</summary>

- [x] **Phase 1: Platform Foundation** - Auth, multi-tenancy with data isolation, company onboarding wizard, and account management
- [x] **Phase 2: Scraping Pipeline** - Crawlee-based scraper framework, initial permit scrapers, daily scheduling, and geocoding
- [x] **Phase 3: Lead Intelligence and Dashboard** - Equipment inference, lead scoring, timeline mapping, filterable daily feed, and lead detail view
- [x] **Phase 4: Multi-Source Expansion** - Bid board, news, and deep web scrapers with cross-source deduplication
- [x] **Phase 5: Lead Management and Notifications** - Lead status tracking, saved searches, keyword search, and daily email digest
- [x] **Phase 6: Billing and Launch Readiness** - Stripe subscription billing with one-time setup fee and ongoing monthly charges

</details>

<details>
<summary>v2.0 Production Rework (Phases 7-8) - SHIPPED 2026-03-15</summary>

- [x] **Phase 7: Billing Fix and Free Trial** - Fix Stripe customer creation, add 7-day trial via Stripe Checkout, trial UI
- [x] **Phase 8: Lead Automation** - Vercel Cron daily scraping, first-login trigger, on-demand refresh, empty state

</details>

### v2.1 Bug Fixes & Hardening

- [ ] **Phase 9: Regression Test Safety Net** - Test infrastructure and regression tests for all 15 v2.0 post-rework bug fixes
- [ ] **Phase 10: Query Optimizations** - Pagination, bookmarks batch query, digest optimization, and non-permit dedup
- [ ] **Phase 11: Forgot Password** - Password reset flow via email link from sign-in page
- [ ] **Phase 12: UI Polish** - Active nav highlighting in desktop sidebar and mobile nav drawer

## Phase Details

<details>
<summary>v1.0 Phase Details (Phases 1-6) - SHIPPED 2026-03-14</summary>

### Phase 1: Platform Foundation
**Goal**: Users can create accounts, join tenant-isolated companies, and configure their dealer profile
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-06
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password, then log in and stay logged in across browser refreshes
  2. Each company's data is fully isolated -- a user in Company A cannot see Company B's data
  3. New company completes onboarding wizard setting HQ location, equipment types, and service radius
  4. User can view and update their account settings and company profile after onboarding
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Next.js 16 app, configure Better Auth + Drizzle + Neon PostgreSQL, create auth pages and protected dashboard layout
- [x] 01-02-PLAN.md -- Build onboarding wizard (location, equipment, radius), account settings, company profile settings, and end-to-end verification

### Phase 2: Scraping Pipeline
**Goal**: System automatically collects permit data daily and stores geocoded lead records ready for enrichment
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-05, DATA-07
**Success Criteria** (what must be TRUE):
  1. System scrapes building permit data from at least 3 target jurisdictions and stores structured lead records
  2. Scraping pipeline runs automatically on a daily schedule and each record carries a freshness timestamp
  3. Lead locations are geocoded to coordinates that support radius-based geographic queries
  4. New scraper sources can be added via pluggable adapter configuration without modifying framework code
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Leads DB schema, scraper adapter interface, pipeline orchestrator with error isolation and dedup, Zod validation, and test scaffolds
- [x] 02-02-PLAN.md -- Three jurisdiction adapters (Austin, Dallas, Atlanta), daily cron scheduler, and manual trigger API route

### Phase 3: Lead Intelligence and Dashboard
**Goal**: Sales reps can open HeavyLeads each morning and see a filtered, scored feed of relevant project leads
**Depends on**: Phase 2
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06, UX-01, UX-05
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a daily lead feed sorted by recency and relevance with freshness indicators (New, This Week, Older)
  2. Each lead displays inferred equipment needs based on project type and a relevance score based on the dealer's profile
  3. User can filter leads by equipment type (show-all default) and by geographic radius from company HQ
  4. Lead detail view shows project info, map location, key contacts, estimated equipment needs, and source attribution
  5. Leads include equipment-need timeline windows mapping project phases to when specific equipment is needed
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Equipment inference engine, lead scoring algorithm, timeline mapping, freshness badges, and Haversine geo-filtered query module
- [x] 03-02-PLAN.md -- Daily lead feed dashboard with card layout, equipment and radius filter controls, and navigation update
- [x] 03-03-PLAN.md -- Lead detail page with interactive Google Map, equipment needs with confidence, timeline urgency windows, and source attribution

### Phase 4: Multi-Source Expansion
**Goal**: System aggregates leads from permits, bid boards, news, and deep web into deduplicated canonical records
**Depends on**: Phase 2
**Requirements**: DATA-02, DATA-03, DATA-04, DATA-06
**Success Criteria** (what must be TRUE):
  1. System scrapes government and private bid board postings (RFPs, contract awards) as a second lead source
  2. System scrapes construction news and press releases for project announcements and groundbreakings
  3. System performs Google dorking and deep web queries to surface project docs, contractor activity, and job postings
  4. Leads appearing across multiple sources are deduplicated into a single canonical record with all source references preserved
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Generalize adapter interface from permit-specific to source-agnostic, update DB schema (leads + lead_sources), update pipeline and existing adapters
- [x] 04-02-PLAN.md -- SAM.gov bid board adapter, RSS news adapters (ENR, Construction Dive, PR Newswire), Google dorking adapter via Serper.dev
- [x] 04-03-PLAN.md -- Cross-source deduplication engine, pipeline integration, and multi-source attribution on lead detail page

### Phase 5: Lead Management and Notifications
**Goal**: Sales reps can track their lead workflow and receive proactive notifications about new matches
**Depends on**: Phase 3
**Requirements**: UX-02, UX-03, UX-04, UX-06
**Success Criteria** (what must be TRUE):
  1. User can update lead status (New / Viewed / Contacted / Won / Lost) and the status persists across sessions
  2. User can save search configurations and bookmark individual leads for quick re-access
  3. User receives a daily email digest summarizing new matching leads with direct links to the dashboard
  4. User can search leads by keyword and filter by date range and project size
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Schema tables (lead_statuses, bookmarks, saved_searches), query extensions (keyword, date, size filters), and server actions for status/bookmark/search CRUD
- [x] 05-02-PLAN.md -- Dashboard UI integration: status badges, bookmark toggles, advanced filters, bookmarks page, saved searches page, sidebar navigation
- [x] 05-03-PLAN.md -- Daily email digest with Resend + React Email, digest generator, API route, and scheduler integration

### Phase 6: Billing and Launch Readiness
**Goal**: Companies can self-service subscribe with a one-time setup fee and ongoing monthly billing
**Depends on**: Phase 1
**Requirements**: PLAT-05
**Success Criteria** (what must be TRUE):
  1. Company admin can initiate subscription checkout that includes a one-time setup fee and a recurring monthly charge
  2. System handles subscription lifecycle events (activation, cancellation, payment failure) via Stripe webhooks
  3. Access to lead data is gated by active subscription status
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Install @better-auth/stripe plugin, configure Stripe integration in auth, create subscription schema, add dashboard access gate
- [x] 06-02-PLAN.md -- Billing settings page with subscribe/manage flows, billing status display, and test coverage

</details>

<details>
<summary>v2.0 Phase Details (Phases 7-8) - SHIPPED 2026-03-15</summary>

### Phase 7: Billing Fix and Free Trial
**Goal**: New users can sign up, start a 7-day free trial via Stripe Checkout, and see clear trial status throughout the app
**Depends on**: Phase 6
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05
**Success Criteria** (what must be TRUE):
  1. New user completes signup without Stripe errors (customer created at organization level, not user level)
  2. New user enters credit card via Stripe Checkout and starts a 7-day trial with no charges until trial ends
  3. Dashboard displays a trial countdown banner showing days remaining (e.g., "5 days left in your trial")
  4. User whose trial has expired is redirected to the billing page with "Trial ended" messaging and a subscribe call-to-action
  5. Setup fee is not charged during trial checkout -- it is charged only when the user converts to a paid subscription after trial ends
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Fix Stripe customer creation, configure 7-day free trial, conditional setup fee logic, and trial status utility
- [x] 07-02-PLAN.md -- Trial countdown banner in dashboard layout and trial-ended messaging on billing page

### Phase 8: Lead Automation
**Goal**: Leads appear automatically every day, new users see leads within minutes of onboarding, and the dashboard is never a blank page
**Depends on**: Phase 7
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, PLSH-02
**Success Criteria** (what must be TRUE):
  1. Scraping pipeline runs automatically once per day via Vercel Cron without manual intervention
  2. New user who completes onboarding sees leads populating within minutes, with a progress indicator while the pipeline runs
  3. User can click "Refresh Leads" to trigger an on-demand pipeline run, rate-limited to once per hour per organization
  4. Scraper API routes are secured (CRON_SECRET for cron requests, session auth for user-triggered requests)
  5. Dashboard shows an informative empty state with messaging when no leads exist yet, instead of a blank page
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- Pipeline runs schema, Vercel Cron GET route with CRON_SECRET auth, secured user-trigger POST route with DB rate limiting, vercel.json cron config
- [x] 08-02-PLAN.md -- First-login pipeline auto-trigger, pipeline progress indicator, Refresh Leads button, context-aware dashboard empty state

</details>

### Phase 9: Regression Test Safety Net
**Goal**: All 15 v2.0 post-rework bug fixes have regression test coverage, establishing a safety net before any production code changes in this milestone
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run test` executes the full test suite and all tests pass with zero configuration errors
  2. Every v2.0 post-rework bug fix has at least one test that would fail if the fix were reverted (permit upsert, geocoding null, lead query sort, org slug, sign-in redirect, Stripe idempotency, onboarding upsert, mobile nav, landing page, pricing display, error boundaries, date formatting, loading states, equipmentTypes guard, geocoding error handling)
  3. Server actions can be tested using established mocking patterns for `@/lib/db`, `@/lib/auth`, `next/headers`, and `next/cache` without hitting the production database
  4. Zero production source files are modified in this phase -- only test files and test infrastructure
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md -- Add npm test script, fix 6 failing pipeline tests, create tests/regressions/ directory
- [ ] 09-02-PLAN.md -- 9 unit/logic regression tests (permit upsert, geocoding null, lead sort, org slug, Stripe idempotency, onboarding upsert, date formatting, equipmentTypes guard, geocoding error handling)
- [ ] 09-03-PLAN.md -- 6 component regression tests (sign-in redirect, mobile nav, landing page, pricing display, error boundaries, loading states)

### Phase 10: Query Optimizations
**Goal**: Lead feed supports page navigation, bookmarks load in a single query, digest emails generate efficiently, and non-permit leads are deduplicated by source URL
**Depends on**: Phase 9
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. User can navigate between pages of leads using Previous/Next controls with a page indicator, and the current page persists in the URL alongside all existing filters
  2. Bookmarks page loads all bookmarked leads in a single round-trip instead of one query per bookmark, and every lead card displays the same enriched data (score, equipment, freshness, distance) as the main feed
  3. Digest email generation runs one broad query per user instead of one query per saved search, completing within Vercel function timeout limits
  4. When the scraping pipeline processes non-permit leads, duplicates with matching source URLs are detected and skipped instead of creating duplicate lead records
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Forgot Password
**Goal**: Locked-out users can recover their account via email without contacting support
**Depends on**: Phase 9
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):
  1. User can click "Forgot password?" on the sign-in page, enter their email, and receive a password reset link via email
  2. User can set a new password using the reset link and immediately log in with the new credentials
  3. Password reset emails are delivered reliably (not caught by spam filters) and expired/used reset links show a clear error message
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: UI Polish
**Goal**: Navigation clearly shows the user where they are in the app at all times
**Depends on**: Phase 9
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):
  1. The currently active page is visually highlighted in the desktop sidebar navigation
  2. The currently active page is visually highlighted in the mobile navigation drawer
  3. Nested routes (e.g., lead detail pages under /dashboard) correctly highlight their parent nav item
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

## Progress

**Execution Order:**
v1.0 phases (1-6) are complete. v2.0 phases (7-8) are complete. v2.1 phases execute: 9 -> 10, 11, 12 (Phases 11 and 12 depend only on Phase 9 and can run after Phase 10 or in parallel).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Platform Foundation | v1.0 | 2/2 | Complete | 2026-03-13 |
| 2. Scraping Pipeline | v1.0 | 2/2 | Complete | 2026-03-14 |
| 3. Lead Intelligence and Dashboard | v1.0 | 3/3 | Complete | 2026-03-14 |
| 4. Multi-Source Expansion | v1.0 | 3/3 | Complete | 2026-03-14 |
| 5. Lead Management and Notifications | v1.0 | 3/3 | Complete | 2026-03-14 |
| 6. Billing and Launch Readiness | v1.0 | 2/2 | Complete | 2026-03-14 |
| 7. Billing Fix and Free Trial | v2.0 | 2/2 | Complete | 2026-03-15 |
| 8. Lead Automation | v2.0 | 2/2 | Complete | 2026-03-15 |
| 9. Regression Test Safety Net | v2.1 | 0/3 | Not started | - |
| 10. Query Optimizations | v2.1 | 0/? | Not started | - |
| 11. Forgot Password | v2.1 | 0/? | Not started | - |
| 12. UI Polish | v2.1 | 0/? | Not started | - |
