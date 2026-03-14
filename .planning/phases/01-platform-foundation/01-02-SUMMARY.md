---
phase: 01-platform-foundation
plan: 02
subsystem: onboarding, settings
tags: [react-hook-form, zod, geocoding, google-maps, server-actions, shadcn, multi-step-form]

# Dependency graph
requires:
  - phase: 01-platform-foundation plan 01
    provides: "Auth system with Better Auth, DB schema with companyProfiles table, dashboard layout with onboarding guard"
provides:
  - "3-step onboarding wizard (location, equipment types, service radius) with geocoding"
  - "Account settings page (name, email)"
  - "Admin-only company profile settings with re-geocoding on address change"
  - "Geocoding utility for address-to-coordinates conversion"
affects: [02-data-pipeline, 03-lead-engine]

# Tech tracking
tech-stack:
  added: [react-hook-form, "@hookform/resolvers"]
  patterns: [multi-step-wizard-form, server-action-with-validation, admin-role-guard, geocoding-graceful-degradation]

key-files:
  created:
    - src/components/onboarding/wizard-shell.tsx
    - src/components/onboarding/step-location.tsx
    - src/components/onboarding/step-equipment.tsx
    - src/components/onboarding/step-radius.tsx
    - src/actions/onboarding.ts
    - src/actions/settings.ts
    - src/lib/geocoding.ts
    - src/lib/validators/onboarding.ts
    - src/lib/validators/settings.ts
    - src/components/settings/account-form.tsx
    - src/components/settings/company-form.tsx
    - src/app/(onboarding)/onboarding/page.tsx
    - src/app/(dashboard)/settings/layout.tsx
    - src/app/(dashboard)/settings/account/page.tsx
    - src/app/(dashboard)/settings/company/page.tsx
    - src/components/ui/checkbox.tsx
  modified:
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "Used valueAsNumber on HTML input instead of Zod v4 coerce (coerce API changed in v4)"
  - "Moved onboarding page to separate (onboarding) route group to avoid dashboard layout redirect loop"
  - "Extracted geocoding to shared src/lib/geocoding.ts utility for reuse in both onboarding and settings"
  - "Added /settings redirect page to prevent blank page when navigating to /settings"

patterns-established:
  - "Multi-step wizard: React Hook Form + FormProvider + per-step trigger validation"
  - "Server action pattern: validate session, validate input with Zod, perform operation, revalidatePath"
  - "Admin guard: check role via auth.api.getActiveMember at both server action and UI level"
  - "Geocoding graceful degradation: return defaults if GOOGLE_MAPS_API_KEY not set"

requirements-completed: [PLAT-04, PLAT-06]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 1 Plan 2: Onboarding & Settings Summary

**3-step onboarding wizard with geocoding, account settings, and admin-only company profile management using React Hook Form and server actions**

## Performance

- **Duration:** 15 min (continuation from checkpoint)
- **Started:** 2026-03-14T04:01:58Z
- **Completed:** 2026-03-14T04:18:03Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 17

## Accomplishments
- 3-step onboarding wizard collects HQ address, equipment types, and service radius with per-step Zod validation
- Server-side geocoding converts HQ address to lat/lng via Google Maps API (graceful degradation without API key)
- Account settings page allows users to update name and email
- Admin-only company profile settings with defense-in-depth role checking (server action + UI)
- Onboarding guard prevents re-entry after completion; unonboarded users cannot access dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Onboarding wizard with 3-step form, geocoding, and validation** - `8d88e7e` (feat)
2. **Task 2: Account settings and admin-only company profile settings** - `a60f1a2` (feat)
3. **Task 3: Verify complete auth and onboarding flow end-to-end** - checkpoint approved (no commit, verification only)

