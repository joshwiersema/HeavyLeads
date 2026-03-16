# Requirements: LeadForge (formerly HeavyLeads)

**Defined:** 2026-03-13 (v1.0), Updated 2026-03-15 (v2.0, v2.1), 2026-03-16 (v3.0)
**Core Value:** Every morning, a blue-collar business owner opens LeadForge and sees fresh, high-scoring leads personalized to their industry, specializations, and service area.

## v1.0 Requirements (Complete)

### Data Ingestion

- [x] **DATA-01**: System scrapes building permit data from city/county databases for target jurisdictions
- [x] **DATA-02**: System scrapes government and private bid board postings (RFPs, contract awards)
- [x] **DATA-03**: System scrapes construction news and press releases for project announcements and groundbreakings
- [x] **DATA-04**: System performs Google dorking / deep web queries to surface project docs, contractor activity, and job postings
- [x] **DATA-05**: System runs scraping pipeline on a daily schedule and marks data with freshness timestamps
- [x] **DATA-06**: System deduplicates leads across multiple data sources into a single canonical lead record
- [x] **DATA-07**: System geocodes lead locations for radius-based geographic filtering

### Lead Intelligence

- [x] **LEAD-01**: System infers equipment needs from project type and description
- [x] **LEAD-02**: System scores leads by relevance to the dealer's configured equipment types and service radius
- [x] **LEAD-03**: System maps project phase to equipment-need timeline windows
- [x] **LEAD-04**: Lead detail view shows project info, location on map, key contacts, estimated equipment needs, and source attribution
- [x] **LEAD-05**: User can filter leads by equipment type with show-all default
- [x] **LEAD-06**: User can filter leads by geographic radius from their company HQ

### User Experience

- [x] **UX-01**: User sees a daily lead feed dashboard with fresh leads sorted by recency and relevance
- [x] **UX-02**: User can track lead status (New / Viewed / Contacted / Won / Lost)
- [x] **UX-03**: User can save searches and bookmark individual leads for quick re-access
- [x] **UX-04**: User receives a daily email digest summarizing new matching leads with links to dashboard
- [x] **UX-05**: Leads display freshness indicators (discovered date, age badges: New, This Week, Older)
- [x] **UX-06**: User can search leads by keyword and filter by date range and project size

### Platform

- [x] **PLAT-01**: User can sign up with email and password
- [x] **PLAT-02**: User session persists across browser refresh
- [x] **PLAT-03**: Multi-tenant company accounts with data isolation between competing dealers
- [x] **PLAT-04**: Company onboarding wizard: set HQ location, equipment types sold/rented, service radius
- [x] **PLAT-05**: Subscription billing with one-time setup fee + ongoing monthly charges via Stripe
- [x] **PLAT-06**: User can manage account settings and company profile

## v2.0 Requirements (Complete)

### Billing Fix & Trial

- [x] **BILL-01**: Fix Stripe customer creation error on signup
- [x] **BILL-02**: User starts a 7-day free trial via Stripe Checkout with credit card
- [x] **BILL-03**: Dashboard shows trial countdown banner with days remaining
- [x] **BILL-04**: Expired trial redirects to billing page
- [x] **BILL-05**: Setup fee is NOT charged during trial

### Lead Automation

- [x] **AUTO-01**: Vercel Cron runs scraping pipeline daily
- [x] **AUTO-02**: First-login trigger fires pipeline after onboarding
- [x] **AUTO-03**: Dashboard shows progress indicator while pipeline runs
- [x] **AUTO-04**: On-demand "Refresh Leads" button (rate-limited 1/hour per org)
- [x] **AUTO-05**: Scraper API route is secured with auth
- [x] **PLSH-02**: Empty dashboard state with informative messaging

## v2.1 Requirements (Complete)

- [x] **TEST-01**: Regression test suite covers all 15 v2.0 post-rework bug fixes
- [x] **TEST-02**: Test infrastructure supports mocking server actions and DB
- [x] **PERF-01**: Lead feed supports page navigation with Previous/Next controls
- [x] **PERF-02**: Bookmarks page uses batch query instead of N+1
- [x] **PERF-03**: Digest generator uses widest-filter merged query
- [x] **PERF-04**: Non-permit leads deduplicated by sourceUrl
- [x] **AUTH-01v2.1**: User can reset forgotten password via email link
- [x] **UI-01**: Active page highlighted in sidebar and mobile nav

