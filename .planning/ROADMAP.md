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
- [x] 13-01-PLAN.md -- Drizzle schema evolution (org industry, organization-profiles rename, leads expansion, PostGIS geometry, bookmarks CRM columns, lead_enrichments table, scraper_runs table) with 9 ordered migrations
- [x] 13-02-PLAN.md -- Atomic sign-up server action with cleanup, confirm-password field, specific error messages, sign-in redirect fix, and billing params verification

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
**Plans**: 3 plans

Plans:
- [x] 14-01-PLAN.md -- Wizard infrastructure (types, config, reducer, sessionStorage persistence, Zod schemas) and first two steps (Industry Selection, Company Basics with Google Places autocomplete)
- [x] 14-02-PLAN.md -- Remaining wizard steps (Service Area map, Specializations, Lead Preferences, Review & Confirm), server action rewrite, and end-to-end wiring
- [x] 14-03-PLAN.md -- Industry-specific Stripe pricing config, webhook handler, welcome email, and signup industry parameter

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
**Plans**: 3 plans

Plans:
- [x] 15-01-PLAN.md -- 5-dimension scoring engine (distance, relevance, value, freshness, urgency) with match reasons, cursor-based feed query, and unit tests
- [x] 15-02-PLAN.md -- Lead card redesign with score/match reasons, industry-aware filter panel, cursor pagination UI, and industry badge in sidebar
- [x] 15-03-PLAN.md -- Lead detail page with score breakdown, enrichment data sections, dual-marker map with service radius, and similar leads

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
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md -- Factory pattern replacing global Map registry, SHA-256 content-hash dedup, p-queue rate limiters, pipeline scraper_runs integration, route updates
- [ ] 16-02-PLAN.md -- Socrata SODA3 base adapter with SODA2 fallback, Austin/Dallas migration, SAM.gov multi-NAICS with rate limiting
- [ ] 16-03-PLAN.md -- Per-industry cron routes with staggered schedules, lead enrichment cron, lead expiration cron, scraper health monitoring cron

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
| 13. Schema Foundation | v3.0 | 2/2 | Complete | 2026-03-16 |
| 14. Industry Onboarding | v3.0 | 3/3 | Complete | 2026-03-16 |
| 15. Scoring Engine & Lead Feed | v3.0 | 3/3 | Complete | 2026-03-16 |
| 16. Cron & Scraper Architecture | v3.0 | 0/3 | Not started | - |
| 17. Storm Alerts & Weather | v3.0 | 0/TBD | Not started | - |
| 18. Intelligence & Polish | v3.0 | 0/TBD | Not started | - |
