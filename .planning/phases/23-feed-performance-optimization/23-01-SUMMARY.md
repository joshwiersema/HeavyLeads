---
phase: 23-feed-performance-optimization
plan: 01
subsystem: database
tags: [postgis, spatial-index, st-dwithin, st-distance, gist, performance, pagination]

# Dependency graph
requires:
  - phase: 20-scoring-engine
    provides: Lead scoring engine and org context for feed queries
provides:
  - PostGIS ST_DWithin spatial queries replacing Haversine full-table-scans
  - Location column population during pipeline insert
  - SQL-level COUNT + LIMIT pagination in getFilteredLeadsWithCount
  - Backfill function for existing leads without location data
affects: [feed-performance-optimization, lead-feed, storm-alerts, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [ST_DWithin for spatial radius filtering, ST_Distance for display distance, geography casting for meter-based calculations]

key-files:
  created: []
  modified:
    - src/lib/scraper/pipeline.ts
    - src/lib/leads/queries.ts
    - src/lib/storm-alerts/queries.ts

key-decisions:
  - "ST_DWithin with geography cast for meter-based radius filtering (miles * 1609.344)"
  - "ST_Distance for display distance instead of Haversine SELECT expression"
  - "Separate COUNT query + SQL LIMIT/OFFSET for getFilteredLeadsWithCount instead of fetch-all-then-slice"
  - "isNotNull(leads.location) replaces isNotNull(leads.lat)/isNotNull(leads.lng) for spatial queries"
  - "getRoofingSubscribersInStormArea left unchanged (uses org_profiles coordinates, not leads.location)"

patterns-established:
  - "PostGIS spatial pattern: ST_DWithin(col::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, meters)"
  - "Location population: ST_SetSRID(ST_MakePoint(lng, lat), 4326) in INSERT values"
  - "SQL-level pagination with separate COUNT query for accurate totals"

requirements-completed: [PERF-01, PERF-02, PERF-03]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 23 Plan 01: Feed Performance Optimization Summary

**PostGIS ST_DWithin spatial index queries replacing Haversine full-table-scans across all lead feed and storm alert functions, with SQL-level COUNT + LIMIT pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T06:09:43Z
- **Completed:** 2026-03-20T06:14:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Pipeline inserts now populate the leads.location column using ST_SetSRID(ST_MakePoint(lng, lat), 4326) for every geocoded lead
- All 3 lead feed query functions (getFilteredLeads, getFilteredLeadsWithCount, getFilteredLeadsCursor) use ST_DWithin for O(log n) spatial index lookups instead of O(n) Haversine per-row computation
- getFilteredLeadsWithCount uses a separate SQL COUNT query + SQL LIMIT/OFFSET instead of fetching all rows and slicing in memory
- Storm alert spatial query (getActiveStormAlertsForOrg) uses ST_DWithin leveraging the GiST index
- Backfill function exported for one-time migration of existing leads

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate location column during pipeline insert and backfill existing leads** - `a31dd00` (feat)
2. **Task 2: Replace Haversine with ST_DWithin in all feed and storm queries, add SQL LIMIT** - `b67deeb` (feat)

## Files Created/Modified
- `src/lib/scraper/pipeline.ts` - Added location field to insert values, onConflictDoUpdate set, and backfillLeadLocations export
- `src/lib/leads/queries.ts` - Replaced Haversine with ST_DWithin in 3 query functions, added SQL COUNT + LIMIT to getFilteredLeadsWithCount
- `src/lib/storm-alerts/queries.ts` - Replaced Haversine with ST_DWithin in getActiveStormAlertsForOrg

## Decisions Made
- Used geography casting (::geography) for ST_DWithin and ST_Distance to get meter-based distances, converting miles to meters (* 1609.344)
- Replaced isNotNull(leads.lat)/isNotNull(leads.lng) with isNotNull(leads.location) in spatial queries to ensure GiST index utilization
- Left getRoofingSubscribersInStormArea unchanged since it filters by org profile coordinates (not leads.location)
- getFilteredLeadsWithCount no longer sorts by score in-memory (sorts by scrapedAt DESC at SQL level) -- acceptable since dashboard uses getFilteredLeadsCursor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
After deploying, run the backfill function to populate the location column for existing leads:
```typescript
import { backfillLeadLocations } from "@/lib/scraper/pipeline";
const count = await backfillLeadLocations();
console.log(`Backfilled ${count} leads`);
```

## Next Phase Readiness
- Spatial index queries are in place and ready for production
- Backfill needs to be run once after deploy to populate location for existing leads
- Phase 23 Plan 02 can proceed with any remaining optimizations

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 23-feed-performance-optimization*
*Completed: 2026-03-20*
