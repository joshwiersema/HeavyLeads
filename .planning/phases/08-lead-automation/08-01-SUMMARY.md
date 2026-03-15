---
phase: 08-lead-automation
plan: 01
subsystem: api
tags: [vercel-cron, rate-limiting, drizzle, pipeline, next-api-routes]

# Dependency graph
requires:
  - phase: 02-scraping-pipeline
    provides: runPipeline, adapter registry, pipeline orchestrator
  - phase: 05-lead-management
    provides: email digest generator
provides:
  - pipeline_runs table schema for tracking run history and rate limiting
  - GET /api/cron/scrape with CRON_SECRET Bearer auth for Vercel Cron
  - POST /api/scraper/run with session auth and DB-based 1hr/org rate limiting
  - checkRateLimit utility for DB-based rate limiting
  - vercel.json cron configuration for daily 06:00 UTC execution
affects: [08-02, dashboard, onboarding]

# Tech tracking
tech-stack:
  added: [vercel-cron]
  patterns: [cron-secret-auth, db-rate-limiting, pipeline-run-recording]

key-files:
  created:
    - src/lib/db/schema/pipeline-runs.ts
    - src/app/api/cron/scrape/route.ts
    - src/lib/scraper/rate-limit.ts
    - vercel.json
    - tests/scraper/cron-route.test.ts
    - tests/scraper/rate-limit.test.ts
    - tests/scraper/user-trigger.test.ts
  modified:
    - src/lib/db/schema/index.ts
    - src/app/api/scraper/run/route.ts
    - tests/setup.ts

key-decisions:
  - "Separate routes for cron (GET) and user-triggered (POST) runs with different auth mechanisms"
  - "DB-based rate limiting using pipeline_runs table instead of Redis or in-memory"
  - "Cron runs recorded with null organizationId to avoid affecting per-org rate limits"
  - "Email digest triggered dynamically from cron route (same pattern as old scheduler.ts)"

patterns-established:
  - "CRON_SECRET Bearer auth: request.headers.get('authorization') !== Bearer ${CRON_SECRET}"
  - "Pipeline run recording: insert pending/running -> update completed/failed with results"
  - "DB rate limiting: query recent runs within time window, return allowed/nextAllowedAt"

requirements-completed: [AUTO-01, AUTO-04, AUTO-05]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 8 Plan 01: Pipeline Infrastructure Summary

**Vercel Cron GET route with CRON_SECRET auth, session-secured user-trigger POST route with DB-based 1hr/org rate limiting, pipeline_runs tracking schema, and vercel.json cron config**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T21:05:25Z
- **Completed:** 2026-03-15T21:09:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- pipeline_runs schema with org+startedAt index for rate limit queries, exported from schema index
- Vercel Cron GET route at /api/cron/scrape with CRON_SECRET Bearer auth, pipeline run recording, and email digest triggering
- User-trigger POST route at /api/scraper/run secured with session auth and DB-based 1hr/org rate limiting
- vercel.json configuring daily 06:00 UTC cron invocation
- 10 passing tests covering auth, rate limiting, and pipeline execution

## Task Commits

Each task was committed atomically (TDD: RED -> GREEN):

1. **Task 1: Pipeline runs schema, rate limit utility, and test scaffolds**
   - `572ca6e` (test) -- RED: failing tests for schema and rate limiting
   - `22d203d` (feat) -- GREEN: implement checkRateLimit

2. **Task 2: Vercel Cron route, secured user-trigger route, and vercel.json**
   - `eb9cb66` (test) -- RED: failing tests for cron and user-trigger routes
   - `61a353e` (feat) -- GREEN: implement routes and vercel.json

## Files Created/Modified
- `src/lib/db/schema/pipeline-runs.ts` -- pipeline_runs table with id, orgId, triggeredBy, triggerType, status, records counts, timestamps
- `src/lib/db/schema/index.ts` -- added pipeline-runs export
- `src/lib/scraper/rate-limit.ts` -- checkRateLimit(orgId) queries pipeline_runs for 1hr window
- `src/app/api/cron/scrape/route.ts` -- GET handler with CRON_SECRET auth, pipeline run recording, email digest trigger
- `src/app/api/scraper/run/route.ts` -- POST handler with session auth, rate limiting, pipeline run recording
- `vercel.json` -- Vercel Cron config for daily 06:00 UTC at /api/cron/scrape
- `tests/setup.ts` -- added CRON_SECRET env var
- `tests/scraper/rate-limit.test.ts` -- 4 tests for rate limiting logic
- `tests/scraper/cron-route.test.ts` -- 3 tests for cron route auth and pipeline execution
- `tests/scraper/user-trigger.test.ts` -- 3 tests for session auth, rate limiting, and pipeline execution

## Decisions Made
- Separate routes for cron (GET /api/cron/scrape) and user-triggered (POST /api/scraper/run) with different auth mechanisms -- avoids auth confusion and follows Vercel Cron GET requirement
- DB-based rate limiting using pipeline_runs table -- avoids Redis dependency for a simple 1/hour check; state survives serverless cold starts
- Cron runs stored with null organizationId -- global runs don't count against any org's rate limit
- Email digest triggered via dynamic import from cron route -- same pattern as existing scheduler.ts for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

CRON_SECRET must be set in Vercel project environment variables (Settings > Environment Variables) for production cron auth. Use a random 16+ character string. Also add to .env.local for local testing.

## Next Phase Readiness
- Pipeline infrastructure complete for Plan 02 to build dashboard UI on top of
- pipeline_runs table ready for progress indicator queries
- Rate limiting ready for Refresh Leads button
- First-login trigger can use POST /api/scraper/run or call pipeline directly

## Self-Check: PASSED

All 9 created files verified on disk. All 4 task commits verified in git log.

---
*Phase: 08-lead-automation*
*Completed: 2026-03-15*
