---
phase: 15-scoring-engine-and-lead-feed
plan: 01
subsystem: api
tags: [scoring, haversine, cursor-pagination, lead-feed, drizzle]

# Dependency graph
requires:
  - phase: 14-industry-onboarding
    provides: organizationProfiles with specializations, serviceTypes, targetProjectValue, hqLat/hqLng
provides:
  - 5-dimension scoring engine (distance, relevance, value, freshness, urgency)
  - OrgScoringContext builder from org + profile tables
  - Cursor-based lead feed with per-org scoring
  - Single lead scoring for detail page
  - ScoredLead type with ScoringResult
affects: [15-02 lead-feed-ui, 15-03 lead-detail-scoring, 16-alert-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-scoring, cursor-pagination, dimension-based-scoring]

key-files:
  created:
    - src/lib/scoring/types.ts
    - src/lib/scoring/distance.ts
    - src/lib/scoring/relevance.ts
    - src/lib/scoring/value.ts
    - src/lib/scoring/freshness.ts
    - src/lib/scoring/urgency.ts
    - src/lib/scoring/engine.ts
    - src/lib/scoring/index.ts
    - tests/scoring/engine.test.ts
  modified:
    - src/lib/leads/types.ts
    - src/lib/leads/queries.ts

key-decisions:
  - "Relevance matching uses bidirectional partial match with singular/plural stemming to handle 'Heat Pumps' vs 'Heat Pump Installation'"
  - "Cursor pagination uses lead ID ASC for stable ordering, then sorts scored batch in-memory by requested dimension"
  - "CURSOR_BATCH_SIZE=50 fetches more than limit (default 20) so sorting produces meaningful results"
  - "buildOrgScoringContext reusable function queries org + profile tables independently for scoring"
  - "preferredLeadTypes mapped from profile.serviceTypes (onboarding stores these as service types)"

patterns-established:
  - "Pure function scoring: each dimension is a standalone function returning ScoreDimension with score, maxScore, and reasons"
  - "Match reasons: every scoring decision produces human-readable strings for UI display"
  - "Cursor-based pagination: cursor is lead ID, stable across page loads, no offset drift"

requirements-completed: [SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05, SCOR-06, SCOR-07, FEED-03]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 15 Plan 01: Scoring Engine & Lead Feed Summary

**5-dimension scoring engine (distance/relevance/value/freshness/urgency) with per-org match reasons and cursor-based lead feed query**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T18:18:33Z
- **Completed:** 2026-03-16T18:24:17Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- 5-dimension scoring engine producing 0-100 scores with human-readable match reasons across distance, relevance, value, freshness, and urgency
- Same lead produces different scores for different org contexts (industry, location, specializations)
- Cursor-based lead feed query with 10 filter params, 4 sort modes, per-org scoring, and stable pagination
- 35 unit tests covering all scoring tiers, boundary conditions, and cross-org differentiation

## Task Commits

Each task was committed atomically:

1. **Task 1: Build 5-dimension scoring engine** - `8fb2db3` (test: failing tests), `9c9d8c0` (feat: implementation)
2. **Task 2: Cursor-based lead feed query** - `74b8a2a` (feat: cursor pagination + scored queries)

_Note: Task 1 used TDD (RED -> GREEN commits)_

## Files Created/Modified
- `src/lib/scoring/types.ts` - OrgScoringContext, LeadScoringInput, ScoreDimension, ScoringResult types
- `src/lib/scoring/distance.ts` - 6-tier geographic proximity scorer (25 pts max)
- `src/lib/scoring/relevance.ts` - Specialization, industry, cross-industry, preferred source scorer (30 pts max)
- `src/lib/scoring/value.ts` - Target range matching scorer (20 pts max)
- `src/lib/scoring/freshness.ts` - Time-decay scorer from today to 30+ days (15 pts max)
- `src/lib/scoring/urgency.ts` - Highest-signal urgency scorer for storm/bid/violation/permit/incentive (10 pts max)
- `src/lib/scoring/engine.ts` - Orchestrator: calls all 5 dimensions, clamps 0-100, collects match reasons
- `src/lib/scoring/index.ts` - Re-exports scoreLeadForOrg and types
- `tests/scoring/engine.test.ts` - 35 unit tests covering all dimensions and edge cases
- `src/lib/leads/types.ts` - Added ScoredLead interface with ScoringResult
- `src/lib/leads/queries.ts` - Added getFilteredLeadsCursor, getLeadByIdScored, buildOrgScoringContext

## Decisions Made
- Relevance matching uses bidirectional partial match with singular/plural stemming -- handles "Heat Pumps" specialization matching "Heat Pump Installation" project type
- Cursor pagination uses lead ID ASC for stable ordering, then sorts the scored batch in-memory by requested dimension (score/distance/value/date)
- CURSOR_BATCH_SIZE=50 over-fetches relative to default limit=20 so in-memory sorting produces meaningful top-N results
- buildOrgScoringContext queries org table for industry + profile table for scoring params, returns null gracefully if either missing
- preferredLeadTypes populated from profile.serviceTypes since onboarding stores lead type preferences there

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed singular/plural mismatch in relevance scoring**
- **Found during:** Task 1 (scoring engine tests)
- **Issue:** "Heat Pumps" specialization did not match "Heat Pump Installation" project type because "heat pump installation".includes("heat pumps") is false (trailing 's')
- **Fix:** Added bidirectional partial matching with singular/plural stemming (strip trailing 's' and check both directions)
- **Files modified:** src/lib/scoring/relevance.ts
- **Verification:** All 35 tests pass including specialization match test
- **Committed in:** 9c9d8c0 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correct specialization matching across all industries. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test files (bookmarks, lead-status, pagination, saved-searches) from vitest mock type changes -- not related to this plan's changes, out of scope per deviation rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scoring engine ready for consumption by lead feed UI (Plan 02)
- getLeadByIdScored ready for lead detail page scoring breakdown (Plan 03)
- All existing query functions preserved for backward compatibility

## Self-Check: PASSED

All 11 created/modified files verified present. All 3 task commits verified in git log.

---
*Phase: 15-scoring-engine-and-lead-feed*
*Completed: 2026-03-16*
