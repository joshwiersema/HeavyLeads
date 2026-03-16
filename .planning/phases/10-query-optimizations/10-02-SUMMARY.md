---
phase: 10-query-optimizations
plan: 02
subsystem: database, api
tags: [drizzle, postgres, digest, dedup, partial-index, in-memory-filtering]

# Dependency graph
requires:
  - phase: 09-regression-tests
    provides: Test safety net for scraper pipeline and email digest
provides:
  - Widest-filter single-query digest generation (O(1) per user instead of O(saved_searches))
  - Partial unique index for non-permit sourceUrl deduplication
  - Pipeline onConflictDoNothing dedup for non-permit records with sourceUrl
affects: [email-digests, scraper-pipeline, lead-schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widest-filter envelope pattern: compute broadest params across N searches, single SQL query, per-search in-memory filtering"
    - "Partial unique index with raw sql template literal WHERE clause (workaround for Drizzle Kit bug #4790)"
    - "onConflictDoNothing with SELECT fallback for conflict-aware dedup"

key-files:
  created:
    - tests/email/digest-optimization.test.ts
    - tests/scraper/source-url-dedup.test.ts
  modified:
    - src/lib/email/digest-generator.ts
    - src/lib/db/schema/leads.ts
    - src/lib/scraper/pipeline.ts
    - tests/email/digest.test.ts

key-decisions:
  - "Widest-filter envelope approach: max radius, earliest dateFrom, null dateTo = no upper bound, smallest minProjectSize, largest maxProjectSize (null = Infinity)"
  - "In-memory per-search filtering uses applyInMemoryFilters + filterByEquipment + distance check for each saved search"
  - "Raw sql template literal for partial index WHERE clause to avoid Drizzle Kit bug #4790 parameterized placeholder issue"
  - "onConflictDoNothing with SELECT fallback for non-permit sourceUrl dedup to maintain lead_sources tracking"

patterns-established:
  - "Widest-filter pattern: when multiple filter sets share a common query, compute the broadest envelope, query once, filter per-set in memory"
  - "Partial unique index pattern: use .where(sql`...`) with raw SQL for Drizzle DDL WHERE clauses"

requirements-completed: [PERF-03, PERF-04]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 10 Plan 02: Digest Optimization & Source URL Dedup Summary

**Widest-filter single-query digest generation with partial unique index for non-permit sourceUrl deduplication**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T05:01:27Z
- **Completed:** 2026-03-16T05:08:38Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Digest generator now calls getFilteredLeads exactly once per user (was O(saved_searches))
- Per-search filters applied in memory via applyInMemoryFilters and filterByEquipment with distance check
- Partial unique index "leads_source_url_dedup_idx" prevents future non-permit duplicates by sourceUrl
- Pipeline uses onConflictDoNothing for non-permit records with sourceUrl, title-based fallback without
- 13 new tests across 2 test files, all 384 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Optimize digest generator (RED)** - `ddbe27f` (test)
2. **Task 1: Optimize digest generator (GREEN)** - `525e238` (feat)
3. **Task 2: Add sourceUrl dedup index and pipeline (RED)** - `f031a45` (test)
4. **Task 2: Add sourceUrl dedup index and pipeline (GREEN)** - `da137c9` (feat)

_Note: TDD tasks have separate RED/GREEN commits_

## Files Created/Modified
- `src/lib/email/digest-generator.ts` - Refactored to widest-filter single query with in-memory per-search filtering
- `src/lib/db/schema/leads.ts` - Added partial unique index leads_source_url_dedup_idx on (sourceId, sourceUrl)
- `src/lib/scraper/pipeline.ts` - Non-permit insert uses onConflictDoNothing with sourceUrl, title-based fallback
- `tests/email/digest-optimization.test.ts` - 8 tests for single-query optimization, widest params, dedup
- `tests/scraper/source-url-dedup.test.ts` - 5 tests for schema index, pipeline dedup paths
- `tests/email/digest.test.ts` - Updated mock to include applyInMemoryFilters and filterByEquipment

## Decisions Made
- Used widest-filter envelope pattern: max radius, earliest dateFrom, null dateTo treated as no upper bound, min of minProjectSize, max of maxProjectSize (null = Infinity for max, 0 for min)
- Raw sql template literal for partial index WHERE clause instead of ne()/and() operators (Drizzle Kit bug #4790)
- onConflictDoNothing with SELECT fallback preserves lead_sources tracking when duplicate detected
- limit: 500 for widest query to capture sufficient candidates for in-memory filtering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing digest.test.ts mock for new imports**
- **Found during:** Task 1 (digest generator optimization)
- **Issue:** Existing digest.test.ts mocked only getFilteredLeads but refactored code now imports applyInMemoryFilters and filterByEquipment
- **Fix:** Added applyInMemoryFilters and filterByEquipment to the @/lib/leads/queries mock
- **Files modified:** tests/email/digest.test.ts
- **Verification:** All 6 existing digest tests pass
- **Committed in:** 525e238 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to prevent regression in existing test suite. No scope creep.

## Issues Encountered
- Next.js 16 Turbopack build has intermittent ENOENT errors for build manifests -- pre-existing infrastructure issue, not related to code changes. TypeScript compilation succeeds.

## User Setup Required

Schema push required: `npx drizzle-kit push` to apply the partial unique index to production database. If existing duplicates cause the index creation to fail, use `npx drizzle-kit push --force` (forward-only dedup, no retroactive cleanup per plan scope).

## Next Phase Readiness
- Query optimizations complete (pagination in 10-01, digest + dedup in 10-02)
- Ready for Phase 11 (Forgot Password) and Phase 12 (Admin Dashboard) which depend on Phase 9

## Self-Check: PASSED

All 5 created/modified source files verified present. All 4 task commits (ddbe27f, 525e238, f031a45, da137c9) verified in git log. Full test suite: 384 passed, 0 failed.

---
*Phase: 10-query-optimizations*
*Completed: 2026-03-16*
