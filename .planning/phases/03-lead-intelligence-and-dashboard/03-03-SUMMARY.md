---
phase: 03-lead-intelligence-and-dashboard
plan: 03
subsystem: ui
tags: [react, google-maps, vis.gl, next-dynamic, detail-view, timeline, vitest]

# Dependency graph
requires:
  - phase: 03-lead-intelligence-and-dashboard
    provides: "getLeadById query, EnrichedLead type, InferredEquipment/TimelineWindow types, equipment-inference, scoring, timeline modules"
  - phase: 01-platform-foundation
    provides: "Better Auth session pattern, companyProfiles schema, shadcn Card/Badge/Skeleton components"
provides:
  - "Lead detail page at /dashboard/leads/[id] with full project info, map, equipment, timeline, and source"
  - "LeadMap client component with Google Maps integration and API key graceful degradation"
  - "LeadTimeline server component with urgency-coded phases (Now/Soon/Later)"
  - "Detail-view smoke test (5 tests: timeline, map fallback, map with key, equipment confidence)"
affects: [03-USER-SETUP]

# Tech tracking
tech-stack:
  added: ["@vis.gl/react-google-maps"]
  patterns: ["Dynamic import with next/dynamic for client-only Google Maps", "Graceful degradation when env var not configured", "Currency/date formatting via Intl API"]

key-files:
  created:
    - src/app/(dashboard)/dashboard/leads/[id]/page.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/lead-map.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/lead-timeline.tsx
    - tests/leads/detail-view.test.tsx
  modified: []

key-decisions:
  - "LeadTimeline created as server component (no 'use client') since it has no interactive state"
  - "LeadMap uses next/dynamic with ssr:false to prevent Google Maps JS from loading on server/feed page"
  - "Confidence indicators use colored dots (green/yellow/gray) rather than text labels for visual scannability"
  - "formatCurrency and formatDate helpers defined inline in page.tsx (no shared utils yet at MVP scale)"

patterns-established:
  - "Dynamic import pattern: next/dynamic with ssr:false + Skeleton loading for client-only map components"
  - "Graceful env var degradation: check process.env at render time, show informative fallback when missing"
  - "Vertical timeline with border-l-2 + relative dots for phase progression visualization"

requirements-completed: [LEAD-04, LEAD-03]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 3 Plan 3: Lead Detail View Summary

**Lead detail page at /dashboard/leads/[id] with interactive Google Maps, urgency-coded equipment timeline, confidence-rated equipment needs, and source attribution with 5 passing smoke tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T18:20:58Z
- **Completed:** 2026-03-14T18:26:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Lead detail page rendering full project info (address, description, value, permit date, applicant, distance) with two-column responsive layout
- Interactive Google Map with AdvancedMarker and Pin, dynamically imported to prevent Google Maps JS from loading on feed page, with graceful fallback when API key is not configured
- Equipment needs section with color-coded confidence dots (green=high, yellow=medium, gray=low) and reason text
- Vertical timeline with urgency-coded badges (Now=red, Soon=yellow/outline, Later=gray) and phase equipment lists
- Source attribution card with jurisdiction, source ID, permit number, and external link to original permit data
- 5 smoke tests covering timeline rendering, empty timeline, map fallback, map with API key, and equipment confidence indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @vis.gl/react-google-maps, create map component, and create detail-view smoke test** - `ee76bff` (feat)
2. **Task 2: Lead timeline component and detail page** - `3620602` (feat)

## Files Created/Modified
- `src/app/(dashboard)/dashboard/leads/[id]/page.tsx` - Lead detail server component with dynamic metadata, auth, company profile context, two-column layout
- `src/app/(dashboard)/dashboard/leads/[id]/lead-map.tsx` - Client component Google Map with APIProvider, AdvancedMarker, Pin, and API key fallback
- `src/app/(dashboard)/dashboard/leads/[id]/lead-timeline.tsx` - Server component vertical timeline with urgency badges and equipment lists
- `tests/leads/detail-view.test.tsx` - 5 smoke tests for detail view sub-components

## Decisions Made
- LeadTimeline created as a server component since it has no interactive state -- avoids unnecessary client JS
- LeadMap uses next/dynamic with ssr:false to prevent Google Maps JavaScript from being bundled in the server render or loaded on the feed page
- Confidence indicators use small colored dots rather than text labels -- visually scannable at a glance while the reason text provides detail
- Currency and date formatting use Intl API directly in the page component -- shared formatters can be extracted later if reuse grows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created LeadTimeline in Task 1 instead of Task 2**
- **Found during:** Task 1 (smoke test creation)
- **Issue:** Task 1 tests reference LeadTimeline component, but plan specifies creating it in Task 2
- **Fix:** Created LeadTimeline in Task 1 alongside LeadMap so tests can import and render it
- **Files modified:** src/app/(dashboard)/dashboard/leads/[id]/lead-timeline.tsx
- **Verification:** All 5 smoke tests pass including timeline rendering tests
- **Committed in:** ee76bff (Task 1 commit)

**2. [Rule 1 - Bug] Fixed duplicate text query in equipment smoke test**
- **Found during:** Task 1 (smoke test execution)
- **Issue:** Equipment test used `getByText("Excavators")` which collided with LeadTimeline rendering "Excavators" in the same jsdom document
- **Fix:** Changed to `getByTestId("equipment-Excavators")` for unambiguous element selection
- **Files modified:** tests/leads/detail-view.test.tsx
- **Verification:** All 5 tests pass without ambiguous element errors
- **Committed in:** ee76bff (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 test bug)
**Impact on plan:** Minor task ordering adjustment and test selector fix. No scope creep.

## Issues Encountered

- Uncommitted files from Plan 02 (lead-filters.tsx, dashboard page.tsx modifications, layout.tsx change) were present in the working tree and nearly got included in Task 2's commit. Caught and excluded by resetting and re-staging only the detail page file.

## User Setup Required

**External services require manual configuration.** The Google Maps integration requires:
- **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY**: Obtain from Google Cloud Console -> APIs & Services -> Credentials
- **Maps JavaScript API**: Must be enabled in Google Cloud Console -> APIs & Services -> Library
- **Cloud Map ID** (optional): For AdvancedMarker styling. Uses DEMO_MAP_ID behavior in development.

The map gracefully degrades when the API key is not configured, showing an informative fallback with the address text.

## Next Phase Readiness
- Lead detail view complete -- sales reps can click any lead card and see full project details
- All Plan 01 query utilities (getLeadById, enrichment pipeline) are consumed and working
- Google Maps integration is optional/graceful -- the detail page works fully without it
- Ready for Plan 02 completion (dashboard feed with filtering) and any subsequent phase work

## Self-Check: PASSED

- All 4 created files exist on disk
- Both task commits verified in git log (ee76bff, 3620602)
- 5/5 tests passing
- TypeScript compiles with zero errors

---
*Phase: 03-lead-intelligence-and-dashboard*
*Completed: 2026-03-14*
