# Roadmap: LeadForge

## Milestones

- [x] **v1.0 Core Product** - Phases 1-6 (shipped 2026-03-14)
- [x] **v2.0 Production Rework** - Phases 7-8 (shipped 2026-03-15)
- [x] **v2.1 Bug Fixes & Hardening** - Phases 9-12 (shipped 2026-03-16)
- [ ] **v3.0 LeadForge Multi-Industry Platform** - Phases 13-18 (in progress)

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

<details>
<summary>v2.1 Bug Fixes & Hardening (Phases 9-12) - SHIPPED 2026-03-16</summary>

- [x] **Phase 9: Regression Test Safety Net** - Test infrastructure and regression tests for all 15 v2.0 post-rework bug fixes
- [x] **Phase 10: Query Optimizations** - Pagination, bookmarks batch query, digest optimization, and non-permit dedup
- [x] **Phase 11: Forgot Password** - Password reset flow via email link from sign-in page
- [x] **Phase 12: UI Polish** - Active nav highlighting in desktop sidebar and mobile nav drawer

</details>

### v3.0 LeadForge Multi-Industry Platform

- [ ] **Phase 13: Schema Foundation** - Database schema evolution for multi-industry support with PostGIS, auth hardening, and billing fix
- [ ] **Phase 14: Industry Onboarding** - Multi-step wizard with industry-specific configuration, pricing, webhooks, and welcome email
- [ ] **Phase 15: Scoring Engine & Lead Feed** - Query-time 5-dimension scoring, cursor pagination, filter panel, and dashboard overhaul
- [ ] **Phase 16: Cron & Scraper Architecture** - Factory registry, hash dedup, rate limiting, generalized permits, SAM.gov expansion, and cron routes
- [ ] **Phase 17: Storm Alerts & Weather** - NWS storm scraper, FEMA disaster scraper, storm banner, and storm email alerts
- [ ] **Phase 18: Intelligence & Polish** - Code violations, utility rates, solar incentives, CRM bookmarks, email verification, digest overhaul, and React Email templates

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

<details>
<summary>v2.1 Phase Details (Phases 9-12) - SHIPPED 2026-03-16</summary>

