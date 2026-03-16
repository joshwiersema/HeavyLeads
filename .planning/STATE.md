---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Bug Fixes & Hardening
status: defining_requirements
stopped_at: Milestone initialized
last_updated: "2026-03-15"
last_activity: 2026-03-15 -- Milestone v2.1 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed.
**Current focus:** Defining requirements for v2.1 Bug Fixes & Hardening

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-15 — Milestone v2.1 started

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
- Landing page uses styled Links (not Link>Button nesting) for valid HTML
- Never add side-effect imports to db/index.ts or auth.ts — caused production 500
- better-auth stripe plugin expects { params: { line_items } } format (confirmed from source)

### Pending Todos

None yet.

### Blockers/Concerns

- nextstepjs React 19 compatibility unverified (from v2.0 Phase 10 — not in this milestone)
- Vercel function timeout risk for 8 sequential scraper adapters

## Session Continuity

Last session: 2026-03-15
Stopped at: Milestone v2.1 initialized
Resume file: None
