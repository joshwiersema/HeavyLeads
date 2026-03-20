---
phase: 20-scoring-engine-fix
plan: 02
subsystem: scoring
tags: [scoring-engine, leads, migration, refactor]

# Dependency graph
requires:
  - phase: 20-scoring-engine-fix
    provides: "20-01 built the 5-dimension scoring engine in src/lib/scoring/"
provides:
  - "Unified scoring via scoreLeadForOrg across all query functions"
  - "Deleted legacy scoring file and ScoringInput type"
  - "Single scoring engine in src/lib/scoring/"
affects: [20-scoring-engine-fix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All lead scoring routes through scoreLeadForOrg with OrgScoringContext"
    - "enrichLead accepts optional OrgScoringContext with fallback for legacy callers"

key-files:
  created: []
  modified:
    - src/lib/leads/queries.ts
    - src/lib/leads/types.ts

key-decisions:
  - "Backward-compatible fallback in enrichLead: distance-only score (50/10) when no org context available"
  - "Build OrgScoringContext at top of getFilteredLeads/getFilteredLeadsWithCount when organizationId present"

patterns-established:
  - "Single scoring engine pattern: all scoring goes through src/lib/scoring/engine.ts scoreLeadForOrg"
  - "OrgScoringContext-first scoring: build context from org + profile tables, pass to scoring engine"

requirements-completed: [SCOR-05]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 20 Plan 02: Legacy Scoring Removal Summary

**Migrated all lead query functions to scoreLeadForOrg and deleted the legacy scoreLead system entirely**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T04:39:27Z
- **Completed:** 2026-03-20T04:43:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced all 3 scoreLead() call sites in queries.ts with scoreLeadForOrg from the new 5-dimension engine
- Deleted src/lib/leads/scoring.ts (legacy 3-dimension scorer) and its test file
- Removed ScoringInput interface from src/lib/leads/types.ts
- Single scoring engine now exists: src/lib/scoring/

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate queries.ts from legacy scoreLead to scoreLeadForOrg** - `7bb0211` (feat)
2. **Task 2: Delete legacy scoring file and update tests** - `4bb4006` (refactor)

## Files Created/Modified
- `src/lib/leads/queries.ts` - Removed scoreLead import, updated enrichLead/getFilteredLeads/getFilteredLeadsWithCount to use scoreLeadForOrg with OrgScoringContext
- `src/lib/leads/types.ts` - Removed ScoringInput interface (no longer needed)
- `src/lib/leads/scoring.ts` - DELETED (legacy scoring function)
- `tests/leads/scoring.test.ts` - DELETED (tests for removed function)

## Decisions Made
- Used backward-compatible fallback in enrichLead: when no OrgScoringContext is available, a simple distance-based score (50 within radius, 10 outside) is used instead of 0, preserving basic scoring for callers like getLeadById that may not have org context
- Both getFilteredLeads and getFilteredLeadsWithCount build OrgScoringContext from organizationId when available, scoring 0 when not (graceful degradation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Single scoring engine established in src/lib/scoring/
- All query functions use the new 5-dimension scoring system
- Ready for 20-03 (if applicable) or next phase

## Self-Check: PASSED

- FOUND: src/lib/leads/queries.ts
- FOUND: src/lib/leads/types.ts
- CONFIRMED DELETED: src/lib/leads/scoring.ts
- CONFIRMED DELETED: tests/leads/scoring.test.ts
- FOUND: commit 7bb0211
- FOUND: commit 4bb4006

---
*Phase: 20-scoring-engine-fix*
*Completed: 2026-03-20*