## Files Created/Modified
- `src/lib/validators/onboarding.ts` - Zod schemas for onboarding wizard steps (location, equipment, radius)
- `src/lib/validators/settings.ts` - Zod schemas for account and company settings
- `src/lib/geocoding.ts` - Shared geocoding utility using Google Maps API with graceful degradation
- `src/actions/onboarding.ts` - Server action: validate, geocode, save company profile with onboardingCompleted=true
- `src/actions/settings.ts` - Server actions: updateAccount, updateCompanyProfile (admin-only), getCompanyProfile
- `src/components/onboarding/wizard-shell.tsx` - Multi-step form container with React Hook Form + step navigation
- `src/components/onboarding/step-location.tsx` - HQ address input step
- `src/components/onboarding/step-equipment.tsx` - Equipment type multi-select checkbox grid
- `src/components/onboarding/step-radius.tsx` - Service radius number input with display
- `src/app/(onboarding)/onboarding/page.tsx` - Onboarding page in separate route group (avoids redirect loop)
- `src/components/settings/account-form.tsx` - Account settings form (name, email)
- `src/components/settings/company-form.tsx` - Company profile form (admin: editable, non-admin: read-only)
- `src/app/(dashboard)/settings/layout.tsx` - Settings layout with Account/Company tab navigation
- `src/app/(dashboard)/settings/page.tsx` - Redirect to /settings/account
- `src/app/(dashboard)/settings/account/page.tsx` - Account settings page with session data
- `src/app/(dashboard)/settings/company/page.tsx` - Company profile page with admin role check
- `src/components/ui/checkbox.tsx` - shadcn Checkbox component

## Decisions Made
- **Zod v4 coerce workaround:** Used `valueAsNumber` on HTML input instead of Zod v4 coerce syntax which has changed
- **Separate route group for onboarding:** Placed onboarding page in `(onboarding)` route group instead of `(dashboard)` to avoid the dashboard layout's onboarding redirect loop
- **Shared geocoding utility:** Extracted geocoding to `src/lib/geocoding.ts` for reuse across onboarding and settings
- **Settings redirect:** Added `/settings` page that redirects to `/settings/account` to prevent blank page

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod v4 coerce syntax incompatibility**
- **Found during:** Task 1 (Onboarding wizard)
- **Issue:** Zod v4 changed the coerce API; the planned `z.coerce.number()` pattern did not work as expected
- **Fix:** Used `valueAsNumber` attribute on the HTML number input element instead
- **Files modified:** src/components/onboarding/step-radius.tsx, src/lib/validators/onboarding.ts
- **Verification:** Build passes, number validation works correctly
- **Committed in:** 8d88e7e (Task 1 commit)

**2. [Rule 3 - Blocking] Dashboard layout redirect loop for onboarding page**
- **Found during:** Task 1 (Onboarding wizard)
- **Issue:** Plan placed onboarding page under `(dashboard)` route group, but dashboard layout redirects to /onboarding when profile is incomplete, creating an infinite redirect loop
- **Fix:** Created separate `(onboarding)` route group for the onboarding page, bypassing the dashboard layout entirely
- **Files modified:** src/app/(onboarding)/onboarding/page.tsx (created in new route group instead of planned location)
- **Verification:** Build passes, no redirect loop
- **Committed in:** 8d88e7e (Task 1 commit)

**3. [Rule 2 - Missing Critical] Settings page blank without redirect**
- **Found during:** Task 2 (Settings pages)
- **Issue:** Navigating to /settings showed a blank page since only /settings/account and /settings/company had content
- **Fix:** Added /settings/page.tsx that redirects to /settings/account
- **Files modified:** src/app/(dashboard)/settings/page.tsx
- **Verification:** Navigating to /settings correctly redirects to /settings/account
- **Committed in:** a60f1a2 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

**External services require manual configuration.** The onboarding wizard and company profile settings use Google Maps Geocoding API for address-to-coordinates conversion.

- **GOOGLE_MAPS_API_KEY:** Obtain from Google Cloud Console -> APIs & Services -> Credentials -> Create API Key -> Restrict to Geocoding API
- **Enable Geocoding API:** Google Cloud Console -> APIs & Services -> Library -> Search "Geocoding API" -> Enable
- **Graceful degradation:** Without the API key, geocoding returns default coordinates (0, 0) with a console warning. The app remains functional for development.

## Next Phase Readiness
- Platform foundation complete: auth, multi-tenancy, onboarding, settings all functional
- Company profiles stored with geocoded HQ coordinates, equipment types, and service radius
- Ready for Phase 2 (Data Pipeline) to build permit scrapers that will feed into geographic lead matching
- Google Maps API key needed before production use of geocoding features

## Self-Check: PASSED

- All 17 files verified present on disk
- Commit 8d88e7e (Task 1) verified in git log
- Commit a60f1a2 (Task 2) verified in git log
- Task 3 was a human-verify checkpoint, approved by user

---
*Phase: 01-platform-foundation*
*Completed: 2026-03-14*
