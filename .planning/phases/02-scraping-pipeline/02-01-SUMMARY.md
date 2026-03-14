---
phase: 02-scraping-pipeline
plan: 01
subsystem: database, api
tags: [drizzle, zod, crawlee, node-cron, scraping, pipeline, upsert, geocoding]

# Dependency graph
requires:
  - phase: 01-platform-foundation
    provides: "Drizzle ORM setup, schema patterns, geocoding utility"
provides:
  - "Leads table schema with dedup index (sourceId+permitNumber)"
  - "ScraperAdapter interface for jurisdiction-specific scrapers"
  - "RawPermitData Zod validation schema"
  - "Pipeline orchestrator with error isolation, geocoding, and upsert dedup"
  - "Adapter registry for dynamic adapter registration"
  - "crawlee and node-cron dependencies installed"
affects: [02-scraping-pipeline, 03-lead-management]

# Tech tracking
tech-stack:
  added: [crawlee, node-cron, "@types/node-cron"]
  patterns: [adapter-pattern, pipeline-orchestrator, zod-validation-before-insert, upsert-dedup]

key-files:
  created:
    - src/lib/db/schema/leads.ts
    - src/lib/scraper/types.ts
    - src/lib/scraper/adapters/base-adapter.ts
    - src/lib/scraper/pipeline.ts
    - src/lib/scraper/registry.ts
    - tests/helpers/scraper.ts
    - tests/scraper/schema.test.ts
    - tests/scraper/validation.test.ts
    - tests/scraper/pipeline.test.ts
  modified:
    - src/lib/db/schema/index.ts
    - .gitignore
    - package.json

key-decisions:
  - "Used plain real columns for lat/lng instead of PostGIS geometry — Neon driver compatibility unverified, Haversine queries sufficient for MVP"
  - "Pipeline geocodes all records via geocodeAddress — RawPermitData has no lat/lng fields, coordinates come from geocoding service"
  - "Zod validation filters invalid records with logging rather than failing entire batch"
  - "25ms throttle between geocoding requests to avoid Google Maps rate limiting"

patterns-established:
  - "Adapter pattern: implement ScraperAdapter interface for each jurisdiction data source"
  - "Pipeline orchestrator: per-adapter error isolation with try/catch, aggregate results"
  - "Upsert dedup: onConflictDoUpdate on sourceId+permitNumber unique constraint"
  - "Zod validation gate: validate before insert, skip invalid records"

requirements-completed: [DATA-01, DATA-05, DATA-07]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 02 Plan 01: Pipeline Foundation Summary

**Leads table schema with Drizzle ORM, ScraperAdapter interface, Zod validation, and pipeline orchestrator with error isolation and upsert deduplication**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T04:38:11Z
- **Completed:** 2026-03-14T04:42:57Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Leads table schema with all permit fields, lat/lng columns, and unique composite index on sourceId+permitNumber for dedup
- ScraperAdapter interface and RawPermitData Zod schema establishing the contract all jurisdiction adapters implement
- Pipeline orchestrator with per-adapter error isolation, Zod validation, geocoding with throttle, and upsert deduplication
- Adapter registry for dynamic registration/retrieval of scraper adapters
- Comprehensive test suite: 17 tests covering schema, validation, and pipeline behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Leads table schema, adapter interface, pipeline types, Zod validation** - `19ed607` (feat)
2. **Task 2 RED: Failing tests for pipeline, schema, and validation** - `8a9fe20` (test)
3. **Task 2 GREEN: Pipeline orchestrator implementation** - `6617b00` (feat)

_Note: TDD Task 2 produced 2 commits (test + feat). Refactor phase skipped — code was clean._

## Files Created/Modified
- `src/lib/db/schema/leads.ts` - Leads table with permit fields, lat/lng, dedup index, scrapedAt index
- `src/lib/db/schema/index.ts` - Added leads export
- `src/lib/scraper/types.ts` - PipelineResult and PipelineRunResult types
- `src/lib/scraper/adapters/base-adapter.ts` - ScraperAdapter interface and rawPermitSchema Zod schema
- `src/lib/scraper/pipeline.ts` - Pipeline orchestrator: runPipeline with validation, geocoding, upsert
- `src/lib/scraper/registry.ts` - Adapter registration and retrieval
- `tests/helpers/scraper.ts` - Mock adapter and permit data factories
- `tests/scraper/schema.test.ts` - Leads table column and index verification (3 tests)
- `tests/scraper/validation.test.ts` - Zod schema accept/reject tests (6 tests)
- `tests/scraper/pipeline.test.ts` - Error isolation, dedup, geocoding, timestamps (8 tests)
- `.gitignore` - Added storage/ for Crawlee local storage
- `package.json` - Added crawlee, node-cron, @types/node-cron

## Decisions Made
- Used plain real columns for lat/lng instead of PostGIS geometry — Neon serverless driver compatibility with PostGIS unverified, Haversine-based queries sufficient for MVP volumes. PostGIS upgrade path documented in code comment.
- Pipeline geocodes all records through geocodeAddress — RawPermitData schema intentionally excludes lat/lng since coordinates come from the geocoding service, not the source data.
- Zod validation filters invalid records with console.warn logging rather than failing the entire adapter batch — maximizes data capture.
- 25ms throttle between geocoding requests to respect Google Maps API rate limits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ScraperAdapter interface ready for jurisdiction-specific adapter implementations (Plan 02-02)
- Pipeline orchestrator ready to run any registered adapters
- Leads table schema ready for data — will need database migration (Drizzle push/migrate) before first use
- Test infrastructure and helpers available for adapter-specific tests

## Self-Check: PASSED

- All 11 created files verified present on disk
- All 3 task commits verified in git log (19ed607, 8a9fe20, 6617b00)
- TypeScript compilation: PASS
- All 17 tests: PASS

---
*Phase: 02-scraping-pipeline*
*Completed: 2026-03-14*
