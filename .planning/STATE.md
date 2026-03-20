---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: GroundPulse Nationwide
status: complete
stopped_at: Completed 24-03-PLAN.md (all plans complete)
last_updated: "2026-03-20T06:45:39Z"
last_activity: 2026-03-20 -- Completed 24-03 Verification Sweep (zero old brand refs, tests pass)
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Every morning, a blue-collar business owner opens GroundPulse and sees fresh, high-scoring leads personalized to their industry, specializations, and service area.
**Current focus:** v4.0 Phase 24 -- GroundPulse Rebrand Landing Page

## Current Position

Phase: 24 of 24 (GroundPulse Rebrand Landing Page)
Plan: 3 of 3 complete
Status: Complete
Last activity: 2026-03-20 -- Completed 24-03 Verification Sweep (zero old brand refs, tests pass)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 9 (v4.0) / 47 (all milestones)
- Average duration: 3min (v4.0)
- Total execution time: 30min (v4.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19 | 3/3 | 12min | 4min |
| 20 | 3/3 | 7min | 2min |
| Phase 20 P01 | 6min | 3 tasks | 7 files |
| Phase 20 P03 | 3min | 2 tasks | 2 files |
| Phase 21 P02 | 2min | 1 tasks | 1 files |
| Phase 21 P01 | 3min | 2 tasks | 3 files |
| Phase 21 P03 | 5min | 2 tasks | 3 files |
| Phase 21 P04 | 4min | 2 tasks | 10 files |
| Phase 22 P01 | 2min | 2 tasks | 4 files |
| Phase 22 P02 | 2min | 2 tasks | 2 files |
| Phase 22 P03 | 4min | 2 tasks | 3 files |
| Phase 23 P02 | 4min | 1 tasks | 2 files |
| Phase 23 P01 | 4min | 2 tasks | 3 files |
| Phase 24 P02 | 3min | 1 tasks | 1 files |
| Phase 24 P01 | 6min | 2 tasks | 56 files |
| Phase 24 P03 | 5min | 1 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Database wiped clean on 2026-03-20 (fresh start for v4.0)
- Dynamic Socrata discovery over hardcoded per-city adapters
- Rule-based scoring fix (not ML) -- fix weighting and variance sources
- Cheerio is the only new production dependency
- Nominatim as free geocoding fallback after Google 10K/month
- Fan-out batching: direct execution for <=5 adapters, parallel fan-out for 6+ (19-02)
- Promise.allSettled for batch invocation so failed batches do not block others (19-02)
- Raw SQL DELETE for expiration over Drizzle ORM (correlated NOT EXISTS subqueries) (19-03)
- 45-day uniform expiration cutoff replaces per-source-type windows (19-03)
- Batch deletion of 500 per batch for Neon serverless safety (19-03)
- SHA-256 address hashing for geocoding cache keys with 90-day TTL (19-01)
- Cache null coords to prevent retrying known-bad addresses (19-01)
- Nominatim free fallback with 1-req/sec rate limit per OSM policy (19-01)
- Backward-compatible fallback in enrichLead: distance-only score when no org context (20-02)
- Build OrgScoringContext at top of getFilteredLeads/getFilteredLeadsWithCount when organizationId present (20-02)
- [Phase 20]: PROJECT_TYPE_VALUE_MAP with 33 entries for projectType-to-tier derivation (20-01)
- [Phase 20]: Three freshness curve tiers: storm (hours), bid (days), default/permit (weeks) (20-01)
- [Phase 20]: 5-industry keyword map with strong/weak categories for relevance scoring (20-01)
- [Phase 20]: Deterministic synthetic lead generation via modular arithmetic for reproducible statistical tests (20-03)
- [Phase 20]: Fixed org geo-location in tests to isolate relevance scoring from distance effects (20-03)
- [Phase 21]: Defined DataPortalConfig and FieldMapping interfaces locally in generic-arcgis-adapter.ts since Plan 21-01 not yet executed (21-02)
- [Phase 21]: GeoJSON download as primary ArcGIS strategy with Feature Service query fallback (21-02)
- [Phase 21]: 2000 feature limit per scrape to prevent memory issues with large ArcGIS datasets (21-02)
- [Phase 21]: Priority-ordered field resolution: permitNumber > address > permitDate > description > projectType > lat/lng > estimatedValue > applicantName (21-01)
- [Phase 21]: Deterministic sourceId format portal-{domain}-{datasetId} for GenericSocrataAdapter dedup (21-01)
- [Phase 21]: No date field fallback: fetch latest 1000 records without time-window filter (21-01)
- [Phase 21]: 29-city well-known domain map for reliable Socrata city/state extraction (21-03)
- [Phase 21]: parseCityStateFromName for ArcGIS using "City of X" and "City, ST" patterns (21-03)
- [Phase 21]: 500ms delay between page fetches and between queries for API rate-limit courtesy (21-03)
- [Phase 21]: 5 permit industries vs 3 violation industries matching existing industry model (21-03)
- [Phase 21]: getAdaptersForIndustry made async to support DB-backed portal adapters alongside synchronous hardcoded adapters (21-04)
- [Phase 21]: Hardcoded adapters take priority over portal adapters when deduplicating by sourceId (21-04)
- [Phase 21]: Portal adapter factory gracefully degrades -- DB failure falls back to hardcoded adapters only (21-04)
- [Phase 21]: Discovery cron preserves enabled flag on conflict to respect manual overrides (21-04)
- [Phase 22]: POST-based API pattern for USAspending complex filtering (NAICS codes, date ranges, award types) (22-01)
- [Phase 22]: Manual redirect detection for OSHA adapter to handle DOL API restructuring gracefully (22-01)
- [Phase 22]: Conservative rate limits for OSHA (5 req/min) due to API stability concerns (22-01)
- [Phase 22]: EPA Envirofacts table name fallback: try 3 table name variants in order since EPA can rename tables without notice
- [Phase 22]: Grants.gov multi-keyword search with Set-based deduplication by opportunity ID across 5 keyword searches
- [Phase 22]: Regex-based RSS/XML parsing for FERC to avoid adding XML parser dependency (22-03)
- [Phase 22]: DMS-to-decimal coordinate conversion for FCC records with decimal format fallback (22-03)
- [Phase 22]: All 6 federal adapters registered per industry: FERC for energy-related, FCC for tower/electrical (22-03)
- [Phase 23]: Three-path dedup matching with geographic proximity prerequisite: permit number (>0.8), text (>0.7), date+address compound (3 days + >0.5) (23-02)
- [Phase 23]: Permit number normalization strips common prefixes (BLDG, BLD, BP, COM, RES, PMT, PERMIT) with longer-first regex ordering (23-02)
- [Phase 23]: ST_DWithin with geography cast for spatial index-backed radius filtering, miles * 1609.344 for meter conversion (23-01)
- [Phase 23]: Separate SQL COUNT query + SQL LIMIT/OFFSET for getFilteredLeadsWithCount pagination instead of fetch-all-then-slice (23-01)
- [Phase 23]: getRoofingSubscribersInStormArea left as Haversine since it uses org_profiles coordinates, not leads.location (23-01)
- [Phase 24]: Complete page.tsx rewrite replacing HeavyLeads with GroundPulse branding, GP monogram (24-02)
- [Phase 24]: Combined text rebrand and monogram update into single atomic commit for same-file changes (24-01)
- [Phase 24]: Interactive dashboard preview with 3 mock lead cards as product demo element (24-02)
- [Phase 24]: Asymmetric industry grid: Heavy Equipment spans 2 columns, others 1 each (24-02)
- [Phase 24]: Industry-specific accent colors: amber (heavy equip), red (roofing), blue (HVAC), yellow (solar), purple (electrical) (24-02)
- [Phase 24]: getAllByText for brand name assertions in landing page test since brand appears 3+ times (24-03)
- [Phase 24]: Pre-existing test failures (34 tests in 13 files) confirmed out-of-scope of rebrand (24-03)

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Vercel 300s timeout must be resolved before adding new data sources~~ RESOLVED by 19-02 fan-out batching
- ~~Google Maps geocoding costs at 50K+ leads/month without cache~~ RESOLVED by 19-01 geocoding cache + Nominatim fallback
- ~~Neon 0.5 GB storage ceiling with nationwide data volume~~ ADDRESSED by 19-03 hard-delete expiration (45-day cutoff)
- DOL OSHA API endpoint stability uncertain after portal restructuring (Phase 22 concern)
- SAM.gov actual rate limits may differ from documented (Phase 22 concern)

## Session Continuity

Last session: 2026-03-20T06:45:39Z
Stopped at: Completed 24-03-PLAN.md (all plans complete, milestone v4.0 complete)
Resume file: None
