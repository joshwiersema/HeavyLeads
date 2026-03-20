# Requirements: GroundPulse

**Defined:** 2026-03-13 (v1.0), Updated 2026-03-15 (v2.0, v2.1), 2026-03-16 (v3.0), 2026-03-20 (v4.0)
**Core Value:** Every morning, a blue-collar business owner opens GroundPulse and sees fresh, high-scoring leads personalized to their industry, specializations, and service area.

## v4.0 Requirements

Requirements for nationwide expansion, scoring fix, rebrand to GroundPulse, and landing page redesign.

### Infrastructure

- [x] **INFRA-01**: Pipeline runs in batched fan-out to stay under 300s Vercel timeout
- [x] **INFRA-02**: Geocoding cache prevents re-geocoding same addresses across runs
- [x] **INFRA-03**: Nominatim fallback activates when Google Maps 10K/month quota is exceeded
- [x] **INFRA-04**: Leads older than 45 days are automatically expired to stay within Neon storage limits
- [x] **INFRA-05**: Data portals DB table stores discovered Socrata/ArcGIS configs as rows, not code files

### Scoring

- [x] **SCOR-01**: Leads produce score standard deviation > 15 across a sample of 1000+ leads
- [x] **SCOR-02**: Value estimation heuristic assigns valueTier from projectType when estimatedValue is null
- [x] **SCOR-03**: Industry relevance uses keyword-to-projectType matching (0-15 range) instead of flat low-confidence fallback
- [x] **SCOR-04**: Freshness scoring uses source-type-specific curves (storm=hours, bid=days, permit=weeks)
- [x] **SCOR-05**: Legacy scoring system (src/lib/leads/scoring.ts) is removed; single scoring engine remains
- [x] **SCOR-06**: HVAC leads score highest for HVAC accounts, solar leads for solar accounts, etc. (industry routing verified)

### Nationwide Coverage

- [x] **NATL-01**: Weekly discovery cron queries Socrata Discovery API and finds 100+ permit datasets
- [x] **NATL-02**: Weekly discovery cron queries ArcGIS Hub API and finds additional datasets
- [x] **NATL-03**: GenericSocrataAdapter reads config from data_portals table (no per-city TypeScript files)
- [x] **NATL-04**: GenericArcGISAdapter reads config from data_portals table
- [x] **NATL-05**: Heuristic field mapper auto-maps 90%+ of top-50-city permit dataset column names
- [x] **NATL-06**: Existing Austin/Dallas/Atlanta adapters migrated to data_portals seed rows
- [x] **NATL-07**: Code violation datasets discovered and scraped nationwide via same discovery mechanism
- [x] **NATL-08**: User in any U.S. state sees local leads within their service radius after pipeline runs

### Federal & Specialty Sources

- [ ] **FED-01**: USAspending.gov adapter scrapes awarded federal construction contracts
- [ ] **FED-02**: OSHA inspection data adapter scrapes construction site inspections
- [ ] **FED-03**: EPA Brownfields/ACRES adapter scrapes contaminated site cleanup opportunities
- [ ] **FED-04**: Grants.gov adapter scrapes federal construction grant opportunities
- [ ] **FED-05**: FERC energy infrastructure adapter scrapes pipeline/power plant filings
- [ ] **FED-06**: FCC antenna structure adapter scrapes telecom tower registrations
- [ ] **FED-07**: New source types added to base-adapter (contract-award, inspection, brownfield, grant, energy, telecom)

### Performance

- [ ] **PERF-01**: All lead queries use SQL-level LIMIT (no fetch-all-then-slice)
- [ ] **PERF-02**: PostGIS spatial index on leads.location column used for distance filtering
- [ ] **PERF-03**: Dashboard loads in < 3 seconds with 50K+ leads in database
- [ ] **PERF-04**: Cross-source deduplication catches same permit from city and county portals

### Rebrand & Landing Page

- [ ] **BRAND-01**: All references to HeavyLeads/LeadForge replaced with GroundPulse across entire codebase
- [ ] **BRAND-02**: New GroundPulse logo/mark designed and deployed
- [ ] **BRAND-03**: Email templates updated with GroundPulse branding
- [ ] **BRAND-04**: Page titles, metadata, OG tags updated to GroundPulse
- [ ] **LAND-01**: Landing page copy feels handcrafted and industry-specific, not generic AI-generated
- [ ] **LAND-02**: Landing page showcases all 5 industries with specific value propositions
- [ ] **LAND-03**: Social proof section with concrete stats (lead sources, cities covered, industries)
- [ ] **LAND-04**: Interactive or visual element that demonstrates the product (not just text + icons)
- [ ] **LAND-05**: Landing page design passes the "would I trust this with my credit card" test

## v5.0 Requirements (Deferred)

### Advanced Sources
- **ADVS-01**: State DOT bid lettings (50 state systems)
- **ADVS-02**: Planning board agenda mining (PDF parsing)
- **ADVS-03**: Property transfer records (county systems)
- **ADVS-04**: USACE wetland permits
- **ADVS-05**: School district bond programs

### Intelligence
- **INTL-01**: ML-based lead scoring
- **INTL-02**: Predictive lead timing
- **INTL-03**: Competitor activity detection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated outreach/emailing | Risk of spam, compliance issues |
| Mobile native app | Web-first |
| International markets | U.S. only |
| Paid data APIs (ATTOM, Shovels) | $500-5000/month destroys unit economics |
| ML/AI scoring | Fix rule-based first, ML in v5 |
| SMS notifications | Defer to future |
| State DOT bid scraping | 50 different systems, too complex for v4 |
| Planning board PDF mining | No structured API, per-city setup |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 19 | Complete |
| INFRA-02 | Phase 19 | Complete |
| INFRA-03 | Phase 19 | Complete |
| INFRA-04 | Phase 19 | Complete |
| INFRA-05 | Phase 19 | Complete |
| SCOR-01 | Phase 20 | Complete |
| SCOR-02 | Phase 20 | Complete |
| SCOR-03 | Phase 20 | Complete |
| SCOR-04 | Phase 20 | Complete |
| SCOR-05 | Phase 20 | Complete |
| SCOR-06 | Phase 20 | Complete |
| NATL-01 | Phase 21 | Complete |
| NATL-02 | Phase 21 | Complete |
| NATL-03 | Phase 21 | Complete |
| NATL-04 | Phase 21 | Complete |
| NATL-05 | Phase 21 | Complete |
| NATL-06 | Phase 21 | Complete |
| NATL-07 | Phase 21 | Complete |
| NATL-08 | Phase 21 | Complete |
| FED-01 | Phase 22 | Pending |
| FED-02 | Phase 22 | Pending |
| FED-03 | Phase 22 | Pending |
| FED-04 | Phase 22 | Pending |
| FED-05 | Phase 22 | Pending |
| FED-06 | Phase 22 | Pending |
| FED-07 | Phase 22 | Pending |
| PERF-01 | Phase 23 | Pending |
| PERF-02 | Phase 23 | Pending |
| PERF-03 | Phase 23 | Pending |
| PERF-04 | Phase 23 | Pending |
| BRAND-01 | Phase 24 | Pending |
| BRAND-02 | Phase 24 | Pending |
| BRAND-03 | Phase 24 | Pending |
| BRAND-04 | Phase 24 | Pending |
| LAND-01 | Phase 24 | Pending |
| LAND-02 | Phase 24 | Pending |
| LAND-03 | Phase 24 | Pending |
| LAND-04 | Phase 24 | Pending |
| LAND-05 | Phase 24 | Pending |

**Coverage:**
- v4.0 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after v4.0 roadmap creation*
