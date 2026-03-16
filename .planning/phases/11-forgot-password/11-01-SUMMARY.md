---
phase: 11-forgot-password
plan: 01
subsystem: auth
tags: [better-auth, resend, react-email, zod, forgot-password, password-reset]

# Dependency graph
requires:
  - phase: 09-test-foundations
    provides: test infrastructure (vitest, jsdom, testing-library)
provides:
  - forgotPasswordSchema and resetPasswordSchema Zod validation schemas
  - PasswordResetEmail react-email template with HeavyLeads branding
  - sendResetPassword callback in auth.ts emailAndPassword config (Resend integration)
  - ForgotPasswordForm component with generic success message (anti-enumeration)
  - /forgot-password page route under (auth) layout
  - "Forgot password?" link on sign-in page
affects: [11-forgot-password]

# Tech tracking
tech-stack:
  added: ["@testing-library/user-event"]
  patterns: [vi.hoisted for mock function references in vi.mock factories, class-based mock for Resend constructor]

key-files:
  created:
    - src/components/emails/password-reset.tsx
    - src/components/auth/forgot-password-form.tsx
    - src/app/(auth)/forgot-password/page.tsx
    - tests/auth/send-reset-password.test.ts
    - tests/auth/forgot-password-form.test.tsx
    - tests/auth/sign-in-forgot-link.test.tsx
  modified:
    - src/lib/validators/auth.ts
    - src/lib/auth.ts
    - src/components/auth/sign-in-form.tsx

key-decisions:
  - "Resend client instantiated inside sendResetPassword callback, not at module top level (per project rule: no side-effect imports in auth.ts)"
  - "Missing RESEND_API_KEY throws error on password reset (critical path -- unlike digest which silently skips)"
  - "Generic success message on forgot-password prevents user enumeration"
  - "vi.hoisted() pattern for mock references used in vi.mock factories"
  - "class-based mock for Resend constructor (vi.fn mockImplementation arrow functions fail with new)"

patterns-established:
  - "vi.hoisted() for mock references in component test vi.mock factories"
  - "fireEvent.change for type=email inputs in jsdom (userEvent.type has quirks)"

requirements-completed: [AUTH-01]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 11 Plan 01: Forgot Password Request Flow Summary

**Forgot-password request flow with Zod validation, branded Resend email template, better-auth sendResetPassword config, and anti-enumeration form**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T05:38:52Z
- **Completed:** 2026-03-16T05:44:59Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Validation schemas (forgotPasswordSchema, resetPasswordSchema) added to shared validators
- PasswordResetEmail react-email template with HeavyLeads branding and 1-hour expiry notice
- auth.ts configured with sendResetPassword callback that sends branded email via Resend
- ForgotPasswordForm with generic success message preventing user enumeration
- /forgot-password page route accessible from sign-in page via "Forgot password?" link
- 16 tests across 3 test files all passing

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1: Validation schemas, email template, and sendResetPassword config**
   - `a9429dc` (test) - Failing tests for schemas, email template, sendResetPassword
   - `a7e5cc7` (feat) - Implementation: schemas, email template, auth.ts config

2. **Task 2: Forgot password form, page route, and sign-in link**
   - `18ba6c8` (test) - Failing tests for forgot-password form and sign-in link
   - `c9fba8e` (feat) - Implementation: form, page, sign-in link

## Files Created/Modified
- `src/lib/validators/auth.ts` - Added forgotPasswordSchema and resetPasswordSchema with types
- `src/components/emails/password-reset.tsx` - React Email template for password reset
- `src/lib/auth.ts` - Added sendResetPassword callback, resetPasswordTokenExpiresIn, revokeSessionsOnPasswordReset
- `src/components/auth/forgot-password-form.tsx` - Forgot password form with anti-enumeration success message
- `src/app/(auth)/forgot-password/page.tsx` - Server component page route
- `src/components/auth/sign-in-form.tsx` - Added "Forgot password?" link
- `tests/auth/send-reset-password.test.ts` - Schema, email template, and sendResetPassword tests (10 tests)
- `tests/auth/forgot-password-form.test.tsx` - Form render, validation, success, loading tests (5 tests)
- `tests/auth/sign-in-forgot-link.test.tsx` - Sign-in forgot password link test (1 test)

## Decisions Made
- Resend client instantiated inside sendResetPassword callback, not at module top level (per project rule: no side-effect imports in auth.ts)
- Missing RESEND_API_KEY throws error on password reset (critical path -- unlike digest which silently skips)
- Generic success message on forgot-password prevents user enumeration ("If an account exists...")
- Used vi.hoisted() pattern for mock references in vi.mock factories (required by vitest hoisting)
- Class-based mock for Resend constructor (arrow function mocks fail with `new`)
- fireEvent.change used for type="email" inputs in jsdom (userEvent.type has quirks)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @testing-library/user-event**
- **Found during:** Task 2
- **Issue:** @testing-library/user-event not installed, test file could not resolve import
- **Fix:** Ran `npm install --save-dev @testing-library/user-event`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import resolves, all tests pass
- **Committed in:** c9fba8e (Task 2 commit)

**2. [Rule 1 - Bug] Fixed vi.mock hoisting for mockRequestPasswordReset**
- **Found during:** Task 2
- **Issue:** `mockRequestPasswordReset` referenced in vi.mock factory before initialization (vitest hoists vi.mock calls)
- **Fix:** Used `vi.hoisted()` to declare mock function before vi.mock hoisting
- **Files modified:** tests/auth/forgot-password-form.test.tsx
- **Verification:** All 5 form tests pass
- **Committed in:** c9fba8e (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Resend constructor mock**
- **Found during:** Task 1
- **Issue:** `vi.fn().mockImplementation(() => ...)` creates arrow function mock, fails with `new` keyword
- **Fix:** Used class-based mock `class MockResend { emails = { send: mockSend }; }`
- **Files modified:** tests/auth/send-reset-password.test.ts
- **Verification:** All 10 tests pass including sendResetPassword callback test
- **Committed in:** a7e5cc7 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking dependency)
**Impact on plan:** All auto-fixes necessary for test infrastructure correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. RESEND_API_KEY and RESEND_FROM_EMAIL are pre-existing environment variables.

## Next Phase Readiness
- Password reset request flow is complete -- user can initiate reset from sign-in page
- resetPasswordSchema is ready for plan 02 (reset password page)
- auth.ts is fully configured with token expiry and session revocation
- Plan 02 will implement the /reset-password page where users set their new password

## Self-Check: PASSED

All 10 files verified present. All 4 commits verified in git log.

---
*Phase: 11-forgot-password*
*Completed: 2026-03-16*
