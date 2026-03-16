---
phase: 18-intelligence-polish
plan: 01
status: complete
started: 2026-03-16
completed: 2026-03-16
---

## Summary

Built three industry intelligence data sources: code violation scrapers for HVAC/roofing/electrical leads, EIA utility rate scraper for solar ROI context, and a curated solar incentive lookup table.

## What was done

### Task 1: Code Violation Socrata Adapters (3 cities)

- Added `"violation"` to `sourceTypes` array in `base-adapter.ts`
- Created `SocrataViolationAdapter` abstract base class with SODA3/SODA2 fallback and 60-day lookback window (longer than permits since violations persist)
- Created city-specific adapters:
  - `AustinViolationsAdapter` — dataset `ckex-2zb9` on `data.austintexas.gov`
  - `DallasViolationsAdapter` — dataset `46i7-rbhj` on `www.dallasopendata.com`
  - `HoustonViolationsAdapter` — dataset `k6hb-wr87` on `data.houstontx.gov`
- Added `"violation"` case to `content-hash.ts` using `sourceId:permitNumber` pattern
- Registered all three violation adapters in factory for `hvac`, `roofing`, and `electrical` industries (NOT `heavy_equipment` or `solar`)
- Updated `getAllAdapters()` to collect deduped superset across all industries instead of just returning heavy_equipment

### Task 2: EIA Utility Rate Adapter + Solar Incentive Lookup

- Added `getEiaQueue()` to `api-rate-limiter.ts` (concurrency=1, 30 req/min)
- Created `EiaUtilityRateAdapter` fetching from EIA Open Data API v2 `/electricity/retail-sales/data/`
  - Requires `EIA_API_KEY` env var (trimmed), returns `[]` gracefully if missing
  - Maps state-level residential rates to `RawLeadData` with `sourceType: "news"`
  - Includes state capital city for each record
- Created `solar-incentives.ts` static lookup table with 15 curated state programs
  - Covers: CA, TX, NY, FL, AZ, MA, NJ, CO, NC, CT, MD, MN, IL, NV, OR
  - Exports `getSolarIncentives(stateCode)` and `getAllSolarIncentives()`
  - NOT a scraper adapter — pure data + getter functions
- Registered `EiaUtilityRateAdapter` in factory for `solar` industry

## Test results

- 28 test files, 266 tests passing
- New test files: `violation-adapter.test.ts` (18 tests), `eia-adapter.test.ts` (9 tests), `solar-incentives.test.ts` (11 tests)
- Updated: `factory.test.ts` (8 tests), `adapters.test.ts` (21 tests)

## Pre-existing issues (not introduced by this plan)

- `npx next build` fails on `/dashboard/leads/[id]` due to `LEAD_STATUS_VALUES` array export from a "use server" action file — this is a pre-existing Next.js 16 compatibility issue, not caused by scraper changes
- `npx tsc --noEmit` shows pre-existing type errors in `tests/leads/` files

## Files modified/created

### New files
- `src/lib/scraper/adapters/socrata-violation-adapter.ts`
- `src/lib/scraper/adapters/austin-violations.ts`
- `src/lib/scraper/adapters/dallas-violations.ts`
- `src/lib/scraper/adapters/houston-violations.ts`
- `src/lib/scraper/adapters/eia-utility-rates.ts`
- `src/lib/scraper/adapters/solar-incentives.ts`
- `tests/scraper/violation-adapter.test.ts`
- `tests/scraper/eia-adapter.test.ts`
- `tests/scraper/solar-incentives.test.ts`

### Modified files
- `src/lib/scraper/adapters/base-adapter.ts` — added "violation" to sourceTypes
- `src/lib/scraper/adapters/index.ts` — updated factory + getAllAdapters()
- `src/lib/scraper/api-rate-limiter.ts` — added getEiaQueue()
- `src/lib/scraper/content-hash.ts` — added violation dedup case
- `tests/scraper/factory.test.ts` — updated for new adapters
- `tests/scraper/adapters.test.ts` — updated adapter count
- `tests/helpers/scraper.ts` — added violation defaults
