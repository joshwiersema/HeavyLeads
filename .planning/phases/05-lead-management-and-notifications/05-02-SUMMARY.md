---
phase: 05-lead-management-and-notifications
plan: 02
subsystem: ui
tags: [react, next.js, shadcn, base-ui, lucide-react, sonner, useOptimistic, useTransition, url-search-params]

# Dependency graph
requires:
  - phase: 05-lead-management-and-notifications
    provides: lead_statuses/bookmarks/saved_searches tables, server actions, extended getFilteredLeads with keyword/date/size params
  - phase: 03-lead-intelligence
    provides: LeadCard component, LeadFilters component, lead detail page
provides:
  - Interactive status dropdown on lead detail page (LeadStatusSelect)
  - Bookmark toggle button on lead detail page (BookmarkButton)
  - Status indicators and bookmark icons on lead cards
  - Advanced filters (keyword search, date range, project size) in sidebar
  - Save Search button linking to saved searches page
  - Bookmarks page listing all bookmarked leads with LeadCard components
  - Saved searches page with save, load, and delete workflows
  - Updated sidebar with four nav items (Leads, Bookmarks, Saved Searches, Settings)
affects: [05-03, 05-04, email-digest, dashboard-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [useOptimistic for instant bookmark feedback, useTransition for async server action calls, debounced keyword search with URL params, client wrapper for next/dynamic ssr:false, savedSearchToParams extracted to shared utility]

key-files:
  created:
    - src/app/(dashboard)/dashboard/leads/[id]/lead-status-select.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/bookmark-button.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/lead-map-dynamic.tsx
    - src/app/(dashboard)/dashboard/bookmarks/page.tsx
    - src/app/(dashboard)/dashboard/saved-searches/page.tsx
    - src/app/(dashboard)/dashboard/saved-searches/save-search-form.tsx
    - src/app/(dashboard)/dashboard/saved-searches/saved-search-card.tsx
    - src/lib/leads/saved-search-utils.ts
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/dashboard/lead-card.tsx
    - src/app/(dashboard)/dashboard/lead-filters.tsx
    - src/app/(dashboard)/dashboard/leads/[id]/page.tsx
    - src/app/(dashboard)/layout.tsx
    - src/actions/saved-searches.ts
    - src/lib/leads/queries.ts
    - tests/leads/saved-searches.test.ts

key-decisions:
  - "Used separate server action calls (getLeadStatus, getBookmarkedLeads) on detail page rather than modifying getLeadById to accept userId/orgId -- cleaner separation, reuses existing actions"
  - "Extracted LeadMap dynamic import to client wrapper component to fix ssr:false restriction in Server Components"
  - "Moved savedSearchToParams to shared utility file (non-async functions cannot be exported from 'use server' files)"
  - "Used useOptimistic for bookmark toggle for instant UI feedback with revert-on-error"
  - "Active filter count shown on mobile collapsible panel badge to indicate when filters are applied"

patterns-established:
  - "Client wrapper pattern for next/dynamic ssr:false: extract to 'use client' component when parent is Server Component"
  - "Server action call pattern: useTransition + toast for mutations, useOptimistic for toggles"
  - "Pure utility extraction: non-async helper functions must live outside 'use server' files"

requirements-completed: [UX-02, UX-03, UX-06]

# Metrics
duration: 10min
completed: 2026-03-14
---

# Phase 5 Plan 2: Lead Management UI Summary

**Interactive lead status dropdown, bookmark toggle, keyword/date/size filters, bookmarks page, saved searches page, and four-item sidebar navigation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-14T19:46:20Z
- **Completed:** 2026-03-14T19:56:29Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Lead detail page has interactive status dropdown (5 states with color-coded dots) and bookmark toggle button with optimistic UI
- Lead cards show read-only status indicators and bookmark icons reflecting per-user state
- Dashboard filters extended with keyword search (debounced 300ms), date range pickers, project size range, and Save Search button
- Bookmarks page fetches and displays all bookmarked leads using existing LeadCard component
- Saved searches page supports full save/load/delete workflow with client-interactive cards
- Sidebar navigation updated with four icon-labeled links: Leads, Bookmarks, Saved Searches, Settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status badges, bookmark toggles, and advanced filters** - `643a421` (feat)
2. **Task 2: Create bookmarks page, saved searches page, and update sidebar** - `817d731` (feat)

## Files Created/Modified
- `src/app/(dashboard)/dashboard/leads/[id]/lead-status-select.tsx` - Client component: shadcn Select with useTransition for status updates
- `src/app/(dashboard)/dashboard/leads/[id]/bookmark-button.tsx` - Client component: useOptimistic bookmark toggle with sonner toast
- `src/app/(dashboard)/dashboard/leads/[id]/lead-map-dynamic.tsx` - Client wrapper for next/dynamic ssr:false LeadMap import
- `src/app/(dashboard)/dashboard/leads/[id]/page.tsx` - Added status select and bookmark button to header, parallel fetch for status/bookmark/sources
- `src/app/(dashboard)/dashboard/lead-card.tsx` - Added status indicator pill and bookmark icon display
- `src/app/(dashboard)/dashboard/lead-filters.tsx` - Added keyword search, date range, project size inputs, Save Search button
- `src/app/(dashboard)/dashboard/page.tsx` - Parse new URL params, pass userId/orgId to getFilteredLeads, show active filter summary
- `src/app/(dashboard)/dashboard/bookmarks/page.tsx` - Server component: fetch bookmarked lead IDs, resolve to enriched leads, render with LeadCard
- `src/app/(dashboard)/dashboard/saved-searches/page.tsx` - Server component: list saved searches, show save form when ?save=true
- `src/app/(dashboard)/dashboard/saved-searches/save-search-form.tsx` - Client component: name input + filter summary + save action
- `src/app/(dashboard)/dashboard/saved-searches/saved-search-card.tsx` - Client component: load/delete actions with useTransition
- `src/app/(dashboard)/layout.tsx` - Four nav items with lucide-react icons
- `src/lib/leads/saved-search-utils.ts` - Extracted savedSearchToParams pure function from server actions file
- `src/actions/saved-searches.ts` - Removed non-async savedSearchToParams (incompatible with "use server" directive)
- `src/lib/leads/queries.ts` - Fixed selectFields type annotation for Drizzle dynamic select
- `tests/leads/saved-searches.test.ts` - Updated savedSearchToParams import path

## Decisions Made
- Used separate server action calls on detail page (getLeadStatus + getBookmarkedLeads) rather than extending getLeadById query, preserving clean action boundaries
- Extracted LeadMap dynamic import to dedicated client wrapper component to resolve Next.js Server Component restriction on `ssr: false`
- Moved `savedSearchToParams` from `"use server"` file to shared utility since non-async functions cannot be exported from server action modules
- Used `useOptimistic` for bookmark toggle for instant visual feedback, with automatic revert on server error
- Debounced keyword search at 300ms to avoid excessive server re-renders while maintaining responsive feel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ssr:false dynamic import in Server Component**
- **Found during:** Task 1 (lead detail page update)
- **Issue:** `next/dynamic` with `ssr: false` is not allowed in Server Components (Turbopack enforcement)
- **Fix:** Extracted LeadMap dynamic import to `lead-map-dynamic.tsx` client wrapper component
- **Files modified:** src/app/(dashboard)/dashboard/leads/[id]/lead-map-dynamic.tsx, src/app/(dashboard)/dashboard/leads/[id]/page.tsx
- **Verification:** Build succeeds
- **Committed in:** 643a421 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed base-ui Select onValueChange type (value can be null)**
- **Found during:** Task 1 (LeadStatusSelect component)
- **Issue:** base-ui Select's onValueChange passes `LeadStatus | null`, not just `LeadStatus`
- **Fix:** Updated handleChange parameter type to accept null, added null guard
- **Files modified:** src/app/(dashboard)/dashboard/leads/[id]/lead-status-select.tsx
- **Verification:** TypeScript compilation succeeds
- **Committed in:** 643a421 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed selectFields type assertion in queries.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** `Record<string, unknown>` not assignable to Drizzle SelectedFields type
- **Fix:** Changed type annotation to `Record<string, any>` for dynamic select field construction
- **Files modified:** src/lib/leads/queries.ts
- **Verification:** Build succeeds, all tests pass
- **Committed in:** 643a421 (Task 1 commit)

**4. [Rule 3 - Blocking] Moved savedSearchToParams out of "use server" file**
- **Found during:** Task 2 (saved search card component)
- **Issue:** Non-async `savedSearchToParams` cannot be exported from a `"use server"` file -- build error
- **Fix:** Extracted to `src/lib/leads/saved-search-utils.ts`, updated imports in client components and tests
- **Files modified:** src/lib/leads/saved-search-utils.ts, src/actions/saved-searches.ts, src/app/(dashboard)/dashboard/saved-searches/saved-search-card.tsx, tests/leads/saved-searches.test.ts
- **Verification:** Build succeeds, all 105 tests pass
- **Committed in:** 817d731 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correct builds and type safety. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full lead management UI complete: status tracking, bookmarks, saved searches, advanced filtering
- Email digest (Plan 3) can query saved_searches with isDigestEnabled flag
- Notification preferences (Plan 4) can integrate with the saved searches and bookmark infrastructure
- All 105 lead tests pass, build clean

## Self-Check: PASSED

All 8 created files verified present. Both task commits found (643a421, 817d731). Build succeeds. 105/105 tests pass.

---
*Phase: 05-lead-management-and-notifications*
*Completed: 2026-03-14*