## v3.0 Requirements

Requirements for LeadForge Multi-Industry Platform expansion.

### Schema & Data Model

- [x] **SCHM-01**: Organization has an industry field (heavy_equipment, hvac, roofing, solar, electrical) with existing orgs backfilled as heavy_equipment
- [x] **SCHM-02**: Organization profiles store industry-specific specializations, service areas, certifications, and target project values
- [x] **SCHM-03**: Leads have source type, cross-industry relevance tags, value tier, severity, deadline, and content-hash deduplication
- [x] **SCHM-04**: Lead enrichments stored in separate table (weather data, property data, incentive programs)
- [x] **SCHM-05**: Bookmarks support notes and pipeline status (saved/contacted/in_progress/won/lost)
- [x] **SCHM-06**: Scraper runs tracked per-adapter with status, counts, and error logging
- [x] **SCHM-07**: PostGIS extension enabled with geometry column on leads for spatial queries

### Onboarding

- [x] **ONBD-01**: User selects industry from 5 options as first onboarding step
- [x] **ONBD-02**: User enters company basics (name, size, address with geocoding, years in business)
- [x] **ONBD-03**: User sets service area via interactive map with radius slider or multiple areas
- [x] **ONBD-04**: User selects industry-specific specializations (different options per industry)
- [x] **ONBD-05**: User configures lead preferences (min project value, preferred lead types, alert frequency)
- [x] **ONBD-06**: User reviews all selections before completing onboarding
- [x] **ONBD-07**: Wizard state persists in sessionStorage across page refreshes

### Scraper Architecture

- [ ] **SCRP-01**: Scraper registry maps industries to adapter sets via factory pattern
- [ ] **SCRP-02**: Content-hash deduplication (SHA-256) for primary dedup
- [ ] **SCRP-03**: Rate limiter using p-queue with per-API concurrency and interval controls
- [ ] **SCRP-04**: Permit scraper factory generalized for Socrata/SODA3 multi-city support
- [ ] **SCRP-05**: SAM.gov adapter expanded with per-industry NAICS code filtering
- [ ] **SCRP-06**: NWS storm alert scraper polls active alerts every 30 minutes for roofing leads
- [ ] **SCRP-07**: FEMA disaster declaration scraper for roofing/heavy equipment demand signals
- [ ] **SCRP-08**: Code violation scraper for HVAC/roofing/electrical leads (2-3 Socrata cities)
- [ ] **SCRP-09**: EIA utility rate scraper for solar ROI context
- [ ] **SCRP-10**: Solar incentive lookup table (manually curated top 15 state programs)

### Scoring Engine

- [ ] **SCOR-01**: Score computed at query time per subscriber (same lead scores differently per org)
- [ ] **SCOR-02**: Distance dimension (0-25 pts) based on proximity to HQ/service areas
- [ ] **SCOR-03**: Relevance dimension (0-30 pts) based on specialization match and industry alignment
- [ ] **SCOR-04**: Value dimension (0-20 pts) based on estimated project value vs target range
- [ ] **SCOR-05**: Freshness dimension (0-15 pts) decaying over 30 days
- [ ] **SCOR-06**: Urgency dimension (0-10 pts) for storms, bid deadlines, violations, expiring incentives
- [ ] **SCOR-07**: Human-readable match reasons displayed on lead cards

### Lead Feed & Dashboard

- [ ] **FEED-01**: Lead cards show title, type badge, value, distance, score, match reasons, bookmark button
- [ ] **FEED-02**: Filter panel with source type, distance, value range, project type, date range, sort options
- [ ] **FEED-03**: Cursor-based pagination replacing offset-based approach
- [ ] **FEED-04**: Lead detail page with enrichment data, map, contacts, and similar leads
- [ ] **FEED-05**: Storm alert banner for urgent weather-based leads
- [ ] **FEED-06**: Industry badge in navigation showing org's industry

### Bookmarks & CRM

- [ ] **CRM-01**: User can bookmark leads with notes
- [ ] **CRM-02**: User can track pipeline status (saved/contacted/in_progress/won/lost)
- [ ] **CRM-03**: Bookmarks page filterable by status with inline notes

### Auth Hardening

