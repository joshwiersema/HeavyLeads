---
phase: 09-regression-test-safety-net
plan: 01
subsystem: testing
tags: [vitest, drizzle-orm, pipeline, mocking, test-infrastructure]

# Dependency graph
requires: []
provides:
  - "npm run test command executing vitest"
  - "tests/regressions/ directory for 15 regression test files"
  - "Green test suite (285 passing, 0 failing)"
  - "Fixed pipeline test mocks with sql tagged template and unique returning IDs"
affects: [09-02, 09-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle-orm sql mock: tagged template function returning { type, strings, values }"
    - "Unique mock IDs via closure counter in vi.mock factory"

key-files:
  created:
    - tests/regressions/.gitkeep
  modified:
    - package.json
    - tests/scraper/pipeline.test.ts

key-decisions:
  - "Added sql tagged template mock to drizzle-orm -- root cause of 6 failures was missing sql export, not just duplicate IDs"
  - "Used closure counter for unique returning() IDs instead of crypto.randomUUID() -- simpler, deterministic"

patterns-established:
  - "drizzle-orm mock must include sql as tagged template function when pipeline code uses sql`excluded.*`"
  - "Mock returning() implementations should use counters for unique IDs when test assertions depend on ID uniqueness"

requirements-completed: [TEST-02]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 9 Plan 01: Test Infrastructure Setup Summary

**Green test suite with npm run test, fixed 6 pipeline test failures via sql mock and unique returning IDs, created regressions directory**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T04:24:40Z
- **Completed:** 2026-03-16T04:28:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `"test": "vitest run"` script to package.json -- `npm run test` now executes the full Vitest suite
- Fixed all 6 failing pipeline tests by adding missing `sql` tagged template mock to drizzle-orm and making `returning()` yield unique IDs per call
- Created `tests/regressions/` directory ready for Plans 02 and 03 to populate with 15 regression test files
- Full suite: 285 tests passing, 0 failing (previously 279 passing, 6 failing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add npm test script and create regressions directory** - `b1359c3` (chore)
2. **Task 2: Fix 6 failing pipeline dedup tests** - `e52f612` (fix)

## Files Created/Modified
- `package.json` - Added "test": "vitest run" script entry
- `tests/regressions/.gitkeep` - Empty placeholder for regression test directory
- `tests/scraper/pipeline.test.ts` - Fixed drizzle-orm mock (added sql), fixed returning() to yield unique IDs via counter

## Decisions Made
- **Root cause was missing sql mock, not just duplicate IDs:** The plan identified the 6 failures as caused by mock `returning()` yielding the same ID. Investigation revealed the actual root cause was that `sql` was not exported from the `drizzle-orm` mock, causing permit record processing to throw errors caught by the pipeline's try-catch. This meant adapters reported 0 records scraped/stored, so `allNewLeadIds` was empty and dedup was never called. Both the missing `sql` mock and the duplicate-ID issue needed fixing.
- **Used closure counter instead of crypto.randomUUID():** A simple `let leadIdCounter = 0` inside the `vi.mock` factory provides deterministic, unique IDs without depending on crypto APIs. The counter persists across tests (not reset by `vi.clearAllMocks()`) which is fine since uniqueness is the only requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing sql tagged template to drizzle-orm mock**
- **Found during:** Task 2 (Fix 6 failing pipeline dedup tests)
- **Issue:** The plan identified the failure cause as mock `returning()` yielding the same ID. The actual root cause was deeper: `sql` was not exported from the `drizzle-orm` mock at all, causing `sql\`excluded.description\`` to throw "[vitest] No 'sql' export is defined on the 'drizzle-orm' mock". This error was caught by the pipeline's try-catch, masking the real problem.
- **Fix:** Added `sql: (strings, ...values) => ({ type: "sql", strings: Array.from(strings), values })` to the drizzle-orm mock factory
- **Files modified:** tests/scraper/pipeline.test.ts
- **Verification:** All 12 pipeline tests pass; full suite 285/285 passing
- **Committed in:** e52f612 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The sql mock addition was necessary for correctness -- without it, the plan's prescribed fix (unique returning IDs) alone would not have resolved the failures. No scope creep; change is test-only.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `npm run test` works and suite is fully green (285 passing)
- `tests/regressions/` directory exists and is ready for Plans 02 and 03 to populate with 15 regression test files
- Pipeline test mocks now correctly handle sql tagged templates, enabling regression tests that exercise permit upsert paths
- Zero production source files modified

## Self-Check: PASSED

All files exist and all commits verified.

---
*Phase: 09-regression-test-safety-net*
*Completed: 2026-03-15*
