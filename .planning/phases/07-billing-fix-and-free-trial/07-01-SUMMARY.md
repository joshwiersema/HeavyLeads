---
phase: 07-billing-fix-and-free-trial
plan: 01
subsystem: payments
tags: [stripe, better-auth, free-trial, billing, subscription]

# Dependency graph
requires:
  - phase: 06-billing-and-launch-readiness
    provides: Stripe plugin integration, subscription schema, billing page components
provides:
  - Fixed createCustomerOnSignUp: false for org-level billing (BILL-01)
  - 7-day free trial via freeTrial plan config (BILL-02)
  - Conditional setup fee exclusion during trial checkout (BILL-05)
  - getTrialStatus utility for computing trial state from subscription data
  - buildCheckoutSessionParams extracted as testable pure function
  - STRIPE_PLUGIN_CONFIG and SUBSCRIPTION_PLANS exported for test verification
affects: [07-02-trial-ui, billing-page, dashboard-layout]

# Tech tracking
tech-stack:
  added: []
  patterns: [exported-config-constants-for-testability, pure-function-checkout-params-builder]

key-files:
  created:
    - tests/billing/auth-config.test.ts
    - tests/billing/billing-utils.test.ts
    - tests/billing/checkout-params.test.ts
  modified:
    - src/lib/auth.ts
    - src/lib/billing.ts
    - src/components/billing/subscribe-button.tsx
    - tests/billing/billing-page.test.tsx
    - tests/setup.ts

key-decisions:
  - "Exported STRIPE_PLUGIN_CONFIG and SUBSCRIPTION_PLANS constants from auth.ts for testability rather than testing via plugin instantiation"
  - "Extracted buildCheckoutSessionParams as a pure function in billing.ts rather than keeping inline in auth.ts getCheckoutSessionParams callback"
  - "Trial checkout returns empty params so plugin uses default line_items + trial_period_days; setup fee only added for post-trial conversion"

patterns-established:
  - "Config constants export pattern: export const STRIPE_PLUGIN_CONFIG and SUBSCRIPTION_PLANS alongside the auth object for unit-testable config verification"
  - "Pure function extraction: buildCheckoutSessionParams extracted from async callback for direct unit testing without mocking plugin internals"

requirements-completed: [BILL-01, BILL-02, BILL-05]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 7 Plan 01: Billing Fix and Free Trial Config Summary

**Fixed Stripe customer creation bug (createCustomerOnSignUp: false), added 7-day free trial with conditional setup fee exclusion, and getTrialStatus utility**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T20:02:52Z
- **Completed:** 2026-03-15T20:07:12Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Fixed production-breaking Stripe customer creation error by setting createCustomerOnSignUp to false (BILL-01)
- Configured 7-day free trial on the standard plan via freeTrial: { days: 7 } (BILL-02)
- Implemented conditional setup fee logic: excluded during trial, included for post-trial conversion (BILL-05)
- Added getTrialStatus pure function for trial countdown UI (foundation for Plan 02)
- Updated subscribe button text from "Subscribe Now" to "Start Free Trial"
- All 28 billing tests pass with 11 new tests covering config, trial utility, and checkout params

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs** - `ed338a9` (test) - TDD RED: 11 failing tests across 3 files
2. **Task 1: Fix auth config, add trial, implement utilities** - `992e478` (feat) - TDD GREEN: all 11 tests pass
3. **Task 2: Update subscribe button text** - `80b5b40` (feat) - Button text + test updates

## Files Created/Modified
- `src/lib/auth.ts` - Fixed createCustomerOnSignUp, added freeTrial config, exported testable constants
- `src/lib/billing.ts` - Added getTrialStatus, TrialStatus interface, buildCheckoutSessionParams
- `src/components/billing/subscribe-button.tsx` - Changed button text to "Start Free Trial"
- `tests/billing/auth-config.test.ts` - Tests for BILL-01 and BILL-02 config verification
- `tests/billing/billing-utils.test.ts` - Tests for getTrialStatus with 5 cases (active, expired, null, no-trial, ceil)
- `tests/billing/checkout-params.test.ts` - Tests for BILL-05 setup fee conditional logic
- `tests/billing/billing-page.test.tsx` - Updated SubscribeButton test assertions for new text
- `tests/setup.ts` - Added Stripe env vars for test imports

## Decisions Made
- Exported STRIPE_PLUGIN_CONFIG and SUBSCRIPTION_PLANS as named constants from auth.ts rather than testing through plugin instantiation. This avoids needing to mock the entire Better Auth server in config tests.
- Extracted buildCheckoutSessionParams as a synchronous pure function in billing.ts rather than keeping the logic inline in auth.ts. This makes the checkout params logic directly unit-testable without async callback mocking.
- Trial checkout returns empty params ({}) so the plugin handles default line_items and trial_period_days. Setup fee is only included for post-trial first-time paid conversion where line_items must override defaults with both the recurring price and setup fee.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- getTrialStatus utility is ready for Plan 02 to build the trial countdown banner and trial-ended messaging
- SUBSCRIPTION_PLANS export available for any future plan config tests
- buildCheckoutSessionParams handles all checkout scenarios (trial, post-trial, existing subscriber)

## Self-Check: PASSED

All 9 files verified present. All 3 task commits verified in git log.

---
*Phase: 07-billing-fix-and-free-trial*
*Completed: 2026-03-15*
