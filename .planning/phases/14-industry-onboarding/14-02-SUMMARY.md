---
phase: 14-industry-onboarding
plan: 02
subsystem: ui
tags: [react, onboarding, google-maps, wizard, drizzle, server-action]

# Dependency graph
requires:
  - phase: 14-industry-onboarding
    plan: 01
    provides: WizardState, WizardAction, wizardReducer, INDUSTRY_CONFIG, useWizardPersistence, per-step Zod schemas, WizardShell with steps 1-2
  - phase: 13-schema-foundation
    provides: organization industry column, organization_profiles with expanded columns
provides:
  - Service Area step with interactive Google Map, draggable marker, Circle radius overlay, and radius slider
  - Specializations step with industry-conditional checkbox grids for specializations, service types, certifications
  - Lead Preferences step with project value range, lead type checkboxes, alert frequency radio buttons
  - Review & Confirm step with read-only summary and per-section edit navigation
  - Rewritten completeOnboarding server action saving all wizard fields to organization + organization_profiles
  - Fully functional 6-step onboarding wizard wired end-to-end
affects: [14-03-onboarding-completion]

# Tech tracking
tech-stack:
  added: []
  patterns: [google-maps-circle-overlay, industry-conditional-ui, reusable-checkbox-grid, custom-radio-buttons-without-radix]

key-files:
  created:
    - src/components/onboarding/steps/service-area.tsx
    - src/components/onboarding/steps/specializations.tsx
    - src/components/onboarding/steps/lead-preferences.tsx
    - src/components/onboarding/steps/review-confirm.tsx
  modified:
    - src/actions/onboarding.ts
    - src/components/onboarding/wizard-shell.tsx

key-decisions:
  - "Custom radio button styling instead of Radix RadioGroup (not installed in project) -- uses styled button elements with visual radio indicator"
  - "Circle overlay uses useMapsLibrary('maps') for google.maps.Circle, created in useEffect with ref for proper cleanup"
  - "completeOnboarding accepts full WizardState, uses Places-provided lat/lng if available, falls back to server-side geocoding"
  - "equipmentTypes column populated with specializations for backward compat with existing heavy_equipment users"

patterns-established:
  - "Reusable CheckboxGrid component pattern: accepts options array, selected array, field name, dispatch -- used across specializations and lead preferences"
  - "Section component with edit button dispatching SET_STEP for review page navigation"
  - "InteractiveMap rendered inside APIProvider scoped to ServiceArea step only"

requirements-completed: [ONBD-03, ONBD-04, ONBD-05, ONBD-06]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 14 Plan 02: Wizard Steps 3-6 + Server Action Summary

**Interactive Google Map service area with radius overlay, industry-conditional specializations/preferences, review summary with edit navigation, and completeOnboarding saving all fields end-to-end**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T17:51:27Z
- **Completed:** 2026-03-16T17:55:37Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Built Service Area step with interactive Google Map (AdvancedMarker + Circle overlay), draggable marker for repositioning, radius slider (10-500 miles), graceful fallback when API key is not set
- Built Specializations step with industry-conditional checkbox grids reading from INDUSTRY_CONFIG -- specializations required, service types and certifications optional
- Built Lead Preferences step with project value range inputs, industry-conditional lead type checkboxes, and alert frequency radio button group
- Built Review & Confirm step showing all wizard data in read-only sections with edit buttons navigating to the correct step
- Rewrote completeOnboarding server action to accept full WizardState, update organization.industry, upsert all profile fields to organization_profiles including specializations, service types, certifications, value range, years in business, company size
- Wired wizard shell end-to-end: real step components replace placeholders, Complete button calls server action with loading state, clears sessionStorage on success, redirects to /billing

## Task Commits

Each task was committed atomically:

1. **Task 1: Service Area map step + Specializations step** - `f95f1cc` (feat)
2. **Task 2: Lead Preferences, Review step, server action rewrite, wizard wiring** - `90eb141` (feat)

## Files Created/Modified
- `src/components/onboarding/steps/service-area.tsx` - Step 3: Interactive Google Map with AdvancedMarker, Circle radius overlay, radius slider, no-API-key fallback
- `src/components/onboarding/steps/specializations.tsx` - Step 4: Industry-conditional checkbox grids for specializations (required), service types (optional), certifications (optional)
- `src/components/onboarding/steps/lead-preferences.tsx` - Step 5: Project value range inputs, lead type checkboxes, alert frequency radio buttons
- `src/components/onboarding/steps/review-confirm.tsx` - Step 6: Read-only summary of all wizard data with per-section edit buttons
- `src/actions/onboarding.ts` - Rewritten: accepts WizardState, updates organization.industry, upserts all fields to organization_profiles
- `src/components/onboarding/wizard-shell.tsx` - Wired all 6 real step components, async handleComplete with loading state, clearWizardStorage on success

## Decisions Made
- **Custom radio buttons:** Project does not have a Radix RadioGroup component installed. Built custom styled button elements with a visual radio indicator circle for the alert frequency selector.
- **Circle overlay via useMapsLibrary:** Used `useMapsLibrary("maps")` to access `google.maps.Circle` class, created in a useEffect with ref-based lifecycle management for proper cleanup on unmount.
- **Places-first geocoding:** The server action checks if lat/lng were already set by the Google Places Autocomplete (from step 2). Only falls back to server-side geocoding if coordinates are missing.
- **equipmentTypes backward compat:** The `equipmentTypes` column in organization_profiles is populated with the same values as `specializations` to maintain backward compatibility with existing heavy_equipment users whose scoring/filtering logic reads from equipmentTypes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Google Maps API key already configured from Phase 14 Plan 01.

## Next Phase Readiness
- All 6 wizard steps are functional end-to-end
- completeOnboarding saves all wizard data to both organization and organization_profiles tables
- sessionStorage is cleared on successful completion
- User redirects to /billing after completion
- Ready for Plan 03 (any remaining onboarding completion tasks)

## Self-Check: PASSED

All 6 key files verified present. Both task commits (f95f1cc, 90eb141) verified in git log.

---
*Phase: 14-industry-onboarding*
*Completed: 2026-03-16*
