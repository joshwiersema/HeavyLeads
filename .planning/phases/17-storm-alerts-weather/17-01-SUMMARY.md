---
phase: 17-storm-alerts-weather
plan: 01
status: complete
completed: 2026-03-16
commits:
  - 290465c feat(17-01): add NWS storm and FEMA disaster scraper adapters
  - 58a03ce feat(17-01): add storm cron, urgency boost, factory wiring, and vercel schedule
---

## Summary

Built NWS storm alert and FEMA disaster declaration scraper adapters, wired them into the factory and pipeline, added a 25-point storm urgency scoring boost, and created a dedicated 30-minute cron route.

## What was built

### Task 1: NWS storm adapter, FEMA disaster adapter, and supporting infrastructure

- **NwsStormAdapter** (`src/lib/scraper/adapters/nws-storm-adapter.ts`): Fetches active weather alerts from NWS API, filters for roofing-relevant events (Tornado Warning, Severe Thunderstorm Warning, Hail Advisory, Wind Advisory, Hurricane Warning, Tropical Storm Warning, Flash Flood Warning), computes centroid from GeoJSON Polygon/Point geometry, maps to RawLeadData with sourceType "storm"
- **FemaDisasterAdapter** (`src/lib/scraper/adapters/fema-disaster-adapter.ts`): Fetches recent 90-day disaster declarations from FEMA API, filters for relevant incident types (Fire, Flood, Hurricane, Severe Storm, Tornado, Earthquake), maps to RawLeadData with sourceType "disaster"
- **base-adapter.ts**: Added "storm" and "disaster" to sourceTypes array
- **content-hash.ts**: Added storm/disaster cases using `sourceId:externalId` pattern
- **api-rate-limiter.ts**: Added `getNwsQueue()` (concurrency=1, 5 req/min)

### Task 2: Factory registration, storm urgency boost, storm cron route, vercel.json

- **Factory** (`src/lib/scraper/adapters/index.ts`): roofing gets NwsStormAdapter + FemaDisasterAdapter; heavy_equipment gets FemaDisasterAdapter
- **Urgency scoring** (`src/lib/scoring/urgency.ts`): Storm-sourced leads get +25 point boost (maxScore 35, score = base + 25). Non-storm leads unchanged at maxScore 10
- **Storm cron route** (`src/app/api/cron/storm-alerts/route.ts`): GET /api/cron/storm-alerts with CRON_SECRET auth, 25-min idempotency window, runs NWS + FEMA adapters, maxDuration=120
- **vercel.json**: Added storm-alerts cron at */30 * * * * (first entry, highest priority)

## Tests

- `tests/scraper/nws-storm-adapter.test.ts` -- 12 tests (filtering, centroid, field mapping, error handling, User-Agent, truncation)
- `tests/scraper/fema-disaster-adapter.test.ts` -- 8 tests (mapping, validation, error handling, URL construction)
- `tests/scraper/storm-cron.test.ts` -- 7 tests (auth, idempotency, pipeline invocation, success/failure handling)
- `tests/scoring/urgency-storm.test.ts` -- 7 tests (storm boost scoring, non-storm unchanged, disaster distinct)
- Updated: `tests/scraper/factory.test.ts`, `tests/scraper/adapters.test.ts`, `tests/scoring/engine.test.ts`, `tests/helpers/scraper.ts`

Total: 34 new tests + updated existing tests. All 106 affected tests pass.

## Verification

- `npx vitest run` -- all tests pass (only pre-existing mobile-nav UI test fails, unrelated)
- `npx next build` -- TypeScript compilation succeeds (pre-existing "use server" runtime error in bookmarks feature, unrelated)
- sourceTypes includes "storm" and "disaster"
- content-hash handles storm/disaster (returns non-null for valid inputs)
- getAdaptersForIndustry("roofing") returns 6 adapters including NwsStormAdapter and FemaDisasterAdapter
- getAdaptersForIndustry("heavy_equipment") returns 9 adapters including FemaDisasterAdapter
- vercel.json has 9 cron entries including storm-alerts at */30 schedule
- Storm urgency: 35pts (25 boost + 10 base) with deadline <48h; 25pts without deadline
