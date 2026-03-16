---
phase: 13-schema-foundation
plan: 02
subsystem: auth
tags: [better-auth, zod, server-actions, atomic-signup, confirm-password, billing]

# Dependency graph
requires:
  - phase: 13-schema-foundation
    provides: organization industry column in schema
provides:
  - Atomic sign-up server action with cleanup on partial failure
  - Confirm password validation on sign-up form
  - Specific error messages for email-in-use, password-too-weak, org-name-taken
  - Sign-in redirect to /dashboard (not /)
  - Better Auth org plugin configured with industry additionalFields
  - Billing checkout params documented as correct
affects: [14-onboarding, 15-scoring]

# Tech tracking
tech-stack:
  added: [server-actions-for-auth]
  patterns: [atomic-multi-step-with-cleanup, error-message-mapping-by-specificity]

key-files:
  created:
    - src/actions/signup.ts
    - tests/auth/atomic-signup.test.ts
    - tests/auth/confirm-password.test.tsx
    - tests/auth/signup-error-messages.test.tsx
  modified:
    - src/lib/auth.ts
    - src/lib/validators/auth.ts
    - src/components/auth/sign-up-form.tsx
    - src/components/auth/sign-in-form.tsx
    - src/lib/billing.ts
    - tests/regressions/sign-in-redirect.test.tsx
    - tests/billing/checkout-params.test.ts

key-decisions:
  - "Error message matching order: check specific patterns (slug/taken) before generic ones (UNIQUE/already/exists) to avoid false matches"
  - "Server action atomicSignUp cleans up in reverse creation order (org first, then user) on failure"
  - "BILL-02v3: Double-nested { params: { line_items } } format confirmed correct per @better-auth/stripe plugin source"

patterns-established:
  - "Atomic multi-step operations: use server actions with try/catch cleanup rather than client-side sequential API calls"
  - "Error specificity ordering: match most-specific error patterns first in cascading if/else"

requirements-completed: [AUTH-02v3, AUTH-03v3, AUTH-04v3, AUTH-05v3, BILL-02v3]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 13 Plan 02: Auth Hardening Summary

**Atomic sign-up server action with cleanup, confirm-password validation, specific error messages, and sign-in redirect fix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T17:20:29Z
- **Completed:** 2026-03-16T17:25:30Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments
- Moved 3-step client-side sign-up flow to single atomic server action with reverse-order cleanup on failure
- Added confirm password field to sign-up form with Zod `.refine()` validation
- Sign-up errors mapped to specific user-facing messages (email-in-use, password-too-weak, org-name-taken)
- Fixed sign-in redirect from `/` to `/dashboard`
- Better Auth org plugin configured with industry additionalFields for org creation API
- Documented billing checkout params structure as correct (not actually double-nested bug)
- 22 new tests added, all 454 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for atomic signup + confirm password** - `a4a3d8f` (test)
2. **Task 1 (GREEN): Auth config, validators, server action** - `93ff002` (feat)
3. **Task 2 (RED): Failing tests for signup error messages** - `f5938bf` (test)
4. **Task 2 (GREEN): Form refactor, sign-in fix, billing docs** - `6d1cb71` (feat)

_Note: Both tasks were TDD with RED (failing tests) and GREEN (implementation) commits_

## Files Created/Modified
- `src/actions/signup.ts` - New atomic sign-up server action with cleanup and error mapping
- `src/lib/auth.ts` - Added industry additionalFields to organization plugin config
- `src/lib/validators/auth.ts` - Added confirmPassword field with `.refine()` to signUpSchema
- `src/components/auth/sign-up-form.tsx` - Refactored to use atomicSignUp, added confirm password field
- `src/components/auth/sign-in-form.tsx` - Changed redirect from "/" to "/dashboard"
- `src/lib/billing.ts` - Added BILL-02v3 documentation comment on return format
- `tests/auth/atomic-signup.test.ts` - 5 tests for server action success/failure/cleanup paths
- `tests/auth/confirm-password.test.tsx` - 4 tests for confirmPassword schema validation
- `tests/auth/signup-error-messages.test.tsx` - 4 tests for error display in form
- `tests/regressions/sign-in-redirect.test.tsx` - Added /dashboard redirect assertion test
- `tests/billing/checkout-params.test.ts` - Added BILL-02v3 documentation comment

## Decisions Made
- **Error matching order matters:** The "slug"/"taken" check must run before "UNIQUE"/"already"/"exists" because org-name-taken errors can contain "UNIQUE" which would falsely match the email-in-use branch. Fixed by ordering specific patterns before generic ones.
- **BILL-02v3 is not a bug:** The double-nested `{ params: { line_items } }` return format is correct. The `@better-auth/stripe` plugin reads `result.params` and spreads it into `stripe.checkout.sessions.create()`. Documented with comments instead of changing logic.
- **Server action over client-side calls:** Moving sign-up to a server action gives full cleanup capability since the server has direct DB access to delete orphaned records.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed error message matching order in atomicSignUp**
- **Found during:** Task 1 (GREEN phase, test verification)
- **Issue:** The plan's error matching code checked `msg.includes("UNIQUE")` in the email-in-use branch before the slug/taken branch. This caused "UNIQUE constraint failed: slug taken" to incorrectly match as email-in-use.
- **Fix:** Reordered the error matching: slug/taken checks first, then password, then the generic already/exists/UNIQUE check last.
- **Files modified:** src/actions/signup.ts
- **Verification:** All 5 atomic-signup tests pass including org-name-taken error mapping
- **Committed in:** 93ff002 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Error matching order fix necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test mock types (bookmarks-batch, bookmarks, lead-status, pagination, saved-searches tests) remain unchanged -- not introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth hardening complete: atomic sign-up, confirm password, error messages, redirect fix all in place
- Schema + auth foundations for v3.0 are now complete (Phase 13 done)
- Ready for Phase 14 (onboarding flow) which will build on the sign-up redirect to /onboarding

## Self-Check: PASSED

All 11 key files verified present. All 4 task commits verified in git log.

---
*Phase: 13-schema-foundation*
*Completed: 2026-03-16*