- [ ] **AUTH-01v3**: Email verification required before accessing dashboard (existing users pre-verified)
- [x] **AUTH-02v3**: Atomic sign-up (user + org + active org in single transaction or cleanup on failure)
- [x] **AUTH-03v3**: Specific error messages (email in use, password too weak, org name taken)
- [x] **AUTH-04v3**: Sign-in redirects to /dashboard not /
- [x] **AUTH-05v3**: Confirm password field on sign-up form

### Billing

- [x] **BILL-01v3**: Industry-specific pricing config (setup fee + monthly per industry, configurable)
- [x] **BILL-02v3**: Fix double-nested checkout params in Stripe integration
- [x] **BILL-03v3**: Webhook handling for checkout.session.completed, invoice.paid/failed, subscription.deleted

### Notifications

- [ ] **NOTF-01**: Daily email digest with top 10 new leads (fix N+1 query with batch)
- [ ] **NOTF-02**: Weekly summary email with lead volume trends
- [ ] **NOTF-03**: Real-time storm alert emails for roofing subscribers
- [ ] **NOTF-04**: Unsubscribe mechanism with one-click link (CAN-SPAM compliance)
- [ ] **NOTF-05**: React Email templates with industry-specific styling
- [x] **NOTF-06**: Welcome email after onboarding completion

### Cron Architecture

- [ ] **CRON-01**: Per-industry scrape crons (parameterized route)
- [ ] **CRON-02**: Storm alert cron (every 30 min)
- [ ] **CRON-03**: Lead enrichment cron (runs after scraping)
- [ ] **CRON-04**: Lead expiration cron (mark stale leads)
- [ ] **CRON-05**: Email digest cron (daily at 7 AM)
- [ ] **CRON-06**: Weekly summary cron (Monday 8 AM)
- [ ] **CRON-07**: Scraper health monitoring cron

## Future Requirements (v3.1+)

### Deferred from v3.0

- **SCRP-11**: Energy benchmarking scraper for HVAC leads
- **SCRP-12**: NEVI program scraper for EV charging infrastructure leads
- **SCRP-13**: Utility interconnection queue scraper for solar market signals
- **SCRP-14**: Real estate keyword scraper for HVAC/roofing/solar leads
- **SCRP-15**: DSIRE API integration (if manual curation becomes unmanageable)
- **FEED-07**: SQL-based scoring (migrate from in-memory when lead volume exceeds 50K)
- **NOTF-07**: SMS notifications via Twilio
- **TEAM-01**: Team management (invite users, set roles)
- **CRM-04**: ServiceTitan/Housecall Pro CRM integrations
- **FEED-08**: Geographic exclusivity zones (premium tier)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated outreach/emailing | Risk of spam, compliance issues, wrong tone |
| Mobile native app | Web-first, mobile web responsive is sufficient |
| Real-time chat/messaging | Not core to lead discovery |
| International markets | U.S. only, data sources are U.S.-specific |
| Manual lead entry/import | Defer to future -- scraping is the core value |
| ML/AI lead scoring | Regex + keyword matching for v3.0; ML is future |
| DSIRE API subscription | Paid, opaque pricing; manual curation covers 80% of value |
| HailTrace API | Paid; NWS is the free upstream data source |

## Traceability

### v1.0 (Phases 1-6 Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 4 | Complete |
| DATA-03 | Phase 4 | Complete |
| DATA-04 | Phase 4 | Complete |
| DATA-05 | Phase 2 | Complete |
| DATA-06 | Phase 4 | Complete |
| DATA-07 | Phase 2 | Complete |
| LEAD-01 | Phase 3 | Complete |
| LEAD-02 | Phase 3 | Complete |
| LEAD-03 | Phase 3 | Complete |
| LEAD-04 | Phase 3 | Complete |
| LEAD-05 | Phase 3 | Complete |
| LEAD-06 | Phase 3 | Complete |
| UX-01 | Phase 3 | Complete |
| UX-02 | Phase 5 | Complete |
| UX-03 | Phase 5 | Complete |
| UX-04 | Phase 5 | Complete |
| UX-05 | Phase 3 | Complete |
| UX-06 | Phase 5 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 1 | Complete |
| PLAT-05 | Phase 6 | Complete |
| PLAT-06 | Phase 1 | Complete |

