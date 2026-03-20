# Roadmap: GroundPulse

## Milestones

- [x] **v1.0 Core Product** - Phases 1-6 (shipped 2026-03-14)
- [x] **v2.0 Production Rework** - Phases 7-8 (shipped 2026-03-15)
- [x] **v2.1 Bug Fixes & Hardening** - Phases 9-12 (shipped 2026-03-16)
- [x] **v3.0 LeadForge Multi-Industry Platform** - Phases 13-18 (shipped 2026-03-16)
- [ ] **v4.0 GroundPulse Nationwide** - Phases 19-24 (in progress)

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

<details>
<summary>v3.0 LeadForge Multi-Industry Platform (Phases 13-18) - SHIPPED 2026-03-16</summary>

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
- [x] 16-01-PLAN.md -- Factory pattern replacing global Map registry, SHA-256 content-hash dedup, p-queue rate limiters, pipeline scraper_runs integration, route updates
- [x] 16-02-PLAN.md -- Socrata SODA3 base adapter with SODA2 fallback, Austin/Dallas migration, SAM.gov multi-NAICS with rate limiting
- [x] 16-03-PLAN.md -- Per-industry cron routes with staggered schedules, lead enrichment cron, lead expiration cron, scraper health monitoring cron

### Phase 17: Storm Alerts & Weather
**Goal**: Roofing subscribers receive storm alerts within 30 minutes of NWS issuance, and disaster declarations surface demand signals across industries
**Depends on**: Phase 16
**Requirements**: SCRP-06, SCRP-07, FEED-05, NOTF-03, CRON-02
**Success Criteria** (what must be TRUE):
  1. NWS storm alerts are polled every 30 minutes and matched against roofing subscribers' service areas to generate storm-sourced leads with a 25-point urgency scoring boost
  2. FEMA disaster declarations are scraped and create demand-signal leads for roofing, heavy equipment, and relevant industries
  3. Roofing subscribers see a storm alert banner on their dashboard when active storm alerts intersect their service area
  4. Roofing subscribers receive immediate email alerts (not batched in daily digest) when storm events affect their service area
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md -- NWS storm adapter, FEMA disaster adapter, content hash + rate limiter updates, factory registration, 25-point storm urgency boost, storm cron route, vercel.json 30-min schedule
- [x] 17-02-PLAN.md -- Storm alert spatial queries, storm alert banner on dashboard (roofing only), storm email template, real-time email dispatch to affected roofing subscribers

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
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md -- Industry intelligence scrapers: code violation Socrata adapters (Austin/Dallas/Houston), EIA utility rate adapter, solar incentive lookup table, factory registration
- [x] 18-02-PLAN.md -- CRM-lite bookmarks (pipeline status, notes, filtering) and email verification gate for new users
- [x] 18-03-PLAN.md -- Notification system overhaul: React Email templates with industry styling, daily/weekly digest crons, notification preferences, one-click unsubscribe (CAN-SPAM)

</details>

## v4.0 GroundPulse Nationwide (Phases 19-24)

**Milestone Goal:** Expand from 3-city Texas coverage to all 50 states, fix the broken scoring engine so leads actually differentiate, add every viable public lead source, rebrand to GroundPulse, and redesign the landing page.

- [x] **Phase 19: Infrastructure Hardening** - Fan-out cron batching, geocoding cache with Nominatim fallback, lead expiration, and data_portals table (completed 2026-03-20)
- [x] **Phase 20: Scoring Engine Fix** - Score differentiation, value estimation heuristics, keyword relevance, freshness curves, legacy system removal (completed 2026-03-20)
- [x] **Phase 21: Dynamic Portal Discovery & Nationwide Coverage** - Socrata/ArcGIS auto-discovery, generic adapters, heuristic field mapping, 50-state permit coverage (completed 2026-03-20)
- [x] **Phase 22: Federal & Specialty Data Sources** - USAspending, OSHA, EPA Brownfields, Grants.gov, FERC, FCC adapters (completed 2026-03-20)
- [x] **Phase 23: Feed Performance Optimization** - SQL LIMIT, PostGIS spatial index, sub-3s dashboard loads, cross-source dedup (completed 2026-03-20)
- [ ] **Phase 24: GroundPulse Rebrand & Landing Page** - Full rebrand from HeavyLeads, new logo, handcrafted landing page with 5-industry showcase

## Phase Details

