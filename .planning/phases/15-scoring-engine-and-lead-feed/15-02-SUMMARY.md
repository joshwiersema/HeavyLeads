---
phase: 15-scoring-engine-and-lead-feed
plan: 02
subsystem: ui
tags: [lead-feed, scored-leads, industry-badge, cursor-pagination, filter-panel]

# Dependency graph
requires:
  - phase: 15-scoring-engine-and-lead-feed
    plan: 01
    provides: ScoredLead type, getFilteredLeadsCursor, ScoringResult with matchReasons
  - phase: 14-industry-onboarding
    provides: INDUSTRY_CONFIG with per-industry specializations, Industry type
provides:
  - Redesigned lead card with composite score, match reasons, and source type badges
  - Industry-aware filter panel with source type, project type, sort, and specialization toggle
  - Cursor-based Load More pagination replacing offset-based Previous/Next
  - Industry badge component with per-industry colors in sidebar and mobile nav
  - Dashboard page wired to cursor-based scored lead feed
affects: [15-03 lead-detail-scoring, 16-alert-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [scored-lead-card, industry-aware-filters, cursor-pagination-ui]

key-files:
  created:
    - src/components/dashboard/industry-badge.tsx
  modified:
    - src/app/(dashboard)/dashboard/lead-card.tsx
    - src/app/(dashboard)/dashboard/lead-filters.tsx
    - src/app/(dashboard)/dashboard/pagination.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/layout.tsx
    - src/components/dashboard/sidebar-nav.tsx
    - src/components/dashboard/mobile-nav.tsx
    - src/app/(dashboard)/dashboard/bookmarks/page.tsx
    - tests/leads/feed.test.tsx
    - tests/ui/sidebar-nav.test.tsx

key-decisions:
  - "Bookmarks page wraps EnrichedLead.score into minimal ScoringResult for LeadCard compatibility rather than rewriting bookmark query pipeline"
  - "Sort options rendered as button grid (not select dropdown) for immediate visual feedback on active sort"
  - "Industry badge placed above nav links in sidebar for persistent visibility"
  - "Nationwide fallback preserved for cursor-based feed -- retries with maxDistanceMiles 99999 when no results and no filters"

patterns-established:
  - "ScoredLead as primary card type: all lead display surfaces should accept ScoredLead (legacy surfaces wrap EnrichedLead.score into ScoringResult)"
  - "Filter panel uses URL search params exclusively -- no client-side state for filter values except debounced keyword and slider drag"
  - "Cursor param replaces page param for pagination -- delete cursor on filter changes to reset to first page"

requirements-completed: [FEED-01, FEED-02, FEED-06]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 15 Plan 02: Lead Feed UI Summary

**Scored lead cards with match reasons, industry-aware filter panel with 9 filter dimensions, cursor-based pagination, and color-coded industry badge in sidebar**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T18:26:55Z
- **Completed:** 2026-03-16T18:33:55Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Lead cards display composite score (green/yellow/red), top 2 match reasons, source type badges (permit/bid/news/storm/violation), value estimate, and distance
- Filter panel supports source type checkboxes, distance slider, value range, industry-specific project type checkboxes, date range, sort-by (score/distance/value/date), and matching-specializations-only toggle
- Cursor-based "Load more leads" pagination replaces offset-based Previous/Next system
- Industry badge pill with per-industry colors (amber/blue/red/yellow/purple) renders in both desktop sidebar and mobile drawer navigation
- Dashboard page wired to getFilteredLeadsCursor with 10 filter parameters

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite lead card, filter panel, and pagination** - `aa61c84` (feat)
2. **Task 2: Wire dashboard page to cursor feed and add industry badge** - `4c0659a` (feat)

## Files Created/Modified
- `src/app/(dashboard)/dashboard/lead-card.tsx` - Redesigned for ScoredLead with scoring.total, matchReasons, source type badges, and value formatting
- `src/app/(dashboard)/dashboard/lead-filters.tsx` - Rewritten with source type, project type (industry-specific), sort-by, and matchOnly toggle
- `src/app/(dashboard)/dashboard/pagination.tsx` - Cursor-based Load More button replacing offset-based Previous/Next
- `src/app/(dashboard)/dashboard/page.tsx` - Wired to getFilteredLeadsCursor with full filter param parsing, industry query, and cursor pagination
- `src/app/(dashboard)/layout.tsx` - Queries org industry, passes to SidebarNav and MobileNav
- `src/components/dashboard/sidebar-nav.tsx` - Accepts industry prop, renders IndustryBadge above nav links
- `src/components/dashboard/mobile-nav.tsx` - Accepts industry prop, renders IndustryBadge in drawer
- `src/components/dashboard/industry-badge.tsx` - New component: colored pill displaying org industry name
- `src/app/(dashboard)/dashboard/bookmarks/page.tsx` - Adapts EnrichedLead to ScoredLead shape for LeadCard compatibility
- `tests/leads/feed.test.tsx` - Updated to use ScoredLead fixtures and new LeadCard interface
- `tests/ui/sidebar-nav.test.tsx` - Updated with required industry prop

## Decisions Made
- Bookmarks page wraps EnrichedLead.score into a minimal ScoringResult `{ total, dimensions: [], matchReasons: [] }` rather than rewriting the entire bookmark query pipeline -- pragmatic backward compat
- Sort options rendered as a 2x2 button grid for immediate visual feedback, not a select dropdown
- Industry badge placed above the nav links list (not below logo) for consistent visibility in both sidebar and mobile drawer
- Nationwide fallback preserved in cursor-based feed -- retries with maxDistanceMiles 99999 when zero results and no active filters

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated bookmarks page for ScoredLead compatibility**
- **Found during:** Task 1 (LeadCard rewrite)
- **Issue:** Bookmarks page imports LeadCard and passes EnrichedLead, but LeadCard now expects ScoredLead with scoring field
- **Fix:** Wrapped EnrichedLead.score into minimal ScoringResult `{ total: lead.score, dimensions: [], matchReasons: [] }` in bookmarks page
- **Files modified:** src/app/(dashboard)/dashboard/bookmarks/page.tsx
- **Verification:** TypeScript compiles cleanly, build succeeds
- **Committed in:** aa61c84 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated feed and sidebar tests for new component interfaces**
- **Found during:** Tasks 1 & 2 (component interface changes)
- **Issue:** feed.test.tsx used EnrichedLead for LeadCard, sidebar-nav.test.tsx called SidebarNav without required industry prop
- **Fix:** Updated feed tests to use ScoredLead fixtures with scoring field; updated sidebar tests with `industry="heavy_equipment"` prop
- **Files modified:** tests/leads/feed.test.tsx, tests/ui/sidebar-nav.test.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** aa61c84 (Task 1), 4c0659a (Task 2)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for type safety after interface changes. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test files (bookmarks-batch, bookmarks, lead-status, pagination) from vitest mock type changes -- not related to this plan, out of scope per deviation rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lead detail page (Plan 03) can now use getLeadByIdScored for per-org scoring breakdown display
- All card and filter components are ready for the scored lead feed
- Industry badge pattern can be reused in other dashboard surfaces

## Self-Check: PASSED

All 11 created/modified files verified present. Both task commits verified in git log.