### v2.0 (Phases 7-8 Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| BILL-01 | Phase 7 | Complete |
| BILL-02 | Phase 7 | Complete |
| BILL-03 | Phase 7 | Complete |
| BILL-04 | Phase 7 | Complete |
| BILL-05 | Phase 7 | Complete |
| AUTO-01 | Phase 8 | Complete |
| AUTO-02 | Phase 8 | Complete |
| AUTO-03 | Phase 8 | Complete |
| AUTO-04 | Phase 8 | Complete |
| AUTO-05 | Phase 8 | Complete |
| PLSH-02 | Phase 8 | Complete |

### v2.1 (Phases 9-12 Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 9 | Complete |
| TEST-02 | Phase 9 | Complete |
| PERF-01 | Phase 10 | Complete |
| PERF-02 | Phase 10 | Complete |
| PERF-03 | Phase 10 | Complete |
| PERF-04 | Phase 10 | Complete |
| AUTH-01v2.1 | Phase 11 | Complete |
| UI-01 | Phase 12 | Complete |

### v3.0 (Phases 13-18)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHM-01 | Phase 13 | Complete |
| SCHM-02 | Phase 13 | Complete |
| SCHM-03 | Phase 13 | Complete |
| SCHM-04 | Phase 13 | Complete |
| SCHM-05 | Phase 13 | Complete |
| SCHM-06 | Phase 13 | Complete |
| SCHM-07 | Phase 13 | Complete |
| AUTH-02v3 | Phase 13 | Complete |
| AUTH-03v3 | Phase 13 | Complete |
| AUTH-04v3 | Phase 13 | Complete |
| AUTH-05v3 | Phase 13 | Complete |
| BILL-02v3 | Phase 13 | Complete |
| ONBD-01 | Phase 14 | Complete |
| ONBD-02 | Phase 14 | Complete |
| ONBD-03 | Phase 14 | Complete |
| ONBD-04 | Phase 14 | Complete |
| ONBD-05 | Phase 14 | Complete |
| ONBD-06 | Phase 14 | Complete |
| ONBD-07 | Phase 14 | Complete |
| BILL-01v3 | Phase 14 | Complete |
| BILL-03v3 | Phase 14 | Complete |
| NOTF-06 | Phase 14 | Complete |
| SCOR-01 | Phase 15 | Pending |
| SCOR-02 | Phase 15 | Pending |
| SCOR-03 | Phase 15 | Pending |
| SCOR-04 | Phase 15 | Pending |
| SCOR-05 | Phase 15 | Pending |
| SCOR-06 | Phase 15 | Pending |
| SCOR-07 | Phase 15 | Pending |
| FEED-01 | Phase 15 | Pending |
| FEED-02 | Phase 15 | Pending |
| FEED-03 | Phase 15 | Pending |
| FEED-04 | Phase 15 | Pending |
| FEED-06 | Phase 15 | Pending |
| SCRP-01 | Phase 16 | Pending |
| SCRP-02 | Phase 16 | Pending |
| SCRP-03 | Phase 16 | Pending |
| SCRP-04 | Phase 16 | Pending |
| SCRP-05 | Phase 16 | Pending |
| CRON-01 | Phase 16 | Pending |
| CRON-03 | Phase 16 | Pending |
| CRON-04 | Phase 16 | Pending |
| CRON-07 | Phase 16 | Pending |
| SCRP-06 | Phase 17 | Pending |
| SCRP-07 | Phase 17 | Pending |
| FEED-05 | Phase 17 | Pending |
| NOTF-03 | Phase 17 | Pending |
| CRON-02 | Phase 17 | Pending |
| SCRP-08 | Phase 18 | Pending |
| SCRP-09 | Phase 18 | Pending |
| SCRP-10 | Phase 18 | Pending |
| CRM-01 | Phase 18 | Pending |
| CRM-02 | Phase 18 | Pending |
| CRM-03 | Phase 18 | Pending |
| AUTH-01v3 | Phase 18 | Pending |
| NOTF-01 | Phase 18 | Pending |
| NOTF-02 | Phase 18 | Pending |
| NOTF-04 | Phase 18 | Pending |
| NOTF-05 | Phase 18 | Pending |
| CRON-05 | Phase 18 | Pending |
| CRON-06 | Phase 18 | Pending |

**Coverage:**
- v1.0 requirements: 25 total, 25 complete
- v2.0 requirements: 11 complete
- v2.1 requirements: 8 complete
- v3.0 requirements: 61 total, 61 mapped to phases
- Unmapped: 0

---
*Requirements defined: 2026-03-13 (v1.0)*
*Last updated: 2026-03-16 after v3.0 roadmap creation*
