# Requirements: HeavyLeads

**Defined:** 2026-03-13 (v1.0), Updated 2026-03-15 (v2.0, v2.1)
**Core Value:** Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed.

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

## v2.0 Requirements

### Billing Fix & Trial

- [x] **BILL-01**: Fix Stripe customer creation error on signup (create org-level customer, not user-level)
- [x] **BILL-02**: User starts a 7-day free trial via Stripe Checkout with credit card
- [x] **BILL-03**: Dashboard shows trial countdown banner with days remaining
- [x] **BILL-04**: Expired trial redirects to billing page with "Trial ended" messaging and subscribe CTA
- [x] **BILL-05**: Setup fee is NOT charged during trial — only on conversion to paid

### Lead Automation

- [x] **AUTO-01**: Vercel Cron runs scraping pipeline daily (replace dead node-cron)
- [x] **AUTO-02**: First-login trigger fires pipeline after onboarding so new users see leads immediately
- [x] **AUTO-03**: Dashboard shows progress indicator while pipeline runs
- [x] **AUTO-04**: On-demand "Refresh Leads" button in dashboard (rate-limited 1/hour per org)
- [x] **AUTO-05**: Scraper API route is secured with auth (CRON_SECRET for cron, session for user-triggered)
- [x] **PLSH-02**: Empty dashboard state with informative messaging (not blank page)

### Deferred from v2.0

- [ ] **ONBD-01**: Onboarding collects company details (name, website, phone, logo, industry segment)
- [ ] **ONBD-02**: Logo upload via Vercel Blob with preview
- [ ] **ONBD-03**: Team invite step — invite members by email with role selection (skip-able)
- [ ] **ONBD-04**: Guided dashboard tour triggers after onboarding (5-6 steps)
- [ ] **ONBD-05**: Tour only shows once per user (tracked via hasSeenTour flag)
- [ ] **SRCH-01**: User can search for leads by custom location, keywords, and project type
- [ ] **SRCH-02**: Custom search results merge into the main lead feed
- [ ] **SRCH-03**: Custom searches are rate-limited (3/day trial, 10/day paid)
- [ ] **PLSH-01**: Pre-expiry conversion emails at 3 days, 1 day, and expiry day
- [ ] **PLSH-03**: Overall UI consistency and production readiness pass

## v2.1 Requirements

Requirements for Bug Fixes & Hardening milestone.

### Testing

- [ ] **TEST-01**: Regression test suite covers all 15 v2.0 post-rework bug fixes (permit upsert, geocoding null, lead query sort, org slug, sign-in redirect, Stripe idempotency, onboarding upsert, mobile nav, landing page, pricing display, error boundaries, date formatting, loading states, equipmentTypes guard, geocoding error handling in forms)
- [ ] **TEST-02**: Test infrastructure supports mocking server actions, next/headers, and @/lib/db with established patterns

### Query Performance

- [ ] **PERF-01**: Lead feed supports page navigation with Previous/Next controls, page indicator, and URL-based page state that preserves all existing filters
- [ ] **PERF-02**: Bookmarks page fetches all bookmarked leads in a single batch query using inArray instead of individual getLeadById calls
- [ ] **PERF-03**: Digest generator runs one merged query per user (widest filters) instead of one query per saved search, then filters in memory per search
- [ ] **PERF-04**: Non-permit leads are deduplicated by sourceUrl via partial unique index; dedup check uses sourceUrl as primary key when available

### Auth

- [ ] **AUTH-01**: User can reset forgotten password via email link from sign-in page (better-auth native sendResetPassword with Resend)

### UI

- [ ] **UI-01**: Active page is visually highlighted in both desktop sidebar and mobile nav drawer

## Future Requirements

### Auth

- **AUTH-F01**: Email verification on signup with DB migration for existing users
- **AUTH-F02**: 2FA / TOTP authentication

### Features

- **FEAT-F01**: Custom lead search (user-specified location, keywords, project type)
- **FEAT-F02**: Professional onboarding expansion (company details, team invites)
- **FEAT-F03**: Guided dashboard tour

### Integrations

- **INT-01**: CRM integration (Salesforce, HubSpot)
- **INT-02**: Lead export to CSV
- **INT-03**: REST API for programmatic access

### Advanced Intelligence

- **ADV-01**: ML-powered lead scoring trained on user conversion data
- **ADV-02**: Contact enrichment via LinkedIn and company website cross-referencing
- **ADV-03**: Analytics dashboard with lead volume trends, conversion rates, ROI metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated email outreach | Spam risk, CAN-SPAM compliance, wrong tone for relationship-driven equipment sales |
| No-CC free trial | User decision: Stripe-native trial with card simplifies architecture |
| Full CRM replacement | Massive scope creep; existing CRMs serve this need |
| Real-time chat/messaging | Equipment sales conversations happen on phones |
| Mobile native app | Web-first; responsive design handles mobile |
| International coverage | U.S. municipality formats vary enough already |
| Email verification | Requires careful migration sequencing; ship forgot password first, then add in v2.2 |
| Middleware auth | Layout-level checks sufficient for current route count |
| Env var startup validation | Caused production 500 when added to db/index.ts |
| Cursor-based pagination | Offset pagination sufficient for current data volumes |
| Retroactive dedup | Risk of data loss; forward-only dedup is safer |

## Traceability

### v1.0 (Complete)

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

### v2.1

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 9 | Pending |
| TEST-02 | Phase 9 | Pending |
| PERF-01 | Phase 10 | Pending |
| PERF-02 | Phase 10 | Pending |
| PERF-03 | Phase 10 | Pending |
| PERF-04 | Phase 10 | Pending |
| AUTH-01 | Phase 11 | Pending |
| UI-01 | Phase 12 | Pending |

**Coverage:**
- v1.0 requirements: 25 total, 25 complete
- v2.0 requirements: 11 complete, 10 deferred
- v2.1 requirements: 8 total, 8 mapped to phases
- Unmapped: 0

---
*Requirements defined: 2026-03-13 (v1.0)*
*Last updated: 2026-03-15 after v2.1 roadmap creation*
