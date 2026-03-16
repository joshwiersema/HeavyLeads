---
phase: 14-industry-onboarding
plan: 03
subsystem: payments
tags: [stripe, webhook, react-email, resend, billing, onboarding]

# Dependency graph
requires:
  - phase: 14-industry-onboarding
    plan: 02
    provides: completeOnboarding server action saving all wizard fields, WizardState type, 6-step onboarding wizard
  - phase: 13-schema-foundation
    provides: organization industry column, organization_profiles with expanded columns
provides:
  - Industry-specific Stripe pricing configuration with per-industry setup fee and monthly price IDs
  - Stripe webhook endpoint handling checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted
  - WelcomeEmail React Email template sent on onboarding completion
  - buildCheckoutSessionParams updated for per-industry pricing
  - atomicSignUp accepts optional industry parameter
affects: [15-lead-scoring, 16-billing-portal]

# Tech tracking
tech-stack:
  added: []
  patterns: [industry-specific-stripe-pricing, standalone-stripe-webhook, dynamic-import-resend, non-blocking-email-send]

key-files:
  created:
    - src/lib/billing/config.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/components/emails/welcome.tsx
  modified:
    - src/lib/billing.ts
    - src/lib/auth.ts
    - src/actions/onboarding.ts
    - src/actions/signup.ts

key-decisions:
  - "Stripe v20 invoice.parent.subscription_details.subscription path instead of deprecated invoice.subscription -- helper function abstracts the extraction"
  - "Webhook returns 200 even on processing errors to prevent Stripe retry loops -- errors logged for investigation"
  - "Welcome email uses dynamic import of Resend and WelcomeEmail to avoid module-level side effects (matches established auth.ts pattern)"
  - "Industry pricing falls back to generic STRIPE_MONTHLY_PRICE_ID/STRIPE_SETUP_FEE_PRICE_ID when industry-specific env vars not set"

patterns-established:
  - "getSubscriptionIdFromInvoice helper: extracts subscription ID from Stripe v20 Invoice.parent.subscription_details"
  - "Non-blocking email pattern: try/catch around Resend send, log error but return success regardless"

requirements-completed: [BILL-01v3, BILL-03v3, NOTF-06]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 14 Plan 03: Billing & Notifications Summary

**Industry-specific Stripe pricing config with per-vertical setup/monthly fees, standalone webhook for subscription lifecycle events, and branded welcome email on onboarding completion**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T17:58:07Z
- **Completed:** 2026-03-16T18:02:56Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Created industry-specific pricing configuration with per-industry setup fee and monthly price IDs, falling back to generic env vars when industry-specific ones are not set
- Built standalone Stripe webhook endpoint handling 4 event types: checkout.session.completed (monitoring), invoice.paid (mark active), invoice.payment_failed (mark past_due), customer.subscription.deleted (mark canceled)
- Created branded WelcomeEmail React Email template with industry-specific content, matching existing password-reset email styling
- Wired welcome email send into completeOnboarding (non-blocking, best-effort with dynamic Resend import)
- Updated buildCheckoutSessionParams and auth.ts getCheckoutSessionParams to use per-industry pricing based on organization's industry
- Updated atomicSignUp to accept optional industry parameter for future sign-up form integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Industry pricing config, webhook route, billing integration** - `0b6aab8` (feat)
2. **Task 2: Welcome email, onboarding email send, signup industry param** - `d0de7bc` (feat)

## Files Created/Modified
- `src/lib/billing/config.ts` - Industry-specific pricing: INDUSTRY_PRICING record with 5 industries, getIndustryPricing helper with fallback
- `src/app/api/webhooks/stripe/route.ts` - Standalone Stripe webhook: signature verification, 4 event handlers, error-tolerant 200 responses
- `src/components/emails/welcome.tsx` - Welcome email template: branded header, numbered next-steps list, dashboard CTA button
- `src/lib/billing.ts` - Updated buildCheckoutSessionParams: accepts optional industry, uses getIndustryPricing for per-industry line items
- `src/lib/auth.ts` - Updated getCheckoutSessionParams callback: queries organization industry, passes to buildCheckoutSessionParams
- `src/actions/onboarding.ts` - Added welcome email send after profile upsert (dynamic import, non-blocking try/catch)
- `src/actions/signup.ts` - Added optional industry parameter to atomicSignUp with heavy_equipment fallback

## Decisions Made
- **Stripe v20 compatibility:** invoice.subscription was removed in Stripe v20+. Created getSubscriptionIdFromInvoice helper that reads from invoice.parent.subscription_details.subscription instead.
- **Webhook error tolerance:** Returns HTTP 200 even when event processing fails internally. This prevents Stripe from endlessly retrying failed events while errors are logged for investigation.
- **Dynamic imports for email:** Both Resend and WelcomeEmail are imported dynamically inside the try/catch block, following the established pattern from auth.ts sendResetPassword to avoid module-level side effects.
- **Pricing fallback chain:** Each industry's pricing falls back to generic env vars (STRIPE_MONTHLY_PRICE_ID, STRIPE_SETUP_FEE_PRICE_ID) when industry-specific ones are not configured. The getIndustryPricing function further falls back to heavy_equipment pricing for unknown industries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe v20 Invoice type incompatibility**
- **Found during:** Task 1 (Webhook route creation)
- **Issue:** Plan used `invoice.subscription` which was removed in Stripe v20. TypeScript reported `Property 'subscription' does not exist on type 'Invoice'`.
- **Fix:** Created `getSubscriptionIdFromInvoice()` helper that reads from `invoice.parent?.subscription_details?.subscription` and handles both string and expanded Subscription object.
- **Files modified:** src/app/api/webhooks/stripe/route.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors in src/ files
- **Committed in:** 0b6aab8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for type-safety with the installed Stripe v20 library. No scope creep.

## Issues Encountered
None beyond the Stripe v20 type change documented above.

## User Setup Required
None - no new external service configuration required. Existing STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, and STRIPE_*_PRICE_ID env vars are already configured. Industry-specific pricing env vars are optional and fall back to existing generic ones.

## Next Phase Readiness
- All Phase 14 plans complete: onboarding wizard (6 steps), industry-specific pricing, webhook handler, welcome email
- Industry selection flows through signup -> onboarding -> billing checkout
- Subscription lifecycle events properly tracked via webhook
- Ready for Phase 15 (lead scoring) or Phase 16 (billing portal)

## Self-Check: PASSED

All 7 key files verified present. Both task commits (0b6aab8, d0de7bc) verified in git log.

---
*Phase: 14-industry-onboarding*
*Completed: 2026-03-16*
