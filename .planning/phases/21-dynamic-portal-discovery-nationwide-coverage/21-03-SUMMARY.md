---
phase: 21-dynamic-portal-discovery-nationwide-coverage
plan: 03
subsystem: scraper
tags: [socrata, arcgis, discovery, field-mapping, open-data, nationwide]

# Dependency graph
requires:
  - phase: 21-dynamic-portal-discovery-nationwide-coverage
    provides: inferFieldMapping heuristic field mapper (Plan 01)
provides:
  - discoverSocrataDatasets function querying api.us.socrata.com catalog API
  - discoverArcGISDatasets function querying hub.arcgis.com Hub Search API
  - SocrataDiscoveryResult and ArcGISDiscoveryResult typed interfaces
  - parseCityStateFromDomain and parseCityStateFromName helper functions
  - Unit tests for Socrata discovery (15 tests)
affects: [21-04-discovery-cron, data_portals upsert pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [catalog API pagination with delay, domain-based city/state heuristics, confidence-filtered discovery]

key-files:
  created:
    - src/lib/scraper/discovery/socrata-discovery.ts
    - src/lib/scraper/discovery/arcgis-discovery.ts
    - tests/scraper/socrata-discovery.test.ts
  modified: []

key-decisions:
  - "Well-known domain map (29 cities) for reliable Socrata city/state extraction over unreliable regex parsing"
  - "Separate parseCityStateFromName for ArcGIS using 'City of X' and 'City, ST' patterns since ArcGIS datasets lack domain-based geography"
  - "500ms delay between page fetches and between queries for rate-limit courtesy"
  - "5 permit industries vs 3 violation industries matching existing industry model"

patterns-established:
  - "Discovery service pattern: query catalog API -> paginate -> inferFieldMapping -> filter by confidence -> deduplicate -> sort"
  - "Domain-to-geography parsing with well-known map fallback to regex patterns"

requirements-completed: [NATL-01, NATL-02, NATL-07]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 21 Plan 03: Socrata & ArcGIS Discovery Services Summary

**Socrata and ArcGIS catalog discovery services with heuristic field mapping, confidence filtering, and city/state extraction for automatic nationwide dataset discovery**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T05:11:28Z
- **Completed:** 2026-03-20T05:16:15Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Socrata Discovery queries api.us.socrata.com/api/catalog/v1 with 4 search terms (building permits, construction permits, code violations, code enforcement), pages up to 500 results per query, auto-maps columns, filters by 0.33 confidence threshold
- ArcGIS Discovery queries hub.arcgis.com/api/v3/datasets with Feature Service filter, same 4 search terms, extracts field names from dataset metadata, captures featureServiceUrl for downstream adapter use
- Both services share identical deduplication (domain+datasetId), industry assignment logic, and confidence-sorted output
- 15 unit tests covering domain parsing, result shape, deduplication, confidence filtering, industry assignment, sorting, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Socrata Discovery service with unit tests** - `7f21876` (feat)
2. **Task 2: Create ArcGIS Discovery service** - `4591bfe` (feat)

## Files Created/Modified
- `src/lib/scraper/discovery/socrata-discovery.ts` - Socrata catalog API discovery with parseCityStateFromDomain, 29-city well-known domain map
- `src/lib/scraper/discovery/arcgis-discovery.ts` - ArcGIS Hub Search API discovery with parseCityStateFromName, Feature Service URL capture
- `tests/scraper/socrata-discovery.test.ts` - 15 unit tests for domain parsing, discovery result shape, dedup, filtering, industries

## Decisions Made
- Used a 29-entry well-known domain map for reliable Socrata city/state extraction rather than relying solely on regex pattern matching against domain names
- ArcGIS uses parseCityStateFromName since datasets come from various sources without standardized domain patterns (unlike Socrata)
- 500ms delay between page fetches and between query transitions for API courtesy
- 5 industries for permits (heavy_equipment, hvac, roofing, solar, electrical) vs 3 for violations (hvac, roofing, electrical) matching the existing industry model where violations are trade-specific

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Response body reuse in unit tests**
- **Found during:** Task 1 (unit tests)
- **Issue:** `vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(...))` returned the same Response object for all calls, but Response bodies can only be consumed once, causing "Body is unusable" errors on subsequent fetch calls within the discovery function
- **Fix:** Changed all mocks to use `mockImplementation(async () => new Response(...))` which creates a fresh Response per call
- **Files modified:** tests/scraper/socrata-discovery.test.ts
- **Verification:** All 15 tests pass
- **Committed in:** 7f21876 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in tests)
**Impact on plan:** Test mock pattern fix only. No scope creep.

## Issues Encountered
None beyond the test mock fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Discovery services ready for Plan 04 (discovery cron) to call and upsert results into data_portals table
- Both services export clean typed interfaces matching data_portals schema
- Feature Service URLs captured for ArcGIS datasets enable GenericArcGISAdapter to scrape discovered datasets

## Self-Check: PASSED

All 3 created files verified on disk. Both task commits (7f21876, 4591bfe) verified in git log.

---
*Phase: 21-dynamic-portal-discovery-nationwide-coverage*
*Completed: 2026-03-20*
