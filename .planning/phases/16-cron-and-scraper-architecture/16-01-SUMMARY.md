---
phase: 16-cron-and-scraper-architecture
plan: 01
status: completed
started: 2026-03-16
completed: 2026-03-16
commits:
  - add54a3: "feat(16-01): add factory pattern, content hash, and rate limiter modules"
  - 98b4974: "feat(16-01): integrate scraper_runs tracking, content hash dedup, and factory routes"
---

# Plan 16-01 Summary: Factory Pattern, Content Hash, Rate Limiter & Pipeline Integration

## What Was Done

### Task 1: Factory pattern, content hash, and rate limiter modules
- Rewrote `src/lib/scraper/adapters/index.ts` as factory module with `getAdaptersForIndustry()` and `getAllAdapters()`
- Modified SAM.gov adapter to accept optional `{ naicsCodes }` constructor parameter
- Created `src/lib/scraper/content-hash.ts` with SHA-256 content hash computation per source type
- Created `src/lib/scraper/api-rate-limiter.ts` with p-queue wrappers for Socrata and SAM.gov
- Installed p-queue and added to serverExternalPackages in next.config.ts
- Deprecated `src/lib/scraper/registry.ts` (kept for backward compat)

### Task 2: Pipeline scraper_runs integration + content hash dedup + route updates
- Extended `runPipeline()` to accept `{ pipelineRunId, industry }` options
- Pipeline now inserts/updates `scraper_runs` rows per adapter execution
- Content hash computed and stored on every lead insert
- Migrated cron route (`/api/cron/scrape`) from registry to factory pattern
- Migrated on-demand route (`/api/scraper/run`) from registry to factory pattern
- Updated all test mocks (cron-route, user-trigger, pipeline, adapters)

## Decisions

- `getAllAdapters()` returns heavy_equipment adapter set as the superset (simplest dedup approach)
- scraper_runs tracking is best-effort (wrapped in try/catch, warns on failure) to not break pipeline on tracking errors
- Content hash uses SHA-256 hex digest with lowercased+trimmed inputs
- Rate limiter uses singleton pattern within invocation (fine for serverless cold starts)

## Verification

- 151 tests passing across 17 test files
- Production build succeeds
- No production code imports from deprecated registry.ts
