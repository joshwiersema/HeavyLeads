---
phase: 16-cron-and-scraper-architecture
plan: 03
status: completed
started: 2026-03-16
completed: 2026-03-16
commits:
  - 0f44e8e: "feat(16-03): add per-industry crons, enrichment, expiration, and health monitoring"
---

# Plan 16-03 Summary: Per-Industry Crons, Enrichment, Expiration, Health

## What Was Done

### Task 1: Per-industry cron route + enrichment/expiration logic
- Created `src/app/api/cron/scrape/[industry]/route.ts` with idempotency guard (skip if running within 15 min)
- Validates industry param against 5 supported values, returns 400 for invalid
- Creates pipeline_runs with `triggeredBy: 'cron-{industry}'`
- Created `src/lib/scraper/enrichment.ts` with keyword-based industry tagging and value tier inference
- Created `src/lib/scraper/expiration.ts` with per-source-type staleness rules (permit 90d, bid past deadline, news 60d, deep-web 30d)
- 19 tests covering pure functions and cron route behavior

### Task 2: Health monitoring + cron routes + vercel.json
- Created `src/lib/scraper/health.ts` with consecutive failure detection (healthy/degraded/circuit_open)
- Created enrichment, expiration, and health cron routes with CRON_SECRET auth
- Updated vercel.json with 8 staggered cron entries (5 industry + enrich + expire + health)
- 6 health monitoring tests

## Decisions

- Expiration uses `severity = 'expired'` (existing column) rather than adding new lifecycle column
- Per-industry crons do NOT trigger email digest (digest runs on its own cron in Phase 18)
- Legacy `/api/cron/scrape` route kept for backward compat
- Enrichment limits to 500 leads per run to stay within function timeout

## Verification

- 200 tests passing across 22 test files
- Production build succeeds
- vercel.json has 8 staggered cron entries (no two at same minute)
