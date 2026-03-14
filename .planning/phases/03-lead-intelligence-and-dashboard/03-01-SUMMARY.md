---
phase: 03-lead-intelligence-and-dashboard
plan: 01
subsystem: api
tags: [haversine, scoring, inference, drizzle, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-platform-foundation
    provides: "EQUIPMENT_TYPES taxonomy, company_profiles schema with hqLat/hqLng/serviceRadiusMiles/equipmentTypes"
  - phase: 02-scraping-pipeline
    provides: "leads table with lat/lng, projectType, description, estimatedValue, scrapedAt"
provides:
  - "inferEquipmentNeeds: rule-based project type/description to equipment category mapping"
  - "scoreLead: 0-100 weighted relevance score (equipment 50%, geo 30%, value 20%)"
  - "mapTimeline: project phase detection with urgency windows (Now/Soon/Later)"
  - "getFreshnessBadge: age-based lead freshness indicator (New/This Week/Older)"
  - "getFilteredLeads: Haversine geo-filtered, enriched lead feed query"
  - "getLeadById: single enriched lead query with optional scoring context"
  - "haversineDistance: pure helper for great-circle distance calculation"
  - "filterByEquipment: post-query equipment type filter"
affects: [03-02-PLAN, 03-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure function business logic in src/lib/leads/", "Query-time enrichment pipeline", "Haversine SQL with LEAST/GREATEST float clamp", "TDD with extracted pure helpers for DB-dependent modules"]

key-files:
  created:
    - src/lib/leads/types.ts
    - src/lib/leads/equipment-inference.ts
    - src/lib/leads/scoring.ts
    - src/lib/leads/timeline.ts
    - src/lib/leads/queries.ts
    - tests/helpers/leads.ts
    - tests/leads/equipment-inference.test.ts
    - tests/leads/scoring.test.ts
    - tests/leads/timeline.test.ts
    - tests/leads/freshness.test.ts
    - tests/leads/geo-filter.test.ts
    - tests/leads/filtering.test.ts
  modified: []

key-decisions:
  - "Equipment inference uses substring keyword matching against both projectType and description with confidence tiers (high/medium/low)"
  - "Haversine pure helper exported from queries.ts for testability and single-lead distance calculation"
  - "Equipment filtering extracted as pure filterByEquipment function for unit testing without DB mocking"
  - "Timeline mapping reuses INFERENCE_RULES from equipment-inference.ts to keep phase detection DRY"

patterns-established:
  - "Lead enrichment pipeline: raw DB rows -> inferEquipmentNeeds -> scoreLead -> getFreshnessBadge -> mapTimeline -> EnrichedLead"
  - "Extract testable pure functions from DB-dependent modules (haversineDistance, filterByEquipment)"
  - "Confidence-based deduplication: when multiple rules infer the same equipment, keep highest confidence"

requirements-completed: [LEAD-01, LEAD-02, LEAD-03, LEAD-05, LEAD-06, UX-05]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 3 Plan 1: Lead Intelligence Core Summary

**Rule-based equipment inference engine, weighted lead scoring (equipment 50%/geo 30%/value 20%), timeline urgency mapping, and Haversine geo-filtered Drizzle query module with 53 passing tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T18:10:59Z
- **Completed:** 2026-03-14T18:16:14Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Equipment inference engine with 10 keyword-based rules covering excavation, foundation, framing, roofing, interior, paving, landscaping, commercial, residential, and generator categories plus General Construction fallback
- Lead scoring algorithm producing 0-100 integer scores with correct weight distribution verified by boundary-value tests
- Timeline mapping detecting construction phases from keywords and assigning Now/Soon/Later urgency windows
- Haversine geo-filtered query module with NULL coordinate guards, LEAST/GREATEST float clamp, and post-query equipment filtering
- 53 tests across 6 test files all passing with TypeScript compiling clean

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Types and failing tests** - `098164c` (test)
2. **Task 1 GREEN: Equipment inference, scoring, timeline** - `d96a9fc` (feat)
3. **Task 2 RED: Geo-filter and filtering tests** - `d566f61` (test)
4. **Task 2 GREEN: Queries module implementation** - `22515b6` (feat)

_TDD tasks committed as separate RED/GREEN phases_

## Files Created/Modified
- `src/lib/leads/types.ts` - Shared types (InferredEquipment, ScoringInput, TimelineWindow, FreshnessBadge, EnrichedLead) and getFreshnessBadge utility
- `src/lib/leads/equipment-inference.ts` - 10 inference rules + inferEquipmentNeeds with confidence tiers and deduplication
- `src/lib/leads/scoring.ts` - scoreLead with equipment match (50pts), geo proximity (30pts), project value (20pts)
- `src/lib/leads/timeline.ts` - mapTimeline with PHASE_TIMELINE urgency mapping, reuses INFERENCE_RULES
- `src/lib/leads/queries.ts` - getFilteredLeads (Haversine SQL, enrichment pipeline, equipment post-filter), getLeadById, haversineDistance helper, filterByEquipment helper
- `tests/helpers/leads.ts` - createMockLead and createMockCompanyProfile factory functions
- `tests/leads/equipment-inference.test.ts` - 11 tests covering keyword matching, confidence, fallback, deduplication
- `tests/leads/scoring.test.ts` - 12 tests covering weight distribution, boundaries, integer output
- `tests/leads/timeline.test.ts` - 9 tests covering phase detection, urgency, multi-phase, empty results
- `tests/leads/freshness.test.ts` - 7 tests covering New/This Week/Older badge logic
- `tests/leads/geo-filter.test.ts` - 8 tests covering Haversine distance, radius boundary, same-location
- `tests/leads/filtering.test.ts` - 6 tests covering show-all default, single/multi-type filter, no-match

## Decisions Made
- Equipment inference uses substring keyword matching (not exact) against both projectType and description for maximum coverage of varied municipal permit taxonomies
- Haversine pure helper exported from queries.ts rather than a separate utils file, keeping distance calculation co-located with the query that uses it
- Equipment filtering extracted as a pure function (filterByEquipment) rather than tested through DB mocking, making tests fast and deterministic
- Timeline mapping reuses INFERENCE_RULES from equipment-inference.ts to avoid duplicating keyword lists, keeping phase detection and equipment inference consistent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Haversine distance test expectations**
- **Found during:** Task 2 (geo-filter tests)
- **Issue:** Test expected Austin-Dallas distance ~195 miles and Austin-NYC ~1638 miles, but Haversine computes 182 and 1511 respectively for the given coordinates
- **Fix:** Updated test expectations to match actual Haversine output (182mi Austin-Dallas, 1511mi Austin-NYC)
- **Files modified:** tests/leads/geo-filter.test.ts
- **Verification:** All 8 geo-filter tests pass
- **Committed in:** 22515b6 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test expectations)
**Impact on plan:** Minor test data correction. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All pure functions and query utilities ready for consumption by Plan 02 (dashboard feed) and Plan 03 (lead detail view)
- EnrichedLead type provides the complete data contract for UI rendering
- getFilteredLeads accepts all parameters needed for dashboard filter state
- getLeadById ready for lead detail page with optional scoring context

## Self-Check: PASSED

- All 12 created files exist on disk
- All 4 task commits verified in git log (098164c, d96a9fc, d566f61, 22515b6)
- 53/53 tests passing across 6 test files
- TypeScript compiles with zero errors

---
*Phase: 03-lead-intelligence-and-dashboard*
*Completed: 2026-03-14*
