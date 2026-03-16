---
phase: 15-scoring-engine-and-lead-feed
plan: 03
subsystem: ui
tags: [lead-detail, scoring-breakdown, enrichment, dual-marker-map, similar-leads, tailwind]

# Dependency graph
requires:
  - phase: 15-scoring-engine-and-lead-feed
    provides: getLeadByIdScored, ScoredLead, ScoringResult types, 5-dimension scoring engine
  - phase: 14-industry-onboarding
    provides: organizationProfiles with hqLat/hqLng/serviceRadiusMiles, Circle overlay pattern
provides:
  - Rewritten lead detail page with per-org 5-dimension score breakdown
  - Enrichment data display (weather, property, incentives) with graceful empty state
  - Dual-marker map with HQ + lead markers and service radius circle overlay
  - Similar leads discovery section (nearby leads within 25mi)
affects: [16-enrichment-scrapers, lead-detail-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-marker-map-with-radius, enrichment-cards-empty-state, score-dimension-bars]

key-files:
  created:
    - src/app/(dashboard)/dashboard/leads/[id]/score-breakdown.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/enrichment-cards.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/similar-leads.tsx
  modified:
    - src/app/(dashboard)/dashboard/leads/[id]/page.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/lead-map.tsx

key-decisions:
  - "Score breakdown uses pure Tailwind progress bars (no chart library) with green/yellow/gray color coding at 70%/40% thresholds"
  - "Enrichment cards render nothing when all data is null (expected initial state until enrichment scrapers are built in Phase 16+)"
  - "Similar leads uses simple nearby-by-recency query (within 25mi, sorted by scrapedAt DESC, limit 5) rather than industry overlap filtering for simplicity and cross-industry discovery"
  - "Dual-marker map uses BoundsFitter component with fitBounds to auto-zoom showing both lead and HQ markers"
  - "Removed Equipment Needs and Equipment Timeline cards (heavy-equipment-specific) in favor of industry-agnostic scoring breakdown"

patterns-established:
  - "BoundsFitter pattern: useMap + useMapsLibrary('core') to auto-fit map bounds to multiple markers"
  - "Service radius circle on lead detail map reuses Phase 14 pattern (useMapsLibrary('maps') with ref-based lifecycle)"
  - "Enrichment data parsed safely with try/catch per-row, defaulting to null on JSON parse failure"

requirements-completed: [FEED-04]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 15 Plan 03: Lead Detail Scoring & Enrichment Summary

**Rewritten lead detail page with 5-dimension score breakdown bars, dual-marker map with service radius, enrichment cards (weather/property/incentives), and similar leads discovery**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T18:27:11Z
- **Completed:** 2026-03-16T18:32:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Lead detail page now shows full 5-dimension scoring breakdown (Distance, Relevance, Value, Freshness, Urgency) with per-dimension progress bars, scores, and human-readable reasons
- Dual-marker map displays red lead marker + blue HQ marker with semi-transparent service radius circle overlay, auto-fitted bounds
- Enrichment cards section gracefully handles empty state (no enrichment data yet -- enrichment scrapers are Phase 16+)
- Similar leads section discovers nearby leads within 25 miles for cross-industry lead discovery
- Updated branding from HeavyLeads to LeadForge throughout the detail page

## Task Commits

Each task was committed atomically:

1. **Task 1: Create score breakdown, enrichment cards, and similar leads components** - `4355839` (feat)
2. **Task 2: Rewrite lead detail page with scored data, dual-marker map, and new sections** - `da465b2` (feat)

## Files Created/Modified
- `src/app/(dashboard)/dashboard/leads/[id]/score-breakdown.tsx` - Client component: 5-dimension progress bars with color coding and match reasons
- `src/app/(dashboard)/dashboard/leads/[id]/enrichment-cards.tsx` - Server component: weather, property, and incentive enrichment cards with graceful empty state
- `src/app/(dashboard)/dashboard/leads/[id]/similar-leads.tsx` - Server component: queries nearby leads within 25mi via Haversine SQL
- `src/app/(dashboard)/dashboard/leads/[id]/page.tsx` - Rewritten lead detail page with getLeadByIdScored, enrichments, score breakdown, similar leads
- `src/app/(dashboard)/dashboard/leads/[id]/lead-map.tsx` - Updated to dual-marker map with HQ marker, service radius circle, and auto-fit bounds

## Decisions Made
- Score breakdown uses pure Tailwind div-based progress bars rather than a charting library -- keeps bundle small and matches the project's CSS-only approach
- Enrichment cards component renders nothing (returns null) when all enrichment data is null -- this is the expected state until enrichment scrapers are built
- Similar leads query uses simple proximity + recency (not industry overlap filtering) because cross-industry discovery is valuable for subscribers
- Dual-marker map uses BoundsFitter component with useMap + useMapsLibrary('core') for auto-fit bounds to both markers
- Removed old Equipment Needs and Equipment Timeline cards -- these were heavy-equipment-specific and are replaced by the industry-agnostic 5-dimension scoring breakdown

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build error in `dashboard/page.tsx` (line 235: `dealerEquipment` prop removed from LeadFilters in Plan 02 rework) -- confirmed pre-existing before our changes, out of scope per deviation rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lead detail page fully wired to per-org scoring engine
- Enrichment cards ready to display data once enrichment scrapers are built (Phase 16+)
- Similar leads section operational for cross-industry lead discovery
- Phase 15 complete -- all 3 plans (scoring engine, lead feed UI, lead detail) delivered

## Self-Check: PASSED

All 5 created/modified files verified present. Both task commits verified in git log.

---
*Phase: 15-scoring-engine-and-lead-feed*
*Completed: 2026-03-16*
