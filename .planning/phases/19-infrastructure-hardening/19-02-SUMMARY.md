---
phase: 19-infrastructure-hardening
plan: 02
subsystem: infra
tags: [cron, batching, fan-out, vercel, serverless, scraper]

# Dependency graph
requires:
  - phase: none
    provides: existing per-industry cron route and scraper pipeline
provides:
  - Batch orchestrator utility (splitIntoBatches, serializeBatch, invokeBatch, getBaseUrl)
  - Batch execution endpoint (POST /api/cron/scrape/batch)
  - Fan-out cron pattern for parallel batch execution
affects: [19-infrastructure-hardening, 20-data-pipeline-expansion, 21-nationwide-scraping]

# Tech tracking
tech-stack:
  added: []
  patterns: [fan-out batching via internal HTTP, Promise.allSettled for fault-tolerant parallel execution]

key-files:
  created:
    - src/lib/scraper/batch-orchestrator.ts
    - src/app/api/cron/scrape/batch/route.ts
    - tests/scraper/batch-orchestrator.test.ts
  modified:
    - src/app/api/cron/scrape/[industry]/route.ts

key-decisions:
  - "Direct execution for <=5 adapters (1 batch) to avoid unnecessary fan-out overhead"
  - "Promise.allSettled over Promise.all to ensure failed batches do not block others"
  - "Internal HTTP fan-out via app base URL for separate serverless invocation per batch"

patterns-established:
  - "Fan-out batching: split work into batches, invoke each as separate serverless function via internal HTTP"
  - "Graceful degradation: direct execution for small adapter sets, fan-out only when needed"

requirements-completed: [INFRA-01]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 19 Plan 02: Fan-out Cron Batching Summary

**Fan-out cron batching splits 20+ adapters into groups of 5, each invoked as a separate serverless function via internal HTTP to stay within Vercel's 300s timeout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T04:17:34Z
- **Completed:** 2026-03-20T04:20:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created batch orchestrator utility with splitIntoBatches, serializeBatch, invokeBatch, and getBaseUrl functions
- Added POST /api/cron/scrape/batch endpoint with maxDuration=300 for processing adapter subsets
- Rewrote per-industry cron route to fan out to batch endpoint when adapter count exceeds 5
- Added 15 unit tests covering batch splitting, serialization, and URL resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create batch orchestrator and batch execution endpoint** - `7f917c9` (feat)
2. **Task 2: Update per-industry cron route to use fan-out batching and add tests** - `9cd0abc` (feat)

## Files Created/Modified
- `src/lib/scraper/batch-orchestrator.ts` - Batch splitting, serialization, HTTP invocation, and base URL utilities
- `src/app/api/cron/scrape/batch/route.ts` - Internal POST endpoint for running a subset of adapters with 300s timeout
- `src/app/api/cron/scrape/[industry]/route.ts` - Updated cron entry point that fans out to batch endpoint for 6+ adapters
- `tests/scraper/batch-orchestrator.test.ts` - 15 unit tests for batch orchestrator pure logic functions

## Decisions Made
- Direct execution for <=5 adapters to avoid unnecessary fan-out overhead (no HTTP round-trip for small sets)
- Promise.allSettled for parallel batch invocation so failed batches do not prevent other batches from completing
- Internal HTTP fan-out via NEXT_PUBLIC_APP_URL / VERCEL_URL for separate serverless invocation per batch
- CRON_SECRET bearer token authentication on batch endpoint to prevent unauthorized access

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fan-out batching is ready for nationwide adapter expansion (20+ adapters per industry)
- Each batch runs within its own 300s timeout window
- Existing tests (industry-cron, pipeline) continue to pass with no regressions

## Self-Check: PASSED

- All 4 files verified present on disk
- Commit 7f917c9 (Task 1) verified in git log
- Commit 9cd0abc (Task 2) verified in git log
- 15/15 unit tests passing
- 6/6 existing industry-cron tests passing
- No TypeScript errors in modified files

---
*Phase: 19-infrastructure-hardening*
*Completed: 2026-03-20*
