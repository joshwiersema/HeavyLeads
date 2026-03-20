---
phase: 21-dynamic-portal-discovery-nationwide-coverage
plan: 04
subsystem: scraper
tags: [cron, discovery, socrata, arcgis, data-portals, adapters, pipeline]

# Dependency graph
requires:
  - phase: 21-01
    provides: GenericSocrataAdapter and DataPortalConfig interface
  - phase: 21-02
    provides: GenericArcGISAdapter
  - phase: 21-03
    provides: discoverSocrataDatasets and discoverArcGISDatasets functions
provides:
  - Weekly discovery cron route (/api/cron/discover)
  - Portal adapter factory (getPortalAdapters, getPortalAdaptersForIndustry)
  - Pipeline integration merging hardcoded + portal adapters
  - Seed script for migrating existing city configs to data_portals
  - vercel.json discovery cron schedule (Sunday 3 AM UTC)
affects: [phase-22, scraper-pipeline, data-portals]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-adapter-factory, hardcoded-plus-dynamic-merge, dedup-by-sourceId]

key-files:
  created:
    - src/app/api/cron/discover/route.ts
    - src/lib/scraper/adapters/portal-adapter-factory.ts
    - src/lib/scraper/seed-portals.ts
  modified:
    - src/lib/scraper/adapters/index.ts
    - src/app/api/cron/scrape/[industry]/route.ts
    - src/app/api/cron/scrape/batch/route.ts
    - src/app/api/cron/scrape/route.ts
    - src/app/api/scraper/run/route.ts
    - vercel.json

key-decisions:
  - "getAdaptersForIndustry made async to support DB-backed portal adapters alongside synchronous hardcoded adapters"
  - "Hardcoded adapters take priority over portal adapters when deduplicating by sourceId"
  - "Portal adapter factory gracefully degrades: DB failure falls back to hardcoded adapters only"
  - "Discovery cron preserves enabled flag on conflict to respect manual overrides"

patterns-established:
  - "Async adapter factory: all adapter consumers must await getAdaptersForIndustry/getAllAdapters"
  - "Merge pattern: hardcoded adapters first, then portal adapters, dedup by sourceId"

requirements-completed: [NATL-06, NATL-08]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 21 Plan 04: Discovery Cron & Pipeline Integration Summary

**Weekly discovery cron wires Socrata + ArcGIS discovery into data_portals upsert, portal adapter factory feeds dynamic adapters into pipeline alongside hardcoded ones**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T05:18:48Z
- **Completed:** 2026-03-20T05:22:48Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Discovery cron route runs both Socrata and ArcGIS discovery in parallel, upserts results into data_portals with ON CONFLICT DO UPDATE
- Portal adapter factory creates GenericSocrataAdapter/GenericArcGISAdapter instances from enabled data_portals rows, filtered by industry
- Scraping pipeline merges hardcoded adapters (SAM.gov, news, storm, per-city) with dynamic portal adapters from database
- Weekly discovery cron scheduled at Sunday 3 AM UTC in vercel.json
- Seed script migrates 6 existing city configs (3 permits + 3 violations) to data_portals rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create discovery cron route and portal adapter factory** - `a4bd23a` (feat)
2. **Task 2: Integrate portal adapters into pipeline and add discovery cron schedule** - `79a7793` (feat)

## Files Created/Modified
- `src/app/api/cron/discover/route.ts` - Weekly discovery cron endpoint with CRON_SECRET auth
- `src/lib/scraper/adapters/portal-adapter-factory.ts` - Creates adapters from data_portals rows, filtered by industry/enabled
- `src/lib/scraper/seed-portals.ts` - Seed script with 6 existing Austin/Dallas/Atlanta/Houston configs
- `src/lib/scraper/adapters/index.ts` - Made async, merges hardcoded + portal adapters with dedup
- `src/app/api/cron/scrape/[industry]/route.ts` - Added await for async getAdaptersForIndustry
- `src/app/api/cron/scrape/batch/route.ts` - Added await for async getAdaptersForIndustry
- `src/app/api/cron/scrape/route.ts` - Added await for async getAllAdapters
- `src/app/api/scraper/run/route.ts` - Added await for async getAllAdapters
- `vercel.json` - Added /api/cron/discover at "0 3 * * 0" (Sunday 3 AM UTC)

## Decisions Made
- Made getAdaptersForIndustry async to support database-backed portal adapters alongside synchronous hardcoded adapters
- Hardcoded adapters take priority over portal adapters when deduplicating by sourceId (prevents double-scraping existing cities)
- Portal adapter factory wrapped in try/catch so DB failures gracefully degrade to hardcoded adapters only
- Discovery cron preserves enabled flag on conflict to respect manual overrides (only updates name, fieldMapping, confidence, lastVerifiedAt)
- Updated all callers of getAdaptersForIndustry/getAllAdapters (4 routes) to use await

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated additional callers of getAllAdapters**
- **Found during:** Task 2
- **Issue:** Plan only specified updating batch route and industry route, but scrape/route.ts and scraper/run/route.ts also call getAllAdapters which is now async
- **Fix:** Added await to getAllAdapters() calls in both additional routes
- **Files modified:** src/app/api/cron/scrape/route.ts, src/app/api/scraper/run/route.ts
- **Verification:** TypeScript compilation succeeds with no errors in modified files
- **Committed in:** 79a7793 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- without this fix, two routes would pass Promise objects instead of adapter arrays to the pipeline. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 21 is now complete: discovery populates data_portals, pipeline reads from data_portals to create adapters
- Seed script ready to run (`npx tsx src/lib/scraper/seed-portals.ts`) to migrate existing city configs
- Phase 22 can proceed with federal data source integration (DOL OSHA, SAM.gov enhancements)

## Self-Check: PASSED

- FOUND: src/app/api/cron/discover/route.ts
- FOUND: src/lib/scraper/adapters/portal-adapter-factory.ts
- FOUND: src/lib/scraper/seed-portals.ts
- FOUND: commit a4bd23a
- FOUND: commit 79a7793

---
*Phase: 21-dynamic-portal-discovery-nationwide-coverage*
*Completed: 2026-03-20*
