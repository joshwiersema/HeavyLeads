---
phase: 23-feed-performance-optimization
plan: 02
subsystem: scraper
tags: [dedup, cross-source, permit-matching, fuzzy-matching, string-similarity]

# Dependency graph
requires:
  - phase: 19-geocoding-expiration
    provides: "Geocoding cache and haversineDistance utility"
provides:
  - "Cross-source dedup via permit number fuzzy match (>0.8 similarity)"
  - "Cross-source dedup via date proximity (3 days) + address similarity (>0.5)"
  - "normalizePermitNumber() utility for permit number comparison across portals"
  - "Cross-source merge logging for observability"
affects: [scraper-pipeline, dedup, lead-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-path dedup matching: geographic proximity + (permit number OR text similarity OR date+address compound)"
    - "Permit number normalization: strip common prefixes (BP, BLD, BLDG, COM, RES, PMT, PERMIT)"

key-files:
  created: []
  modified:
    - src/lib/scraper/dedup.ts
    - tests/scraper/dedup.test.ts

key-decisions:
  - "Three matching paths all require geographic proximity as prerequisite to prevent false merges"
  - "Permit number similarity threshold at 0.8 (higher than text threshold) for cross-source confidence"
  - "Date proximity window of 3 days catches delayed portal publishing"
  - "Address similarity lowered to 0.5 when combined with date proximity (compound signal)"
  - "Regex ordering: bldg before bld to prevent partial prefix match"

patterns-established:
  - "DedupCandidate includes sourceId for cross-source detection and logging"
  - "Distinct logging for cross-source vs same-source merges"

requirements-completed: [PERF-04]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 23 Plan 02: Cross-Source Deduplication Summary

**Enhanced cross-source dedup with permit number fuzzy matching, date+address compound matching, and cross-source merge logging**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T06:09:56Z
- **Completed:** 2026-03-20T06:14:05Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Three-path dedup matching: permit number (>0.8), text similarity (>0.7), and date+address compound (3 days + >0.5)
- All matching paths require geographic proximity as prerequisite
- normalizePermitNumber() strips common permit prefixes (BP, BLD, BLDG, COM, RES, PMT, PERMIT) for cross-portal comparison
- Cross-source merges logged distinctly for observability
- Updated existing tests and added new test cases for cross-source matching

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance isLikelyDuplicate with cross-source matching signals** - `c8d952c` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/lib/scraper/dedup.ts` - Enhanced with normalizePermitNumber(), 3-path isLikelyDuplicate, cross-source logging
- `tests/scraper/dedup.test.ts` - Updated DedupCandidate test objects, added cross-source test cases (21 tests total)

## Decisions Made
- Three matching paths all require geographic proximity as prerequisite to prevent false merges
- Permit number similarity threshold at 0.8 (higher than text threshold 0.7) for cross-source confidence
- Date proximity window of 3 days catches delayed portal publishing across city/county portals
- Address similarity lowered to 0.5 when combined with date proximity (compound signal strength)
- Regex ordering: bldg before bld in normalizePermitNumber to prevent partial prefix match leaving trailing "g"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing test file for new DedupCandidate interface**
- **Found during:** Task 1
- **Issue:** Existing tests in tests/scraper/dedup.test.ts constructed DedupCandidate objects without the new fields (normalizedPermitNumber, permitDate, sourceId), causing TypeScript compilation failure
- **Fix:** Updated all test DedupCandidate objects to include new fields via helper function, added tests for normalizePermitNumber and cross-source matching paths
- **Files modified:** tests/scraper/dedup.test.ts
- **Verification:** All 21 tests pass
- **Committed in:** c8d952c (part of task commit)

**2. [Rule 1 - Bug] Fixed regex ordering in normalizePermitNumber**
- **Found during:** Task 1 (test run)
- **Issue:** Regex `(bp|bld|bldg|...)` matched "bld" before "bldg", leaving trailing "g" in normalized output (e.g., "BLDG-2024-001" became "g2024001")
- **Fix:** Reordered regex alternation to `(bldg|bld|bp|...)` so longer prefix matches first
- **Files modified:** src/lib/scraper/dedup.ts
- **Verification:** normalizePermitNumber("BLDG-2024-001") correctly returns "2024001"
- **Committed in:** c8d952c (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cross-source dedup is fully integrated into the existing pipeline flow via deduplicateNewLeads()
- No additional configuration or migration required
- All existing tests pass alongside new cross-source test cases

## Self-Check: PASSED

- FOUND: src/lib/scraper/dedup.ts
- FOUND: tests/scraper/dedup.test.ts
- FOUND: .planning/phases/23-feed-performance-optimization/23-02-SUMMARY.md
- FOUND: commit c8d952c

---
*Phase: 23-feed-performance-optimization*
*Completed: 2026-03-20*
