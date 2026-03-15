# Roadmap: HeavyLeads

## Milestones

- [x] **v1.0 Core Product** - Phases 1-6 (shipped 2026-03-14)
- [ ] **v2.0 Production Rework** - Phases 7-11 (in progress)

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

### v2.0 Production Rework

- [ ] **Phase 7: Billing Fix and Free Trial** - Fix Stripe customer creation, add 7-day trial via Stripe Checkout, trial UI
- [ ] **Phase 8: Lead Automation** - Vercel Cron daily scraping, first-login trigger, on-demand refresh, empty state
- [ ] **Phase 9: Onboarding Expansion** - Company details step, logo upload, team invites
- [ ] **Phase 10: Guided Tour and Conversion Emails** - Dashboard product tour, pre-expiry conversion email sequence
- [ ] **Phase 11: Custom Search and Polish** - User-initiated location/keyword search, UI consistency pass

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
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Onboarding Expansion
**Goal**: New companies provide professional details and invite their team during a polished 5-step onboarding flow
**Depends on**: Phase 8
**Requirements**: ONBD-01, ONBD-02, ONBD-03
**Success Criteria** (what must be TRUE):
  1. Onboarding wizard collects company name, website, phone, industry segment, and logo as a new step before the existing location/equipment/radius steps
  2. User can upload a company logo during onboarding with a live preview, stored via Vercel Blob
  3. User can invite team members by email with role selection during onboarding, or skip the step to complete later
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Guided Tour and Conversion Emails
**Goal**: New users get a guided walkthrough of the dashboard, and trial users receive email nudges before their trial expires
**Depends on**: Phase 9
**Requirements**: ONBD-04, ONBD-05, PLSH-01
**Success Criteria** (what must be TRUE):
  1. After completing onboarding, user sees a guided dashboard tour (5-6 steps) covering the lead feed, filters, lead detail, bookmarks, and saved searches
  2. Tour only appears once per user -- returning users never see it again
  3. Trial users receive conversion emails at 3 days remaining, 1 day remaining, and on expiry day with a link to subscribe
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Custom Search and Polish
**Goal**: Users can search beyond their default filters and the app feels production-ready across all screens
**Depends on**: Phase 8
**Requirements**: SRCH-01, SRCH-02, SRCH-03, PLSH-03
**Success Criteria** (what must be TRUE):
  1. User can search for leads by specifying a custom location, keywords, and project type beyond their default organization filters
  2. Custom search results merge into the main lead feed with clear source attribution showing they came from a custom search
  3. Custom searches are rate-limited (3 per day for trial users, 10 per day for paid users) with remaining quota visible in the UI
  4. All screens have consistent styling, loading states, and error handling suitable for production use
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

## Progress

**Execution Order:**
v1.0 phases (1-6) are complete. v2.0 phases execute: 7 -> 8 -> 9 -> 10 -> 11.
Note: Phase 11 depends on Phase 8 (not Phase 10) and could run in parallel with Phases 9-10.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Platform Foundation | v1.0 | 2/2 | Complete | 2026-03-13 |
| 2. Scraping Pipeline | v1.0 | 2/2 | Complete | 2026-03-14 |
| 3. Lead Intelligence and Dashboard | v1.0 | 3/3 | Complete | 2026-03-14 |
| 4. Multi-Source Expansion | v1.0 | 3/3 | Complete | 2026-03-14 |
| 5. Lead Management and Notifications | v1.0 | 3/3 | Complete | 2026-03-14 |
| 6. Billing and Launch Readiness | v1.0 | 2/2 | Complete | 2026-03-14 |
| 7. Billing Fix and Free Trial | v2.0 | 0/? | Not started | - |
| 8. Lead Automation | v2.0 | 0/? | Not started | - |
| 9. Onboarding Expansion | v2.0 | 0/? | Not started | - |
| 10. Guided Tour and Conversion Emails | v2.0 | 0/? | Not started | - |
| 11. Custom Search and Polish | v2.0 | 0/? | Not started | - |
