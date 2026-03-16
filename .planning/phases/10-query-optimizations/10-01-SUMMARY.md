---
phase: 10-query-optimizations
plan: 01
subsystem: database, ui
tags: [pagination, batch-query, drizzle, inArray, haversine, next.js]

# Dependency graph
requires:
  - phase: 09-regression-tests
    provides: test infrastructure and mocking patterns
provides:
  - getFilteredLeadsWithCount() for paginated lead feed queries
  - enrichLead() standalone function for shared enrichment logic
  - getLeadsByIds() batch query for bookmarks and future batch lookups
  - Pagination client component with Previous/Next and page indicator
affects: [dashboard, bookmarks, digest]

# Tech tracking
tech-stack:
  added: []
  patterns: [offset-pagination with in-memory scoring, batch query replacing N+1, enrichment function extraction]

key-files:
  created:
    - src/app/(dashboard)/dashboard/pagination.tsx
    - tests/leads/pagination.test.ts
    - tests/leads/bookmarks-batch.test.ts
  modified:
    - src/lib/leads/queries.ts
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/dashboard/lead-filters.tsx
    - src/app/(dashboard)/dashboard/bookmarks/page.tsx

key-decisions:
  - "enrichLead extracted as pure function from getLeadById for reuse by 3 callers"
  - "getFilteredLeadsWithCount fetches all within-radius leads (no FETCH_MULTIPLIER) for accurate totalCount"
  - "Filter changes reset page to 1 via buildParams deleting page param"
  - "Nationwide fallback still uses unpaginated getFilteredLeads with limit:50"

patterns-established:
  - "enrichLead(row, params?) pattern for consistent lead enrichment across queries"
  - "Thenable mock pattern for orderBy that supports both paginated and non-paginated query chains"

requirements-completed: [PERF-01, PERF-02]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 10 Plan 01: Pagination and Batch Bookmarks Summary

**Offset-based pagination for lead feed with Previous/Next controls, batch-loaded bookmarks via single getLeadsByIds query**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T05:01:54Z
- **Completed:** 2026-03-16T05:08:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extracted enrichLead() as standalone function, eliminating duplicated enrichment logic across getLeadById, getFilteredLeadsWithCount, and getLeadsByIds
- Added getFilteredLeadsWithCount() with accurate pagination math (page slicing, totalCount, totalPages)
- Created Pagination client component with Previous/Next buttons, page indicator, and automatic hide when only 1 page
- Replaced N+1 getLeadById calls in bookmarks page with single getLeadsByIds batch query
- Page param persists in URL alongside all existing filters; filter changes auto-reset to page 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getFilteredLeadsWithCount, enrichLead, and getLeadsByIds (TDD)**
   - `3cb9fc4` (test) - RED: add failing tests for pagination, enrichLead, and getLeadsByIds
   - `aa67487` (feat) - GREEN: implement enrichLead, getFilteredLeadsWithCount, and getLeadsByIds
2. **Task 2: Add pagination UI to dashboard and batch query to bookmarks** - `7d064cc` (feat)

## Files Created/Modified
- `src/lib/leads/queries.ts` - Added enrichLead, getFilteredLeadsWithCount, getLeadsByIds; refactored getLeadById to use enrichLead
- `src/app/(dashboard)/dashboard/pagination.tsx` - New client component with Previous/Next pagination controls
- `src/app/(dashboard)/dashboard/page.tsx` - Uses getFilteredLeadsWithCount, renders Pagination, shows totalCount
- `src/app/(dashboard)/dashboard/lead-filters.tsx` - buildParams deletes page param to reset on filter change
- `src/app/(dashboard)/dashboard/bookmarks/page.tsx` - Single getLeadsByIds call replaces N+1 getLeadById
- `tests/leads/pagination.test.ts` - Tests for enrichLead and getFilteredLeadsWithCount pagination math
- `tests/leads/bookmarks-batch.test.ts` - Tests for getLeadsByIds batch query with empty array guard

## Decisions Made
- Extracted enrichLead as a standalone exported function rather than a private helper, enabling tests to validate enrichment independently
- getFilteredLeadsWithCount does NOT use FETCH_MULTIPLIER -- it fetches all within-radius leads for accurate totalCount (Haversine WHERE already bounds the result set)
- Nationwide fallback path remains unpaginated using getFilteredLeads with limit:50, since nationwide is a single-page fallback display
- Page param is deleted (not set to "1") when on page 1 to keep URLs clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test mock for orderBy needed to be "thenable" (implement .then()) since getFilteredLeadsWithCount awaits the orderBy result directly (no .limit/.offset chain), while getFilteredLeads still chains .limit().offset()
- Pre-existing test failure in tests/scraper/source-url-dedup.test.ts (4 tests) -- unrelated to this plan, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pagination infrastructure ready for any future paginated views
- enrichLead() available for any new query function needing lead enrichment
- getLeadsByIds() available for any feature needing batch lead lookups

## Self-Check: PASSED

All 7 files verified present. All 3 commits (3cb9fc4, aa67487, 7d064cc) verified in git log.

---
*Phase: 10-query-optimizations*
*Completed: 2026-03-16*
