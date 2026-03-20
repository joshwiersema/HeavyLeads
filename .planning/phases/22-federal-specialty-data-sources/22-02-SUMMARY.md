---
phase: 22-federal-specialty-data-sources
plan: 02
subsystem: api
tags: [epa, brownfields, grants-gov, envirofacts, federal-api, scraper-adapter]

# Dependency graph
requires:
  - phase: 22-federal-specialty-data-sources/01
    provides: "brownfield and grant source types, getEpaQueue and getGrantsGovQueue rate limiters"
provides:
  - "EpaBrownfieldsAdapter for EPA contaminated site data with coordinates and cleanup status"
  - "GrantsGovAdapter for federal construction grant opportunities with funding and deadlines"
affects: [22-federal-specialty-data-sources/03, scraper-pipeline, adapter-registry]

# Tech tracking
tech-stack:
  added: []
  patterns: [envirofacts-rest-api-table-fallback, multi-keyword-search-deduplication]

key-files:
  created:
    - src/lib/scraper/adapters/epa-brownfields.ts
    - src/lib/scraper/adapters/grants-gov.ts
  modified: []

key-decisions:
  - "EPA Envirofacts table name fallback: try 3 table name variants in order since EPA can rename tables without notice"
  - "Grants.gov multi-keyword search with Set-based deduplication by opportunity ID across 5 keyword searches"

patterns-established:
  - "Table name fallback: try multiple table name variants for unreliable REST APIs"
  - "Multi-keyword dedup: search with multiple keywords and deduplicate by unique ID"

requirements-completed: [FED-03, FED-04]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 22 Plan 02: EPA Brownfields & Grants.gov Adapters Summary

**EPA Brownfields adapter fetching contaminated site cleanup data via Envirofacts REST API, and Grants.gov adapter searching federal construction grant opportunities with 5-keyword deduplication**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T05:48:53Z
- **Completed:** 2026-03-20T05:51:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- EPA Brownfields adapter fetches from Envirofacts REST API with 3-table fallback for API resilience
- Grants.gov adapter searches with 5 construction keywords and deduplicates by opportunity ID
- Both adapters use appropriate rate limiter queues and gracefully return [] on error

## Task Commits

Each task was committed atomically:

1. **Task 1: EPA Brownfields contaminated site adapter** - `f04b1c9` (feat)
2. **Task 2: Grants.gov federal construction grants adapter** - `03b0781` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/lib/scraper/adapters/epa-brownfields.ts` - EPA Brownfields/ACRES contaminated site adapter with coordinate extraction and table name fallback
- `src/lib/scraper/adapters/grants-gov.ts` - Grants.gov federal construction grants adapter with multi-keyword search and deduplication

## Decisions Made
- EPA Envirofacts table name fallback: try ACRES_SITE_INFORMATION, ACRES_SITES, sems.ACRES_SITE_INFORMATION in order since EPA can rename tables without notice
- Grants.gov multi-keyword search: POST with 5 construction keywords (construction infrastructure, building renovation, environmental remediation, highway bridge, facility construction), deduplicate by opportunity ID using Set
- Parse EPA coordinates only when non-zero and non-NaN to avoid invalid location data
- Truncate Grants.gov titles to 200 chars and descriptions to 500 chars to keep data manageable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Both APIs are public with no authentication.

## Next Phase Readiness
- EPA Brownfields and Grants.gov adapters ready for registration in adapter registry (Plan 22-03)
- Both adapters follow the established ScraperAdapter pattern and use rate limiters from Plan 22-01

## Self-Check: PASSED

- All 2 created files verified on disk
- All 2 task commits verified in git history

---
*Phase: 22-federal-specialty-data-sources*
*Completed: 2026-03-20*
