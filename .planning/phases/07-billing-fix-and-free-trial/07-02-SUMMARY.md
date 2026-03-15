---
phase: 07-billing-fix-and-free-trial
plan: 02
subsystem: ui
tags: [trial-banner, billing, subscription, trial-ended, countdown, lucide-react]

# Dependency graph
requires:
  - phase: 07-billing-fix-and-free-trial
    provides: getTrialStatus utility, TrialStatus interface, getActiveSubscription query
provides:
  - TrialBanner component with countdown logic (plural/singular/today)
  - TrialEndedCard component with subscribe CTA for expired trials
  - Dashboard layout trial banner rendering when subscription is trialing
  - Billing page three-state logic (active, expired trial, no subscription)
affects: [dashboard-layout, billing-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-state-billing-page, conditional-banner-in-layout]

key-files:
  created:
    - src/components/billing/trial-banner.tsx
    - src/components/billing/trial-ended-card.tsx
    - tests/billing/trial-banner.test.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(billing)/billing/page.tsx
    - tests/billing/billing-page.test.tsx

key-decisions:
  - "Billing page queries for latest subscription (any status) when no active subscription exists, to detect expired trial state"
  - "TrialEndedCard reuses SubscribeButton directly since the upgrade flow already handles expired trial conversion"
  - "TrialBanner is a server component receiving daysRemaining as prop from server-side getTrialStatus computation"

patterns-established:
  - "Three-state billing page: active subscription -> BillingStatus, expired trial -> TrialEndedCard, no subscription -> subscribe card"
  - "Conditional banner in layout: server-side trial status check drives banner visibility in dashboard layout"

requirements-completed: [BILL-03, BILL-04]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 7 Plan 02: Trial UI Summary

**Trial countdown banner in dashboard layout with amber styling, and three-state billing page showing expired trial CTA via TrialEndedCard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T20:10:33Z
- **Completed:** 2026-03-15T20:13:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- TrialBanner component renders countdown with correct plural/singular/today text handling and amber styling
- TrialEndedCard shows "Your Trial Has Ended" messaging with feature list and SubscribeButton CTA
- Dashboard layout conditionally renders TrialBanner between header and main content when trialing
- Billing page handles three states: active subscription, expired trial, and no subscription
- All 266 tests pass including 9 new tests (6 trial-banner + 3 trial-ended-card)

## Task Commits

Each task was committed atomically:

1. **Task 0: Create test stubs for trial banner and trial-ended billing page state** - `419d44c` (test) - TDD RED: 9 failing tests across 2 files
2. **Task 1: Create TrialBanner and TrialEndedCard components, wire into layouts** - `6703b3e` (feat) - TDD GREEN: all tests pass, full suite green

## Files Created/Modified
- `src/components/billing/trial-banner.tsx` - Trial countdown banner with Clock icon, amber styling, subscribe link
- `src/components/billing/trial-ended-card.tsx` - Trial ended card with AlertTriangle icon, feature list, SubscribeButton
- `src/app/(dashboard)/layout.tsx` - Added getTrialStatus call and conditional TrialBanner rendering
- `src/app/(billing)/billing/page.tsx` - Three-state logic: active, expired trial (TrialEndedCard), no subscription
- `tests/billing/trial-banner.test.tsx` - 6 tests for banner text, link, and icon
- `tests/billing/billing-page.test.tsx` - 3 new tests for TrialEndedCard heading, messaging, and CTA

## Decisions Made
- Billing page queries for the most recent subscription (any status) when no active subscription exists, using `desc(createdAt)` ordering, to detect whether the user had an expired trial. This avoids a separate "expired subscription" query function.
- TrialEndedCard reuses the existing SubscribeButton component directly, since `authClient.subscription.upgrade()` already handles creating a new Checkout session for expired trial users.
- TrialBanner is a plain server component (no "use client" directive) since it only receives `daysRemaining` as a number prop computed server-side. TrialEndedCard is a client component because it embeds SubscribeButton which uses client-side state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trial UI is complete: BILL-03 (countdown banner) and BILL-04 (expired trial messaging) are both implemented
- Phase 7 is fully complete: all 5 billing requirements (BILL-01 through BILL-05) are satisfied
- Ready for Phase 8 (automated scraping) or any subsequent phases

## Self-Check: PASSED

All 6 files verified present. Both task commits verified in git log (419d44c, 6703b3e).

---
*Phase: 07-billing-fix-and-free-trial*
*Completed: 2026-03-15*
