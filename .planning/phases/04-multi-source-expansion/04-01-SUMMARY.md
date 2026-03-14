---
phase: 04-multi-source-expansion
plan: 01
subsystem: scraper, database
tags: [zod, drizzle, scraper-adapter, multi-source, lead-sources, pipeline]

# Dependency graph
requires:
  - phase: 02-scraping-pipeline
    provides: ScraperAdapter interface, pipeline orchestrator, leads table, 3 permit adapters
provides:
  - Generalized RawLeadData schema supporting permit/bid/news/deep-web source types
  - ScraperAdapter interface with sourceType and optional jurisdiction
  - lead_sources junction table for multi-source tracking
  - Pipeline that processes generalized records and creates source entries
  - Backward-compatible rawPermitSchema and RawPermitData aliases
affects: [04-02-PLAN, 04-03-PLAN, lead-detail, deduplication]

# Tech tracking
tech-stack:
  added: []
  patterns: [source-agnostic adapter interface, lead_sources junction table, dual insert path (permit upsert vs non-permit select-then-insert)]

key-files:
  created:
    - src/lib/db/schema/lead-sources.ts
    - tests/scraper/lead-validation.test.ts
  modified:
    - src/lib/scraper/adapters/base-adapter.ts
    - src/lib/scraper/pipeline.ts
    - src/lib/scraper/types.ts
    - src/lib/db/schema/leads.ts
    - src/lib/db/schema/index.ts
    - src/lib/scraper/adapters/austin-permits.ts
    - src/lib/scraper/adapters/dallas-permits.ts
    - src/lib/scraper/adapters/atlanta-permits.ts
    - tests/helpers/scraper.ts
    - tests/scraper/pipeline.test.ts
    - tests/scraper/validation.test.ts
    - tests/scraper/adapters.test.ts

key-decisions:
  - "rawLeadSchema uses .refine() to enforce at least one identity field (permitNumber/title/externalId) rather than discriminated union"
  - "Permit records use onConflictDoUpdate upsert; non-permit records use select-then-insert pattern to avoid complex multi-column conflict targets"
  - "rawPermitSchema kept as alias (not separate schema) for zero-cost backward compatibility"
  - "Pipeline processes records one-at-a-time for non-permit path (allows per-record select check) vs batch for permit path"

patterns-established:
  - "Source-agnostic adapter: all adapters return RawLeadData[] with sourceType field"
  - "Lead source tracking: every pipeline insert also creates a lead_sources entry"
  - "Dual geocoding strategy: prefer address, fall back to city+state"

requirements-completed: [DATA-06]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 4 Plan 01: Generalize Scraper Infrastructure Summary

**Source-agnostic RawLeadData schema with lead_sources junction table, generalized pipeline, and backward-compatible adapter interface**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T18:55:38Z
- **Completed:** 2026-03-14T19:02:25Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Generalized ScraperAdapter interface from permit-only to supporting permit, bid, news, and deep-web source types
- Created lead_sources junction table for tracking which data sources contributed to each lead record
- Updated pipeline to handle dual insert paths (permit upsert + non-permit select-then-insert) and create source entries
- Maintained full backward compatibility via rawPermitSchema and RawPermitData aliases
- All 60 existing scraper tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize types, DB schema, and validation** (TDD)
   - `3089b5c` (test) - Failing tests for generalized RawLeadData schema
   - `3a45348` (feat) - Generalize types, DB schema, and validation for multi-source leads
2. **Task 2: Update pipeline, existing adapters, and test infrastructure** - `dfa4168` (feat)

## Files Created/Modified
- `src/lib/scraper/adapters/base-adapter.ts` - Generalized rawLeadSchema, ScraperAdapter with sourceType and optional jurisdiction
- `src/lib/db/schema/lead-sources.ts` - New lead_sources junction table for multi-source tracking
- `src/lib/db/schema/leads.ts` - Added sourceType, title, city, state, contractorName, agencyName; nullable permitNumber/address
- `src/lib/db/schema/index.ts` - Exports leadSources
- `src/lib/scraper/types.ts` - Added newLeadIds to PipelineResult
- `src/lib/scraper/pipeline.ts` - Generalized processing, dual insert paths, lead_sources creation
- `src/lib/scraper/adapters/austin-permits.ts` - Added sourceType="permit" to adapter and records
- `src/lib/scraper/adapters/dallas-permits.ts` - Added sourceType="permit" to adapter and records
- `src/lib/scraper/adapters/atlanta-permits.ts` - Added sourceType="permit" to adapter and records
- `tests/helpers/scraper.ts` - createMockLeadData helper, sourceType on mock adapters
- `tests/scraper/lead-validation.test.ts` - 14 tests for generalized schema validation
- `tests/scraper/pipeline.test.ts` - Updated mocks, added non-permit and newLeadIds tests
- `tests/scraper/validation.test.ts` - Updated for required sourceType field
- `tests/scraper/adapters.test.ts` - Fixed pluggability test for sourceType requirement

## Decisions Made
- rawLeadSchema uses Zod .refine() to enforce at least one identity field (permitNumber, title, or externalId) rather than using a discriminated union -- simpler to maintain and validate
- Permit records use onConflictDoUpdate upsert on (sourceId, permitNumber); non-permit records use select-then-insert pattern to avoid complex multi-column conflict targets
- rawPermitSchema is an alias (not a separate schema) for zero-cost backward compatibility
- Pipeline processes non-permit records individually (select-check-then-insert) to handle dedup without complex SQL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lead detail page nullable address type error**
- **Found during:** Task 2
- **Issue:** Making `address` nullable in the leads table caused a TypeScript error in the lead detail page map component
- **Fix:** Added fallback string "Unknown location" when address is null
- **Files modified:** src/app/(dashboard)/dashboard/leads/[id]/page.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** dfa4168

**2. [Rule 1 - Bug] Fixed adapters.test.ts pluggability test missing sourceType**
- **Found during:** Task 2
- **Issue:** Custom adapter in pluggability test lacked the new required `sourceType` field
- **Fix:** Added `sourceType: "permit"` to custom adapter definition
- **Files modified:** tests/scraper/adapters.test.ts
- **Verification:** npx vitest run tests/scraper/adapters.test.ts passes
- **Committed in:** dfa4168

**3. [Rule 1 - Bug] Updated existing validation tests for required sourceType**
- **Found during:** Task 2
- **Issue:** Existing validation.test.ts tests didn't include `sourceType` which is now required in the generalized schema
- **Fix:** Added `sourceType: "permit"` to all test data, updated test descriptions to reflect new contract
- **Files modified:** tests/scraper/validation.test.ts
- **Verification:** npx vitest run tests/scraper/validation.test.ts passes
- **Committed in:** dfa4168

---

**Total deviations:** 3 auto-fixed (3 bugs from schema change ripple effects)
**Impact on plan:** All auto-fixes were necessary consequences of the generalization. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ScraperAdapter interface ready for SAM.gov, RSS news, and Google dorking adapters (Plan 04-02)
- lead_sources table ready for cross-source deduplication engine (Plan 04-03)
- Pipeline's newLeadIds tracking enables efficient post-pipeline dedup (Plan 04-03)
- Existing permit adapters verified working with generalized interface

## Self-Check: PASSED

All 14 claimed files verified present. All 3 commit hashes verified in git log.

---
*Phase: 04-multi-source-expansion*
*Completed: 2026-03-14*
