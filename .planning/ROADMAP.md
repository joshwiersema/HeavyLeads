# Roadmap: HeavyLeads

## Overview

HeavyLeads is a data pipeline product with a SaaS frontend. The build order follows the data flow: platform foundation and tenant isolation first, then the scraping pipeline that produces raw leads, then the intelligence and dashboard layer that makes leads actionable for sales reps, then multi-source expansion for broader coverage, then workflow and notification features, and finally billing for monetization. Each phase delivers a coherent, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Platform Foundation** - Auth, multi-tenancy with data isolation, company onboarding wizard, and account management
- [x] **Phase 2: Scraping Pipeline** - Crawlee-based scraper framework, initial permit scrapers, daily scheduling, and geocoding
- [ ] **Phase 3: Lead Intelligence and Dashboard** - Equipment inference, lead scoring, timeline mapping, filterable daily feed, and lead detail view
- [x] **Phase 4: Multi-Source Expansion** - Bid board, news, and deep web scrapers with cross-source deduplication (completed 2026-03-14)
- [x] **Phase 5: Lead Management and Notifications** - Lead status tracking, saved searches, keyword search, and daily email digest (completed 2026-03-14)
- [ ] **Phase 6: Billing and Launch Readiness** - Stripe subscription billing with one-time setup fee and ongoing monthly charges

## Phase Details

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
- [ ] 03-03-PLAN.md -- Lead detail page with interactive Google Map, equipment needs with confidence, timeline urgency windows, and source attribution

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
- [ ] 04-02-PLAN.md -- SAM.gov bid board adapter, RSS news adapters (ENR, Construction Dive, PR Newswire), Google dorking adapter via Serper.dev
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
- [ ] 05-01-PLAN.md -- Schema tables (lead_statuses, bookmarks, saved_searches), query extensions (keyword, date, size filters), and server actions for status/bookmark/search CRUD
- [ ] 05-02-PLAN.md -- Dashboard UI integration: status badges, bookmark toggles, advanced filters, bookmarks page, saved searches page, sidebar navigation
- [ ] 05-03-PLAN.md -- Daily email digest with Resend + React Email, digest generator, API route, and scheduler integration

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
- [ ] 06-01-PLAN.md -- Install @better-auth/stripe plugin, configure Stripe integration in auth, create subscription schema, add dashboard access gate
- [ ] 06-02-PLAN.md -- Billing settings page with subscribe/manage flows, billing status display, and test coverage

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Note: Phases 4 and 6 depend on Phase 2 and Phase 1 respectively (not strictly sequential with adjacent phases), but execute in numeric order.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation | 2/2 | Complete | 2026-03-13 |
| 2. Scraping Pipeline | 2/2 | Complete | 2026-03-14 |
| 3. Lead Intelligence and Dashboard | 3/3 | Complete | 2026-03-14 |
| 4. Multi-Source Expansion | 3/3 | Complete   | 2026-03-14 |
| 5. Lead Management and Notifications | 3/3 | Complete   | 2026-03-14 |
| 6. Billing and Launch Readiness | 0/2 | Not started | - |
