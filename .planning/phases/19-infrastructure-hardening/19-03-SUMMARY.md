---
phase: 19-infrastructure-hardening
plan: 03
subsystem: database, infra
tags: [drizzle, postgresql, neon, jsonb, expiration, data-portals, batch-delete]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - data_portals schema table with JSONB field_mapping for dynamic portal configs
  - Hard-delete lead expiration (45-day cutoff) with bookmark/interaction preservation
  - Batched deletion preventing Neon serverless query timeouts
affects: [21-dynamic-portal-discovery, 20-scoring-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [raw SQL DELETE with NOT EXISTS subqueries, batched deletion loop, JSONB config storage]

key-files:
  created:
    - src/lib/db/schema/data-portals.ts
    - tests/scraper/expiration-hardening.test.ts
  modified:
    - src/lib/db/schema/index.ts
    - src/lib/scraper/expiration.ts
    - src/app/api/cron/expire/route.ts
    - tests/scraper/expiration.test.ts

key-decisions:
  - "Raw SQL DELETE over Drizzle ORM query builder for correlated NOT EXISTS subqueries"
  - "45-day uniform cutoff replaces per-source-type expiration windows (90/60/30 days)"
  - "Batch size of 500 for Neon serverless query timeout safety"

patterns-established:
  - "Batched deletion: do/while loop with configurable batch size for large dataset operations"
  - "Preservation via NOT EXISTS: exclude rows referenced by other tables instead of JOINs"
  - "JSONB column for flexible schema-less configuration (field_mapping pattern)"

requirements-completed: [INFRA-04, INFRA-05]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 19 Plan 03: Expiration Hardening & Data Portals Summary

**Hard-delete lead expiration with 45-day cutoff preserving bookmarked/interacted leads, plus data_portals JSONB schema for dynamic portal discovery**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T04:17:23Z
- **Completed:** 2026-03-20T04:22:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created data_portals schema table with JSONB field_mapping column for storing Socrata/ArcGIS portal configurations, eliminating future need for per-city TypeScript adapter files
- Upgraded lead expiration from soft-marking (severity="expired") to hard DELETE with bookmark and lead_status preservation rules
- Implemented batched deletion (500 per batch) to avoid Neon serverless query timeouts on large datasets
- Added 8 new tests for hardened expiration logic covering batch processing, preservation, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data_portals schema table** - `c98e940` (feat)
2. **Task 2: Upgrade lead expiration to hard-delete with bookmark/interaction preservation** - `fd7feef` (feat)

## Files Created/Modified
- `src/lib/db/schema/data-portals.ts` - New data_portals table with JSONB field_mapping, unique domain+datasetId index, portal_type/state/enabled indexes
- `src/lib/db/schema/index.ts` - Added data-portals export
- `src/lib/scraper/expiration.ts` - Rewrote from db.update severity marking to db.execute raw SQL DELETE with NOT EXISTS preservation
- `src/app/api/cron/expire/route.ts` - Updated logging to reflect deletion behavior, changed response key to "deleted"
- `tests/scraper/expiration-hardening.test.ts` - 8 tests for batching, preservation, cutoff date, SQL structure, null rowCount
- `tests/scraper/expiration.test.ts` - Updated existing tests to match new db.execute-based implementation

## Decisions Made
- **Raw SQL over Drizzle ORM for DELETE:** Drizzle ORM lacks good support for correlated NOT EXISTS subqueries in DELETE statements, so raw SQL via `db.execute(sql\`...\`)` was used
- **45-day uniform cutoff:** Replaced the previous per-source-type windows (90 days for permits, 60 for news, 30 for deep-web) with a single 45-day cutoff. This simplifies the logic and is more aggressive for storage control (key for 0.5 GB Neon ceiling)
- **Batch size 500:** Chosen as a safe batch size for Neon serverless to avoid 10s query timeouts while still being efficient

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing expiration tests for new implementation**
- **Found during:** Task 2 (expiration upgrade)
- **Issue:** Existing `tests/scraper/expiration.test.ts` mocked `db.update` but new implementation uses `db.execute`, causing all 3 existing tests to fail with "db.execute is not a function"
- **Fix:** Rewrote existing tests to mock `db.execute` and verify the new DELETE-based behavior
- **Files modified:** tests/scraper/expiration.test.ts
- **Verification:** All 3 existing tests pass with updated mocks
- **Committed in:** fd7feef (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary to maintain test suite integrity after implementation change. No scope creep.

## Issues Encountered
None - both tasks executed cleanly after the test fix.

## User Setup Required
None - no external service configuration required. The data_portals table will be created when `npx drizzle-kit push` is run (included in standard deploy flow).

## Next Phase Readiness
- data_portals schema is ready for Phase 21's dynamic portal discovery to populate and query
- Lead expiration now actively frees Neon storage, addressing the 0.5 GB ceiling blocker
- All existing tests pass with the updated expiration behavior

---
*Phase: 19-infrastructure-hardening*
*Completed: 2026-03-20*
