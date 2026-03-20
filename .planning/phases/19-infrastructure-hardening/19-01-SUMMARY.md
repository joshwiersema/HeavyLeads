---
phase: 19-infrastructure-hardening
plan: 01
subsystem: infra
tags: [geocoding, cache, nominatim, google-maps, drizzle, postgres]

# Dependency graph
requires: []
provides:
  - geocoding_cache table schema with addressHash unique index
  - Cache-first geocodeAddress with Google primary and Nominatim fallback
  - 19 unit tests for cache, fallback, and rate limiting
affects: [scraper-pipeline, lead-processing, data-sources]

# Tech tracking
tech-stack:
  added: [nominatim-api]
  patterns: [cache-first-api-pattern, multi-provider-fallback, address-hash-dedup]

key-files:
  created:
    - src/lib/db/schema/geocoding-cache.ts
    - tests/scraper/geocoding-cache.test.ts
  modified:
    - src/lib/geocoding.ts
    - src/lib/db/schema/index.ts
    - tests/regressions/geocoding-null.test.ts

key-decisions:
  - "SHA-256 hash of normalized (lowercase, trimmed, whitespace-collapsed) address for cache keys"
  - "90-day cache TTL to balance freshness with API savings"
  - "Null lat/lng cached to prevent retrying known-bad addresses"
  - "onConflictDoUpdate on addressHash for race-safe cache upserts"
  - "Nominatim as free unlimited fallback with 1-req/sec rate limit"

patterns-established:
  - "Cache-first API pattern: check DB cache before external API call, cache results (including failures)"
  - "Multi-provider fallback: primary provider with automatic failover to secondary"

requirements-completed: [INFRA-02, INFRA-03]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 19 Plan 01: Geocoding Cache and Nominatim Fallback Summary

**DB-cached geocoding with SHA-256 address hashing, Google Maps primary, and Nominatim free fallback for quota overflow**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T04:17:14Z
- **Completed:** 2026-03-20T04:22:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created geocoding_cache table with unique addressHash index for O(1) cache lookups
- Rewrote geocodeAddress with 3-layer strategy: cache lookup, Google Maps primary, Nominatim fallback
- Null-coord caching prevents retrying known-bad addresses across pipeline runs
- Google OVER_QUERY_LIMIT and REQUEST_DENIED automatically route to Nominatim
- Missing Google API key routes directly to Nominatim (no silent failure)
- 19 new unit tests covering cache hits, misses, fallback, rate limiting, and resilience

## Task Commits

Each task was committed atomically:

1. **Task 1: Create geocoding_cache schema and register in DB index** - `3154e5e` (feat)
2. **Task 2: Rewrite geocodeAddress with cache-first lookup and Nominatim fallback** - `1dc71ea` (feat)

## Files Created/Modified
- `src/lib/db/schema/geocoding-cache.ts` - Geocoding cache table schema with UUID PK, addressHash unique index, provider tracking, expiry
- `src/lib/geocoding.ts` - Rewritten with normalizeAddress, hashAddress, nominatimGeocode, and 3-layer geocodeAddress
- `src/lib/db/schema/index.ts` - Added geocoding-cache export
- `tests/scraper/geocoding-cache.test.ts` - 19 unit tests for cache and fallback logic
- `tests/regressions/geocoding-null.test.ts` - Updated regression test for Nominatim fallback behavior

## Decisions Made
- SHA-256 hash of normalized address for cache keys (consistent, collision-resistant)
- 90-day cache TTL balances data freshness with API cost savings
- Null lat/lng entries are cached to prevent retrying addresses that have no geocoding result
- onConflictDoUpdate on addressHash handles race conditions during concurrent pipeline runs
- Nominatim User-Agent set to "GroundPulse/1.0" per OSM usage policy
- Cache operations are non-fatal -- geocoding still works if DB cache is unavailable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated regression test for Nominatim fallback behavior**
- **Found during:** Task 2 (verification step)
- **Issue:** `tests/regressions/geocoding-null.test.ts` used the real geocodeAddress without mocking, and expected null coords when API key was missing. With Nominatim fallback, valid coords are now returned from the real Nominatim API.
- **Fix:** Converted test to use mocked DB and fetch, updated assertions to verify Nominatim fallback behavior while preserving the core regression check (no 0,0 coordinates)
- **Files modified:** tests/regressions/geocoding-null.test.ts
- **Verification:** All 27 tests pass (19 new + 4 regression-null + 4 regression-error-handling)
- **Committed in:** 1dc71ea (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Regression test update was necessary for correctness. Core regression (no Null Island 0,0 coords) still validated. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Nominatim is a free public API. The geocoding_cache table needs to be pushed to the database via `npx drizzle-kit push`.

## Next Phase Readiness
- Geocoding cache and fallback ready for nationwide pipeline expansion
- Google Maps 10K/month quota is now soft-capped: overflow routes to Nominatim automatically
- Pipeline.ts requires zero changes -- geocodeAddress signature is unchanged

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 19-infrastructure-hardening*
*Completed: 2026-03-20*
