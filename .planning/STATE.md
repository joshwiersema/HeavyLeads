---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Bug Fixes & Hardening
status: in-progress
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-03-16T05:08:38Z"
last_activity: 2026-03-16 -- Completed 10-02 digest optimization & sourceUrl dedup (Phase 10 complete)
progress:
  total_phases: 12
  completed_phases: 10
  total_plans: 24
  completed_plans: 24
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed.
**Current focus:** Phase 10 - Query Optimizations

## Current Position

Phase: 10 of 12 (Query Optimizations)
Plan: 2 of 2 complete
Status: Phase 10 Complete
Last activity: 2026-03-16 -- Completed 10-02 digest optimization & sourceUrl dedup (Phase 10 complete)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (15 v1.0 + 4 v2.0 + 3 v2.1)
- Average duration: ~5.8 min
- Total execution time: ~2.18 hours

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 09    | 01   | 3min     | 2     | 3     |
| 09    | 02   | 4min     | 2     | 9     |
| 09    | 03   | 4min     | 2     | 6     |
| 10    | 01   | 7min     | 2     | 7     |
| 10    | 02   | 7min     | 2     | 6     |

## Accumulated Context

### Decisions

Key decisions from v2.0 post-rework:
- Permit upsert uses sql`excluded.column_name` for correct Drizzle conflict updates
- Geocoding returns null coords (not 0,0) when API key missing; callers check for null
- Lead query uses FETCH_MULTIPLIER = 4 to over-fetch before in-memory scoring
- Org slug gets random suffix to prevent collision
- Sign-in wraps org fetch in try-catch; empty orgs route to onboarding
- Stripe customer creation uses idempotency key per org
- Onboarding uses onConflictDoUpdate for double-submit safety
- Never add side-effect imports to db/index.ts or auth.ts -- caused production 500

v2.1 roadmap decisions:
- Tests first, then production changes (safety net principle)
- Phases 11 and 12 depend only on Phase 9 (not on Phase 10), enabling parallel execution
- Email verification deferred to future -- ship forgot password first as recovery path

v2.1 Phase 9 decisions:
- drizzle-orm mock must include sql as tagged template function when testing pipeline code that uses sql`excluded.*`
- Used closure counter for unique mock returning() IDs -- simpler and deterministic vs crypto.randomUUID()
- vi.fn() handle pattern before vi.mock enables assertion on onConflictDoUpdate arguments (set/target)
- Geocoding null test uses real function with deleted env var -- tests actual behavior, not mock behavior
- Non-exported functions (slugify, Array.isArray guard, sort) tested as inline pattern replication
- Server component (page.tsx) tested by calling async function directly and rendering result -- avoids next/headers jsdom issues
- Base-UI primitives (merge-props, use-render, separator) mocked for jsdom -- avoids DOM API incompatibilities
- afterEach(cleanup) required in all component test describe blocks to prevent DOM leakage

v2.1 Phase 10 decisions:
- Widest-filter envelope for digest: max radius, earliest dateFrom, null dateTo = no upper bound, smallest minProjectSize, largest maxProjectSize (null = Infinity)
- Raw sql template literal for partial index WHERE clause (workaround for Drizzle Kit bug #4790)
- onConflictDoNothing with SELECT fallback for non-permit sourceUrl dedup
- limit: 500 for widest digest query to capture sufficient candidates for in-memory filtering
- FETCH_MULTIPLIER pagination resolved: enrichLead extracted for single-lead enrichment, getFilteredLeadsWithCount for server-side count
- getFilteredLeadsWithCount fetches all within-radius leads (no FETCH_MULTIPLIER) for accurate totalCount
- Filter changes reset page to 1 via buildParams deleting page param
- getLeadsByIds batch query replaces N+1 getLeadById pattern on bookmarks page

### Pending Todos

None yet.

### Blockers/Concerns

- ~~FETCH_MULTIPLIER pagination interaction needs careful implementation~~ (RESOLVED in 10-01: getFilteredLeadsWithCount provides server-side count)
- ~~Bookmarks batch query must extract enrichLead() before batching~~ (RESOLVED in 10-01: enrichLead extracted, getLeadsByIds uses batch query)
- Custom Resend domain status unknown -- password reset emails may land in spam without SPF/DKIM
- Schema push needed: `npx drizzle-kit push` to apply leads_source_url_dedup_idx partial unique index

## Session Continuity

Last session: 2026-03-16
Stopped at: Completed 10-02-PLAN.md (Phase 10 complete)
Resume file: None
