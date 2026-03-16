---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Bug Fixes & Hardening
status: roadmap_complete
stopped_at: Roadmap created with 4 phases (9-12)
last_updated: "2026-03-15"
last_activity: 2026-03-15 -- Roadmap created for v2.1
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed.
**Current focus:** Phase 9 - Regression Test Safety Net

## Current Position

Phase: 9 of 12 (Regression Test Safety Net)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-15 -- Roadmap created for v2.1 Bug Fixes & Hardening

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 19 (15 v1.0 + 4 v2.0)
- Average duration: ~6.3 min
- Total execution time: ~1.99 hours

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

### Pending Todos

None yet.

### Blockers/Concerns

- FETCH_MULTIPLIER pagination interaction needs careful implementation (in-memory pagination, not SQL offset)
- Bookmarks batch query must extract enrichLead() before batching to preserve lead card data
- Custom Resend domain status unknown -- password reset emails may land in spam without SPF/DKIM

## Session Continuity

Last session: 2026-03-15
Stopped at: Roadmap created for v2.1 -- ready to plan Phase 9
Resume file: None
