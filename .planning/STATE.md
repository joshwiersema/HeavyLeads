---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: GroundPulse Nationwide
status: Phase 21 in-progress
stopped_at: Completed 21-02-PLAN.md
last_updated: "2026-03-20T05:09:31.929Z"
last_activity: 2026-03-20 -- Completed 21-02 GenericArcGISAdapter
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 7
  percent: 70
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Every morning, a blue-collar business owner opens GroundPulse and sees fresh, high-scoring leads personalized to their industry, specializations, and service area.
**Current focus:** v4.0 Phase 21 -- Dynamic Portal Discovery & Nationwide Coverage

## Current Position

Phase: 21 of 24 (Dynamic Portal Discovery & Nationwide Coverage)
Plan: 1 of 4 (21-02 complete)
Status: Phase 21 in-progress
Last activity: 2026-03-20 -- Completed 21-02 GenericArcGISAdapter

Progress: [███████░░░] 70%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v4.0) / 44 (all milestones)
- Average duration: 3min (v4.0)
- Total execution time: 19min (v4.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19 | 3/3 | 12min | 4min |
| 20 | 3/3 | 7min | 2min |
| Phase 20 P01 | 6min | 3 tasks | 7 files |
| Phase 20 P03 | 3min | 2 tasks | 2 files |
| Phase 21 P02 | 2min | 1 tasks | 1 files |

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

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Vercel 300s timeout must be resolved before adding new data sources~~ RESOLVED by 19-02 fan-out batching
- ~~Google Maps geocoding costs at 50K+ leads/month without cache~~ RESOLVED by 19-01 geocoding cache + Nominatim fallback
- ~~Neon 0.5 GB storage ceiling with nationwide data volume~~ ADDRESSED by 19-03 hard-delete expiration (45-day cutoff)
- DOL OSHA API endpoint stability uncertain after portal restructuring (Phase 22 concern)
- SAM.gov actual rate limits may differ from documented (Phase 22 concern)

## Session Continuity

Last session: 2026-03-20T05:09:20.567Z
Stopped at: Completed 21-02-PLAN.md
Resume file: None
