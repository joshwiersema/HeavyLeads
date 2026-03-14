# Requirements: HeavyLeads

**Defined:** 2026-03-13
**Core Value:** Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Ingestion

- [x] **DATA-01**: System scrapes building permit data from city/county databases for target jurisdictions
- [ ] **DATA-02**: System scrapes government and private bid board postings (RFPs, contract awards)
- [ ] **DATA-03**: System scrapes construction news and press releases for project announcements and groundbreakings
- [ ] **DATA-04**: System performs Google dorking / deep web queries to surface project docs, contractor activity, and job postings
- [x] **DATA-05**: System runs scraping pipeline on a daily schedule and marks data with freshness timestamps
- [ ] **DATA-06**: System deduplicates leads across multiple data sources into a single canonical lead record
- [x] **DATA-07**: System geocodes lead locations for radius-based geographic filtering

### Lead Intelligence

- [x] **LEAD-01**: System infers equipment needs from project type and description (rule-based mapping: project type -> equipment categories)
- [x] **LEAD-02**: System scores leads by relevance to the dealer's configured equipment types and service radius
- [x] **LEAD-03**: System maps project phase to equipment-need timeline windows (e.g., earthwork phase = excavators now, finishing phase = boom lifts later)
- [x] **LEAD-04**: Lead detail view shows project info, location on map, key contacts, estimated equipment needs, and source attribution
- [x] **LEAD-05**: User can filter leads by equipment type (forklifts, boom lifts, excavators, telehandlers, etc.) with show-all default
- [x] **LEAD-06**: User can filter leads by geographic radius from their company HQ

### User Experience

- [ ] **UX-01**: User sees a daily lead feed dashboard with fresh leads sorted by recency and relevance
- [ ] **UX-02**: User can track lead status (New / Viewed / Contacted / Won / Lost)
- [ ] **UX-03**: User can save searches and bookmark individual leads for quick re-access
- [ ] **UX-04**: User receives a daily email digest summarizing new matching leads with links to dashboard
- [x] **UX-05**: Leads display freshness indicators (discovered date, age badges: New, This Week, Older)
- [ ] **UX-06**: User can search leads by keyword and filter by date range and project size

### Platform

- [x] **PLAT-01**: User can sign up with email and password
- [x] **PLAT-02**: User session persists across browser refresh
- [x] **PLAT-03**: Multi-tenant company accounts with data isolation between competing dealers
- [x] **PLAT-04**: Company onboarding wizard: set HQ location, equipment types sold/rented, service radius
- [ ] **PLAT-05**: Subscription billing with one-time setup fee + ongoing monthly charges via Stripe
- [x] **PLAT-06**: User can manage account settings and company profile

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Fleet Expansion Detection

- **FLEET-01**: System detects rental companies looking to upgrade/expand fleet via job postings and press releases
- **FLEET-02**: Fleet expansion leads appear as a separate lead category in the dashboard

### Outreach

- **OUT-01**: System generates equipment-specific outreach talking points for each lead
- **OUT-02**: LLM-powered contextual suggestions (upgrade from template-based)

### Integrations

- **INT-01**: CRM integration (Salesforce, HubSpot) for lead push
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
| Full CRM replacement | Massive scope creep; existing CRMs (Texada, Flyntlok) serve this need |
| Real-time chat/messaging | Equipment sales conversations happen on phones, not chat |
| Mobile native app | Web-first; responsive design handles mobile. Defer to v2+ |
| International coverage | U.S. municipality formats already vary wildly; international adds orders of magnitude complexity |
| Predictive analytics/forecasting | Requires historical data new product doesn't have; bad predictions erode trust |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 2: Scraping Pipeline | Complete |
| DATA-02 | Phase 4: Multi-Source Expansion | Pending |
| DATA-03 | Phase 4: Multi-Source Expansion | Pending |
| DATA-04 | Phase 4: Multi-Source Expansion | Pending |
| DATA-05 | Phase 2: Scraping Pipeline | Complete |
| DATA-06 | Phase 4: Multi-Source Expansion | Pending |
| DATA-07 | Phase 2: Scraping Pipeline | Complete |
| LEAD-01 | Phase 3: Lead Intelligence and Dashboard | Complete |
| LEAD-02 | Phase 3: Lead Intelligence and Dashboard | Complete |
| LEAD-03 | Phase 3: Lead Intelligence and Dashboard | Complete |
| LEAD-04 | Phase 3: Lead Intelligence and Dashboard | Complete |
| LEAD-05 | Phase 3: Lead Intelligence and Dashboard | Complete |
| LEAD-06 | Phase 3: Lead Intelligence and Dashboard | Complete |
| UX-01 | Phase 3: Lead Intelligence and Dashboard | Pending |
| UX-02 | Phase 5: Lead Management and Notifications | Pending |
| UX-03 | Phase 5: Lead Management and Notifications | Pending |
| UX-04 | Phase 5: Lead Management and Notifications | Pending |
| UX-05 | Phase 3: Lead Intelligence and Dashboard | Complete |
| UX-06 | Phase 5: Lead Management and Notifications | Pending |
| PLAT-01 | Phase 1: Platform Foundation | Complete |
| PLAT-02 | Phase 1: Platform Foundation | Complete |
| PLAT-03 | Phase 1: Platform Foundation | Complete |
| PLAT-04 | Phase 1: Platform Foundation | Complete |
| PLAT-05 | Phase 6: Billing and Launch Readiness | Pending |
| PLAT-06 | Phase 1: Platform Foundation | Complete |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
