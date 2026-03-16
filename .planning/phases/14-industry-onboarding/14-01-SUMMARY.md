---
phase: 14-industry-onboarding
plan: 01
subsystem: ui
tags: [react, onboarding, useReducer, sessionStorage, zod, google-places, wizard]

# Dependency graph
requires:
  - phase: 13-schema-foundation
    provides: organization industry column, organization_profiles with expanded columns
provides:
  - WizardState, WizardAction, Industry type, WIZARD_STEPS definitions
  - INDUSTRY_CONFIG with per-industry specializations, services, certs, lead types
  - wizardReducer state machine with 7 action types
  - useWizardPersistence sessionStorage hook with debounced writes
  - Per-step Zod schemas for all 6 wizard steps
  - WizardShell component with useReducer + 6-step progress bar
  - IndustrySelection step with 5 clickable industry cards
  - CompanyBasics step with Google Places autocomplete address entry
affects: [14-02-onboarding-steps, 14-03-onboarding-completion]

# Tech tracking
tech-stack:
  added: []
  patterns: [useReducer-wizard-state, sessionStorage-persistence-hook, step-schema-validation, google-places-autocomplete-with-fallback]

key-files:
  created:
    - src/lib/onboarding/types.ts
    - src/lib/onboarding/config.ts
    - src/lib/onboarding/reducer.ts
    - src/lib/onboarding/use-wizard-persistence.ts
    - src/components/onboarding/steps/industry-selection.tsx
    - src/components/onboarding/steps/company-basics.tsx
  modified:
    - src/lib/validators/onboarding.ts
    - src/components/onboarding/wizard-shell.tsx
    - src/app/(onboarding)/onboarding/page.tsx

key-decisions:
  - "Zod v4 uses { message } not { required_error } for z.enum error param"
  - "Google Places autocomplete wrapped in APIProvider per-step, not at wizard level, to avoid loading maps JS when not needed"
  - "Old onboarding schemas (onboardingSchema, locationSchema, etc.) preserved for backward compat with completeOnboarding action"

patterns-established:
  - "WizardStepProps interface: { state: WizardState; dispatch: Dispatch<WizardAction> } -- all step components receive these props"
  - "Step validation via getStepSchema(stepIndex) returning Zod schema for current step fields"
  - "STEP_FIELD_MAP extracts the right WizardState slice for per-step validation"
  - "Google Places fallback: check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, render autocomplete or manual fields"

requirements-completed: [ONBD-01, ONBD-02, ONBD-07]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 14 Plan 01: Wizard Infrastructure + Steps 1-2 Summary

**useReducer wizard with sessionStorage persistence, 5-industry config, Zod per-step validation, and Google Places autocomplete address entry**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T17:41:57Z
- **Completed:** 2026-03-16T17:47:35Z
- **Tasks:** 2
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- Built complete wizard infrastructure: Industry type system, per-industry config (specializations/services/certs/leads for 5 industries), useReducer state machine with 7 action types, sessionStorage persistence with debounced writes
- Created IndustrySelection step with 5 clickable industry cards (heavy equipment, HVAC, roofing, solar, electrical) with icon map and selection highlighting
- Created CompanyBasics step with company name, size dropdown, years in business, and address fields with Google Places Autocomplete (falls back to manual entry)
- Rewrote wizard shell from useState/react-hook-form to useReducer with 6-step progress bar, loading skeleton, and per-step Zod validation
- Added 5 new per-step Zod schemas while preserving all existing validator exports for backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Onboarding infrastructure (types, config, reducer, persistence, schemas)** - `5f2d4dd` (feat)
2. **Task 2: Wizard shell rewrite + Industry Selection + Company Basics** - `198253a` (feat)

## Files Created/Modified
- `src/lib/onboarding/types.ts` - Industry type, INDUSTRIES array, WIZARD_STEPS, WizardState, WizardAction
- `src/lib/onboarding/config.ts` - INDUSTRY_CONFIG per-industry options, COMPANY_SIZES, ALERT_FREQUENCIES
- `src/lib/onboarding/reducer.ts` - wizardReducer state machine, initialWizardState
- `src/lib/onboarding/use-wizard-persistence.ts` - sessionStorage hook with debounced writes and clearWizardStorage
- `src/lib/validators/onboarding.ts` - Added industrySchema, companyBasicsSchema, serviceAreaSchema, specializationsSchema, leadPreferencesSchema, reviewSchema, getStepSchema()
- `src/components/onboarding/wizard-shell.tsx` - Rewritten: useReducer, persistence, 6-step progress, step routing, validation
- `src/components/onboarding/steps/industry-selection.tsx` - Step 1: 5 industry cards with icons and selection state
- `src/components/onboarding/steps/company-basics.tsx` - Step 2: company fields + Google Places autocomplete with manual fallback
- `src/app/(onboarding)/onboarding/page.tsx` - Title rebrand from HeavyLeads to LeadForge

## Decisions Made
- **Zod v4 API for z.enum:** The project uses Zod v4, which requires `{ message: "..." }` instead of the Zod v3 `{ required_error: "..." }` parameter. Adapted the industrySchema accordingly.
- **Google Places per-step scope:** APIProvider wraps only the CompanyBasics step rather than the entire wizard, avoiding unnecessary Google Maps JS loading on non-address steps.
- **Backward-compat validator exports:** All existing exports (onboardingSchema, locationSchema, equipmentSchema, radiusSchema, US_STATES, composeAddress, OnboardingFormData) are preserved since the old completeOnboarding server action and StepLocation/StepEquipment/StepRadius components still import them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 z.enum error message parameter**
- **Found during:** Task 1 (Zod schema creation)
- **Issue:** Plan specified `required_error` parameter for z.enum, but project uses Zod v4 which uses `message` instead
- **Fix:** Changed `{ required_error: "Please select your industry" }` to `{ message: "Please select your industry" }`
- **Files modified:** src/lib/validators/onboarding.ts
- **Verification:** `npx tsc --noEmit` passes for validators file
- **Committed in:** 5f2d4dd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API adaptation for Zod v4 compat. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in tests/leads/bookmarks*.test.ts and tests/leads/lead-status.test.ts (mock type mismatches). Unrelated to this plan's changes, documented in Phase 13 summary as well.

## User Setup Required
None - no external service configuration required. Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) already configured; CompanyBasics gracefully falls back to manual address entry if missing.

## Next Phase Readiness
- All shared contracts (types, reducer, schemas, config) are in place for Plan 02 to build steps 3-6
- Steps 3-6 render placeholders in the current wizard, ready to be swapped for real components
- wizardReducer and useWizardPersistence handle the full WizardState, no changes needed for Plan 02
- getStepSchema() already returns schemas for all 6 steps

## Self-Check: PASSED

All 9 key files verified present. Both task commits (5f2d4dd, 198253a) verified in git log.

---
*Phase: 14-industry-onboarding*
*Completed: 2026-03-16*