### Phase 19: Infrastructure Hardening
**Goal**: The pipeline can absorb 10x data volume without hitting Vercel timeouts, geocoding cost walls, or Neon storage limits -- and portal configs live in the database, not in code
**Depends on**: Phase 18 (v3.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Daily scraping cron completes successfully with 20+ adapters by running them in batched fan-out invocations that each finish under 300 seconds
  2. A lead with an address that was geocoded yesterday does not trigger a new Google Maps or Nominatim API call today -- the cached coordinates are reused
  3. When Google Maps free tier (10K/month) is exhausted, new geocoding requests automatically route to Nominatim and still return valid coordinates
  4. Leads older than 45 days that the user has not bookmarked or interacted with are automatically removed, keeping database storage under control
  5. The data_portals table exists and can store Socrata/ArcGIS portal configs as database rows with JSONB field mappings -- no new TypeScript files needed per city
**Plans**: 3 plans

Plans:
- [ ] 19-01-PLAN.md -- Geocoding cache table with 90-day expiry and Nominatim fallback when Google Maps quota exhausted
- [ ] 19-02-PLAN.md -- Fan-out cron batching with batch orchestrator, batch execution endpoint, and parallel Promise.allSettled invocation
- [ ] 19-03-PLAN.md -- 45-day lead hard-deletion with bookmark/interaction preservation and data_portals DB table for portal configs

### Phase 20: Scoring Engine Fix
**Goal**: Leads produce meaningfully different scores that vary by industry, and the single scoring engine is the only one in the codebase
**Depends on**: Phase 19
**Requirements**: SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05, SCOR-06
**Success Criteria** (what must be TRUE):
  1. Across a sample of 1,000+ leads, score standard deviation exceeds 15 -- leads are clearly differentiated, not clustered at the same value
  2. Leads with null estimatedValue receive a valueTier derived from their projectType (e.g., "commercial_building" scores higher than "fence_repair") instead of a flat fallback
  3. An HVAC permit scores highest for an HVAC subscriber, a solar permit scores highest for a solar subscriber, and a roofing permit scores highest for a roofing subscriber -- industry routing is verified end-to-end
  4. Storm alerts decay in hours, bid deadlines decay in days, and permits decay in weeks -- each source type has its own freshness curve instead of a single flat decay
  5. Only one scoring engine exists in the codebase (src/lib/scoring/); the legacy src/lib/leads/scoring.ts is deleted with no remaining imports
**Plans**: 3 plans

Plans:
- [x] 20-01-PLAN.md -- Value estimation heuristic, source-type freshness curves, keyword-to-projectType relevance scoring
- [x] 20-02-PLAN.md -- Legacy scoring system removal and queries.ts migration to scoreLeadForOrg
- [x] 20-03-PLAN.md -- Industry routing verification tests and score standard deviation validation

### Phase 21: Dynamic Portal Discovery & Nationwide Coverage
**Goal**: The platform automatically discovers and scrapes permit and violation datasets from hundreds of cities across all 50 states without per-city code deployments
**Depends on**: Phase 20
**Requirements**: NATL-01, NATL-02, NATL-03, NATL-04, NATL-05, NATL-06, NATL-07, NATL-08
**Success Criteria** (what must be TRUE):
  1. A weekly discovery cron queries the Socrata Discovery API and stores 100+ permit dataset configs in the data_portals table without human intervention
  2. The same weekly discovery cron queries the ArcGIS Hub API and discovers additional non-Socrata municipal datasets
  3. GenericSocrataAdapter and GenericArcGISAdapter read their config (endpoint, field mappings, filters) from data_portals rows -- zero per-city TypeScript adapter files are needed for new cities
  4. The heuristic field mapper correctly auto-maps column names for 90%+ of the top-50-city permit datasets (e.g., recognizing permit_number, permit_no, PERMIT_NUM as the same concept)
  5. A user who signs up in a state with no hardcoded adapter (e.g., Oregon, Michigan, Florida) sees local leads in their feed within 24 hours of the next pipeline run
**Plans**: 4 plans

Plans:
- [x] 21-01-PLAN.md -- Heuristic field mapper and GenericSocrataAdapter (reads config from data_portals)
- [x] 21-02-PLAN.md -- GenericArcGISAdapter (reads config from data_portals, GeoJSON coordinate extraction)
- [x] 21-03-PLAN.md -- Socrata Discovery and ArcGIS Discovery services (catalog API queries, field auto-mapping)
- [x] 21-04-PLAN.md -- Discovery cron route, portal adapter factory, pipeline integration, seed migration, vercel.json

### Phase 22: Federal & Specialty Data Sources
**Goal**: The platform surfaces federal construction contracts, OSHA inspections, EPA brownfield sites, federal grants, energy infrastructure filings, and telecom tower registrations as lead types alongside municipal permits
**Depends on**: Phase 21
**Requirements**: FED-01, FED-02, FED-03, FED-04, FED-05, FED-06, FED-07
**Success Criteria** (what must be TRUE):
  1. USAspending.gov awarded federal construction contracts appear as leads with source type "contract-award" and include contract value, agency, and location
  2. OSHA construction site inspection records appear as leads with source type "inspection" and signal active worksites or remediation needs
  3. EPA Brownfields/ACRES contaminated site cleanup opportunities appear as leads with source type "brownfield" and include site coordinates and cleanup status
  4. Grants.gov federal construction grant opportunities appear as leads with source type "grant" and include funding amount and application deadline
  5. FERC energy infrastructure filings and FCC antenna structure registrations appear as leads with source types "energy" and "telecom" respectively
**Plans**: 3 plans

Plans:
- [ ] 22-01-PLAN.md -- Source types, rate limiters, USAspending contracts adapter, OSHA inspections adapter
- [ ] 22-02-PLAN.md -- EPA Brownfields adapter, Grants.gov adapter
- [ ] 22-03-PLAN.md -- FERC energy adapter, FCC antenna adapter, register all 6 adapters in index.ts

### Phase 23: Feed Performance Optimization
**Goal**: The dashboard loads fast with 50K+ leads in the database, distance filtering uses spatial indexes instead of per-row computation, and duplicate leads from overlapping sources are caught
**Depends on**: Phase 22
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. All lead feed queries use SQL-level LIMIT and OFFSET -- the server never fetches all leads and slices in memory
  2. Distance filtering uses the PostGIS spatial index on the leads.location column instead of computing Haversine distance per row for every page load
  3. The dashboard page (leads feed with filters, scoring, and pagination) loads in under 3 seconds with 50,000+ leads in the database
  4. The same permit appearing on both a city Socrata portal and a county Socrata portal is detected and deduplicated so the user sees it only once
**Plans**: 2 plans

Plans:
- [ ] 23-01-PLAN.md -- PostGIS location population in pipeline, ST_DWithin spatial queries replacing Haversine, SQL LIMIT in getFilteredLeadsWithCount
- [ ] 23-02-PLAN.md -- Cross-source deduplication with permit number fuzzy match and date+address compound matching

### Phase 24: GroundPulse Rebrand & Landing Page
**Goal**: The product is fully rebranded from HeavyLeads to GroundPulse with a new identity, and the landing page feels handcrafted and trustworthy across all 5 industries
**Depends on**: Phase 19 (can run in parallel with Phases 20-23 after infrastructure is stable)
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, LAND-01, LAND-02, LAND-03, LAND-04, LAND-05
**Success Criteria** (what must be TRUE):
  1. Zero references to "HeavyLeads" or "LeadForge" remain in the codebase, UI, emails, or metadata -- every user-facing surface says "GroundPulse"
  2. A new GroundPulse logo/mark is deployed in the header, favicon, emails, and OG images
  3. The landing page showcases all 5 industries (heavy equipment, HVAC, roofing, solar, electrical) with specific value propositions for each -- not generic "we help contractors" copy
  4. The landing page includes an interactive or visual element that demonstrates the product (live demo, animated dashboard preview, or interactive lead explorer) -- not just text and icons
  5. A first-time visitor would trust this landing page enough to enter their credit card -- it feels professional, specific, and handcrafted rather than AI-generated or templated
**Plans**: 3 plans

Plans:
- [ ] 24-01-PLAN.md -- Global rebrand: replace HeavyLeads/LeadForge with GroundPulse across 55+ files, update GP monogram
- [ ] 24-02-PLAN.md -- Handcrafted landing page with 5-industry showcase, interactive dashboard preview, and trade-specific copy
- [ ] 24-03-PLAN.md -- Full verification sweep: zero old brand references, TypeScript compilation, all tests pass

## Progress

**Execution Order:**
v1.0 phases (1-6) complete. v2.0 phases (7-8) complete. v2.1 phases (9-12) complete. v3.0 phases (13-18) complete. v4.0 phases execute sequentially: 19 -> 20 -> 21 -> 22 -> 23. Phase 24 can start after Phase 19 and run in parallel with 20-23.

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
| 16. Cron & Scraper Architecture | v3.0 | 3/3 | Complete | 2026-03-16 |
| 17. Storm Alerts & Weather | v3.0 | 2/2 | Complete | 2026-03-16 |
| 18. Intelligence & Polish | v3.0 | 3/3 | Complete | 2026-03-16 |
| 19. Infrastructure Hardening | 3/3 | Complete    | 2026-03-20 | - |
| 20. Scoring Engine Fix | v4.0 | Complete    | 2026-03-20 | 2026-03-20 |
| 21. Dynamic Portal Discovery & Nationwide Coverage | v4.0 | Complete    | 2026-03-20 | 2026-03-20 |
| 22. Federal & Specialty Data Sources | 3/3 | Complete    | 2026-03-20 | - |
| 23. Feed Performance Optimization | 2/2 | Complete    | 2026-03-20 | - |
| 24. GroundPulse Rebrand & Landing Page | v4.0 | 0/3 | Not started | - |
