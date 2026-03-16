---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 15-01-PLAN.md
last_updated: "2026-03-16T18:25:49.952Z"
last_activity: 2026-03-16 -- Completed Phase 15 Plan 01 (scoring engine + cursor feed)
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 16
  completed_plans: 14
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Every morning, a blue-collar business owner opens LeadForge and sees fresh, high-scoring leads personalized to their industry, specializations, and service area.
**Current focus:** Phase 15 - Scoring Engine & Lead Feed

## Current Position

Phase: 15 of 18 (Scoring Engine & Lead Feed)
Plan: 1 of 3 complete
Status: In Progress
Last activity: 2026-03-16 -- Completed Phase 15 Plan 01 (scoring engine + cursor feed)

Progress: [█████████░] 94% (v3.0: 6/12 plans)

## Performance Metrics

**Previous milestones:**
- v1.0: 6 phases, 15 plans, ~1.7 hours
- v2.0: 2 phases, 4 plans, ~0.3 hours
- v2.1: 4 phases, 8 plans, ~0.6 hours

**v3.0:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 13    | 01   | 6min     | 2     | 20    |
| 13    | 02   | 5min     | 2     | 11    |
| 14    | 01   | 5min     | 2     | 9     |
| 14    | 02   | 4min     | 2     | 6     |
| 14    | 03   | 5min     | 2     | 7     |
| 15    | 01   | 6min     | 2     | 11    |

## Accumulated Context

### Decisions

Key decisions carried forward:
- Permit upsert uses sql`excluded.column_name` for correct Drizzle conflict updates
- Geocoding returns null coords (not 0,0) when API key missing
- Org slug gets random suffix to prevent collision
- Stripe customer creation uses idempotency key per org
- Never add side-effect imports to db/index.ts or auth.ts -- caused production 500
- Resend client instantiated inside callbacks, not at module top level
- Shared nav-links.ts config consumed by both sidebar and mobile nav
- Query-time scoring (not insert-time) -- same lead scores differently per subscriber
- Expand-then-contract migration discipline -- every schema change additive with defaults/backfills
- Retained company-profiles.ts as backward-compat re-export shim to avoid breaking 30+ consumer imports
- Hand-wrote all 9 migrations to prevent drizzle-kit from interpreting table rename as drop+create
- PostGIS geometry uses mode xy with srid 4326 (x=longitude, y=latitude)
- content_hash unique index uses WHERE NOT NULL to accommodate existing leads
- All new columns nullable or defaulted for zero-disruption to existing heavy-equipment users
- [Phase 13]: Error message matching: check specific patterns (slug/taken) before generic ones (UNIQUE/already) to avoid false matches
- [Phase 13]: Atomic multi-step auth: use server actions with try/catch cleanup rather than client-side sequential API calls
- [Phase 13]: BILL-02v3 double-nested { params: { line_items } } format is correct per @better-auth/stripe plugin -- documented, not changed
- [Phase 14]: Zod v4 uses { message } not { required_error } for z.enum error parameter
- [Phase 14]: Google Places APIProvider scoped to CompanyBasics step, not wizard level, to avoid unnecessary JS loading
- [Phase 14]: Old onboarding schemas preserved for backward compat with completeOnboarding action
- [Phase 14]: Custom radio button styling (no Radix RadioGroup installed) -- styled button elements with visual radio indicators
- [Phase 14]: Circle overlay via useMapsLibrary('maps') with ref-based lifecycle for proper cleanup
- [Phase 14]: completeOnboarding uses Places-provided lat/lng first, falls back to server-side geocoding
- [Phase 14]: equipmentTypes column populated with specializations for backward compat with heavy_equipment users
- [Phase 14]: Stripe v20 moved invoice.subscription to invoice.parent.subscription_details.subscription -- helper function abstracts extraction
- [Phase 14]: Webhook returns 200 on processing errors to prevent Stripe retry loops -- errors logged for investigation
- [Phase 14]: Industry pricing falls back to generic env vars when industry-specific ones not set
- [Phase 15]: Relevance scoring uses bidirectional partial match with singular/plural stemming for specialization matching
- [Phase 15]: Cursor pagination uses lead ID ASC for stable ordering, in-memory sort by requested dimension after scoring
- [Phase 15]: CURSOR_BATCH_SIZE=50 over-fetches relative to limit=20 for meaningful scored sort results

### Pending Todos

None yet.

### Blockers/Concerns

- Custom Resend domain status unknown -- password reset emails may land in spam without SPF/DKIM
- Schema push needed: `npx drizzle-kit push` to apply leads_source_url_dedup_idx partial unique index
- Drizzle strict mode must be enabled for v3.0 migrations to prevent silent column drops
- PostGIS extension must be created manually on Neon before geometry migration runs
- Vercel Pro plan likely required for sub-daily cron scheduling (storm alerts every 30 min)

## Session Continuity

Last session: 2026-03-16T18:25:49.949Z
Stopped at: Completed 15-01-PLAN.md
Resume file: None