### Phase 9: Regression Test Safety Net
**Goal**: All 15 v2.0 post-rework bug fixes have regression test coverage, establishing a safety net before any production code changes in this milestone
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run test` executes the full test suite and all tests pass with zero configuration errors
  2. Every v2.0 post-rework bug fix has at least one test that would fail if the fix were reverted
  3. Server actions can be tested using established mocking patterns for `@/lib/db`, `@/lib/auth`, `next/headers`, and `next/cache` without hitting the production database
  4. Zero production source files are modified in this phase -- only test files and test infrastructure
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- Add npm test script, fix 6 failing pipeline tests, create tests/regressions/ directory
- [x] 09-02-PLAN.md -- 9 unit/logic regression tests
- [x] 09-03-PLAN.md -- 6 component regression tests

### Phase 10: Query Optimizations
**Goal**: Lead feed supports page navigation, bookmarks load in a single query, digest emails generate efficiently, and non-permit leads are deduplicated by source URL
**Depends on**: Phase 9
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. User can navigate between pages of leads using Previous/Next controls with a page indicator
  2. Bookmarks page loads all bookmarked leads in a single round-trip instead of one query per bookmark
  3. Digest email generation runs one broad query per user instead of one query per saved search
  4. Non-permit leads with matching source URLs are detected and skipped instead of creating duplicates
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md -- Pagination query + UI and bookmarks batch query
- [x] 10-02-PLAN.md -- Digest widest-filter optimization and non-permit sourceUrl dedup

### Phase 11: Forgot Password
**Goal**: Locked-out users can recover their account via email without contacting support
**Depends on**: Phase 9
**Requirements**: AUTH-01v2.1
**Success Criteria** (what must be TRUE):
  1. User can click "Forgot password?" on the sign-in page and receive a password reset link via email
  2. User can set a new password using the reset link and immediately log in with the new credentials
  3. Expired or used reset links show a clear error message
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md -- Validation schemas, email template, auth.ts sendResetPassword config, forgot-password form/page, sign-in link
- [x] 11-02-PLAN.md -- Reset password form/page, full-suite verification and build check

### Phase 12: UI Polish
**Goal**: Navigation clearly shows the user where they are in the app at all times
**Depends on**: Phase 9
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):
  1. The currently active page is visually highlighted in the desktop sidebar navigation
  2. The currently active page is visually highlighted in the mobile navigation drawer
  3. Nested routes correctly highlight their parent nav item
**Plans**: 1 plan

Plans:
- [x] 12-01-PLAN.md -- Shared nav config with route matching, SidebarNav client component, mobile nav fix, and active-state tests

</details>

### Phase 13: Schema Foundation
**Goal**: Database supports multi-industry organizations, enriched leads with spatial queries, and CRM-lite bookmarks -- all backward-compatible with existing heavy-equipment users
**Depends on**: Phase 12 (v2.1 complete)
**Requirements**: SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, SCHM-06, SCHM-07, AUTH-02v3, AUTH-03v3, AUTH-04v3, AUTH-05v3, BILL-02v3
**Success Criteria** (what must be TRUE):
  1. Every organization has an industry field and all existing orgs are backfilled as heavy_equipment -- existing users see zero changes to their experience
  2. Organization profiles store industry-specific specializations, service areas, certifications, and target project values with all new fields nullable for existing users
  3. Leads support content-hash deduplication, cross-industry relevance tags, value tier, severity, deadline, and a PostGIS geometry column for spatial queries
  4. Sign-up creates user, organization, and active-org membership atomically -- partial failures are cleaned up and never leave orphaned records
  5. Sign-up form shows a confirm-password field and displays specific error messages for email-in-use, password-too-weak, and org-name-taken instead of generic errors
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md -- Drizzle schema evolution (org industry, organization-profiles rename, leads expansion, PostGIS geometry, bookmarks CRM columns, lead_enrichments table, scraper_runs table) with 9 ordered migrations
- [ ] 13-02-PLAN.md -- Atomic sign-up server action with cleanup, confirm-password field, specific error messages, sign-in redirect fix, and billing params verification

### Phase 14: Industry Onboarding
**Goal**: New users from any of the 5 industries can complete a guided onboarding wizard that collects industry-specific profile data and starts their subscription
**Depends on**: Phase 13
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07, BILL-01v3, BILL-03v3, NOTF-06
**Success Criteria** (what must be TRUE):
  1. New user selects their industry as the first onboarding step and sees only industry-relevant configuration options in subsequent steps
  2. User enters company basics, sets service area via interactive map with radius slider, selects industry-specific specializations, and configures lead preferences across a multi-step wizard
  3. User reviews all selections on a summary step before completing onboarding, and wizard state survives page refreshes via sessionStorage
  4. Stripe checkout uses industry-specific pricing (setup fee + monthly varies by industry) and webhook handles checkout.session.completed, invoice.paid/failed, and subscription.deleted events
  5. User receives a welcome email after completing onboarding
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

### Phase 15: Scoring Engine & Lead Feed
**Goal**: Every user sees a personalized lead feed where the same lead scores differently per subscriber based on their industry, location, specializations, and preferences
**Depends on**: Phase 14
**Requirements**: SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05, SCOR-06, SCOR-07, FEED-01, FEED-02, FEED-03, FEED-04, FEED-06
**Success Criteria** (what must be TRUE):
  1. Lead scores are computed at query time per subscriber -- the same lead produces different scores for different organizations based on distance, relevance, value, freshness, and urgency dimensions
  2. Lead cards display title, type badge, value estimate, distance, composite score, human-readable match reasons, and a bookmark button
  3. User can filter leads by source type, distance, value range, project type, date range, and sort by score/date/distance using a filter panel
  4. Lead feed uses cursor-based pagination that maintains stable ordering even as new leads are inserted
  5. Lead detail page shows enrichment data (weather, property, incentives), map, contacts, and similar leads from other industries
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Cron & Scraper Architecture
**Goal**: The scraping system runs per-industry pipelines on independent schedules with proper rate limiting, hash-based deduplication, and health monitoring
**Depends on**: Phase 15
**Requirements**: SCRP-01, SCRP-02, SCRP-03, SCRP-04, SCRP-05, CRON-01, CRON-03, CRON-04, CRON-07
**Success Criteria** (what must be TRUE):
  1. Each industry has its own set of scraper adapters returned by a factory function, and adding a new adapter for an industry requires only registering it in the factory -- no pipeline code changes
  2. Duplicate leads are detected via SHA-256 content hashing before insert, eliminating redundant records across scraper runs
  3. External API calls respect per-API rate limits (SAM.gov 10/s, Socrata 1000/hr) via p-queue concurrency controls, and 3 consecutive failures disable that source for 1 hour
  4. Permit scraper supports multiple Socrata/SODA3 cities per industry and SAM.gov filters by industry-specific NAICS codes
  5. Scraper runs are tracked per-adapter with status, lead counts, and error logs visible through a health monitoring cron
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

### Phase 17: Storm Alerts & Weather
**Goal**: Roofing subscribers receive storm alerts within 30 minutes of NWS issuance, and disaster declarations surface demand signals across industries
**Depends on**: Phase 16
**Requirements**: SCRP-06, SCRP-07, FEED-05, NOTF-03, CRON-02
**Success Criteria** (what must be TRUE):
  1. NWS storm alerts are polled every 30 minutes and matched against roofing subscribers' service areas to generate storm-sourced leads with a 25-point urgency scoring boost
  2. FEMA disaster declarations are scraped and create demand-signal leads for roofing, heavy equipment, and relevant industries
  3. Roofing subscribers see a storm alert banner on their dashboard when active storm alerts intersect their service area
  4. Roofing subscribers receive immediate email alerts (not batched in daily digest) when storm events affect their service area
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD

### Phase 18: Intelligence & Polish
**Goal**: The platform delivers industry-specific intelligence (code violations, utility rates, solar incentives), CRM-lite bookmark management, email verification, and a polished notification system with React Email templates and CAN-SPAM compliance
**Depends on**: Phase 16
**Requirements**: SCRP-08, SCRP-09, SCRP-10, CRM-01, CRM-02, CRM-03, AUTH-01v3, NOTF-01, NOTF-02, NOTF-04, NOTF-05, CRON-05, CRON-06
**Success Criteria** (what must be TRUE):
  1. Code violation leads are scraped from 2-3 Socrata cities and tagged for HVAC, roofing, and electrical industries; EIA utility rates provide solar ROI context on lead detail pages; top 15 state solar incentive programs surface on solar lead cards
  2. User can bookmark leads with notes, track pipeline status (saved/contacted/in_progress/won/lost), and filter the bookmarks page by status with inline note editing
  3. New users must verify their email address before accessing the dashboard, while existing users are pre-verified and unaffected
  4. Daily digest emails send the top 10 new leads at 7 AM with industry-specific styling via React Email templates; weekly summary emails send lead volume trends on Monday at 8 AM
  5. Every email includes a one-click unsubscribe link (CAN-SPAM compliance), and unsubscribe preferences persist across all email types
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD

## Progress

**Execution Order:**
v1.0 phases (1-6) complete. v2.0 phases (7-8) complete. v2.1 phases (9-12) complete. v3.0 phases execute sequentially: 13 -> 14 -> 15 -> 16 -> 17, 18 (Phases 17 and 18 both depend on Phase 16 and can run in parallel).

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
| 9. Regression Test Safety Net | v2.1 | 3/3 | Complete | 2026-03-16 |
| 10. Query Optimizations | v2.1 | 2/2 | Complete | 2026-03-16 |
| 11. Forgot Password | v2.1 | 2/2 | Complete | 2026-03-16 |
| 12. UI Polish | v2.1 | 1/1 | Complete | 2026-03-16 |
| 13. Schema Foundation | v3.0 | 0/2 | In Progress | - |
| 14. Industry Onboarding | v3.0 | 0/TBD | Not started | - |
| 15. Scoring Engine & Lead Feed | v3.0 | 0/TBD | Not started | - |
| 16. Cron & Scraper Architecture | v3.0 | 0/TBD | Not started | - |
| 17. Storm Alerts & Weather | v3.0 | 0/TBD | Not started | - |
| 18. Intelligence & Polish | v3.0 | 0/TBD | Not started | - |
