---
phase: 06-billing-and-launch-readiness
plan: 01
subsystem: payments
tags: [stripe, better-auth, subscriptions, billing, access-gate, drizzle]

# Dependency graph
requires:
  - phase: 01-platform-foundation
    provides: Better Auth with organization plugin, dashboard layout with guard chain
provides:
  - "@better-auth/stripe plugin wired into auth config with subscription plans"
  - "Stripe client instance and price ID constants (src/lib/stripe.ts)"
  - "Subscription table schema for Drizzle query access"
  - "getActiveSubscription server-side billing helper"
  - "Dashboard subscription access gate redirecting to /billing"
  - "Wave 0 test stubs for checkout, webhook, and access-gate billing behaviors"
affects: [06-billing-and-launch-readiness]

# Tech tracking
tech-stack:
  added: ["@better-auth/stripe@1.5.5", "stripe@^20.4.1", "@stripe/stripe-js@^8.9.0"]
  patterns: ["Better Auth plugin composition (stripe before nextCookies)", "Subscription access gate pattern in dashboard layout", "getCheckoutSessionParams for conditional setup fee"]

key-files:
  created:
    - src/lib/stripe.ts
    - src/lib/billing.ts
    - src/lib/db/schema/subscriptions.ts
    - tests/helpers/billing.ts
    - tests/billing/checkout.test.ts
    - tests/billing/webhook.test.ts
    - tests/billing/access-gate.test.ts
  modified:
    - src/lib/auth.ts
    - src/lib/auth-client.ts
    - src/lib/db/schema/auth.ts
    - src/lib/db/schema/index.ts
    - src/app/(dashboard)/layout.tsx
    - package.json

key-decisions:
  - "Used Stripe API version 2026-02-25.clover (matched installed SDK version, not research-suggested 2025-11-17)"
  - "getCheckoutSessionParams returns { params: { line_items } } per actual plugin API (differs from plan's direct { line_items } return)"
  - "First-time subscriber detection via !subscription.stripeSubscriptionId (plan suggested !subscription but callback always receives subscription object)"
  - "Added stripeCustomerId columns to user and organization tables per plugin schema requirements"
  - "Redirect target is /billing (separate route group) to avoid dashboard layout redirect loop"

patterns-established:
  - "Billing access gate: auth -> org -> onboarding -> subscription guard chain in dashboard layout"
  - "Subscription query helper in src/lib/billing.ts for reuse across server components and actions"

requirements-completed: [PLAT-05]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 6 Plan 01: Stripe Billing Infrastructure Summary

**Better Auth Stripe plugin with subscription access gate, conditional setup fee via getCheckoutSessionParams, and Wave 0 test stubs for checkout/webhook/access-gate behaviors**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T20:29:24Z
- **Completed:** 2026-03-14T20:35:50Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Installed @better-auth/stripe plugin with organization integration and subscription plan configuration
- Created subscription table schema matching plugin's internal schema for Drizzle query access
- Added dashboard subscription access gate as the final guard before rendering (auth -> org -> onboarding -> subscription)
- Created billing helper (getActiveSubscription) for server-side subscription status checks
- Wave 0 test stubs created for all PLAT-05 sub-requirements (checkout, webhook, access-gate)

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs for billing behaviors** - `5f2515b` (test)
2. **Task 1: Install Stripe packages and configure Better Auth Stripe plugin** - `594ca15` (feat)
3. **Task 2: Add subscription access gate to dashboard layout and create billing helper** - `74a178a` (feat)

## Files Created/Modified
- `src/lib/stripe.ts` - Stripe client instance with API version and price ID constants
- `src/lib/billing.ts` - getActiveSubscription helper querying subscription table for active/trialing status
- `src/lib/db/schema/subscriptions.ts` - Drizzle pgTable definition for Better Auth Stripe plugin's subscription table
- `src/lib/auth.ts` - Added stripe plugin with subscription plans and getCheckoutSessionParams for setup fee
- `src/lib/auth-client.ts` - Added stripeClient plugin with subscription hooks
- `src/lib/db/schema/auth.ts` - Added stripeCustomerId to user and organization tables
- `src/lib/db/schema/index.ts` - Added subscriptions re-export
- `src/app/(dashboard)/layout.tsx` - Added subscription access gate after onboarding check
- `tests/helpers/billing.ts` - Mock subscription and Stripe event factories
- `tests/billing/checkout.test.ts` - Todo stubs for checkout session setup fee logic
- `tests/billing/webhook.test.ts` - Todo stubs for webhook-driven subscription status updates
- `tests/billing/access-gate.test.ts` - Concrete tests for getActiveSubscription (5 passing)

## Decisions Made
- **Stripe API version:** Used `2026-02-25.clover` matching the installed SDK version (plan specified `2025-11-17.clover` which was from research but outdated by SDK release)
- **getCheckoutSessionParams signature:** Returns `{ params: Stripe.Checkout.SessionCreateParams }` per actual plugin type definitions. Plan suggested returning `{ line_items: [...] }` directly, which doesn't match the API
- **First-time detection:** Used `!subscription.stripeSubscriptionId` since the callback always receives a subscription object (never null/undefined). A newly created incomplete subscription has no stripeSubscriptionId yet; a re-subscriber would
- **Schema additions:** Added stripeCustomerId to both user and organization tables as the plugin requires these fields for customer lifecycle management
- **Redirect target:** `/billing` (not `/settings/billing`) to use a separate route group and avoid dashboard layout redirect loops, following the same pattern as onboarding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe API version mismatch**
- **Found during:** Task 1
- **Issue:** Plan specified API version "2025-11-17.clover" but installed Stripe SDK v20.4+ expects "2026-02-25.clover"
- **Fix:** Updated to "2026-02-25.clover" to match SDK type definitions
- **Files modified:** src/lib/stripe.ts
- **Verification:** TypeScript compiles without error
- **Committed in:** 594ca15

**2. [Rule 1 - Bug] Fixed getCheckoutSessionParams return type**
- **Found during:** Task 1
- **Issue:** Plan returned `{ line_items: [...] }` but actual plugin API expects `{ params?: Stripe.Checkout.SessionCreateParams }`
- **Fix:** Wrapped return in `{ params: { line_items: [...] } }` per plugin type definitions
- **Files modified:** src/lib/auth.ts
- **Verification:** TypeScript compiles without error
- **Committed in:** 594ca15

**3. [Rule 1 - Bug] Fixed first-time subscriber detection logic**
- **Found during:** Task 1
- **Issue:** Plan checked `!subscription` but the callback always receives a subscription object (never null). The subscription is created as "incomplete" before the callback fires
- **Fix:** Check `!subscription.stripeSubscriptionId` instead -- incomplete subscriptions have no Stripe subscription ID yet
- **Files modified:** src/lib/auth.ts
- **Verification:** Logic matches plugin source code flow (subscription created on line 934, callback on line 948)
- **Committed in:** 594ca15

**4. [Rule 2 - Missing Critical] Added stripeCustomerId to user and organization schemas**
- **Found during:** Task 1
- **Issue:** Plugin schema requires stripeCustomerId on both user and organization tables for customer lifecycle. Without these columns, createCustomerOnSignUp would fail at runtime
- **Fix:** Added stripeCustomerId text columns to user and organization tables in auth.ts schema
- **Files modified:** src/lib/db/schema/auth.ts
- **Verification:** TypeScript compiles; schema matches plugin type definitions
- **Committed in:** 594ca15

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness. The plan's code snippets were based on research assumptions about the plugin API; actual implementation required adjustments to match the installed plugin's type definitions and source behavior. No scope creep.

## Issues Encountered
- `npx @better-auth/cli generate` failed because STRIPE_SECRET_KEY is not set in the development environment (Stripe client instantiation fails at import time). Manually created the subscription schema from plugin type definitions instead. This is expected when env vars aren't configured yet.
- `npx drizzle-kit push` was skipped since no DATABASE_URL is available in this execution environment. Schema will sync on next deployment or when developer runs it locally.

## User Setup Required

**External services require manual configuration.** The following environment variables must be set before the billing system functions:

- `STRIPE_SECRET_KEY` - Stripe Dashboard -> Developers -> API keys -> Secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe Dashboard -> Developers -> Webhooks -> Signing secret
- `STRIPE_MONTHLY_PRICE_ID` - Create "HeavyLeads Standard" product -> Add recurring monthly price -> Copy price ID
- `STRIPE_SETUP_FEE_PRICE_ID` - Same product -> Add one-time setup fee price -> Copy price ID
- `NEXT_PUBLIC_APP_URL` - Your deployed app URL or http://localhost:3000

**Dashboard setup:**
1. Create "HeavyLeads Standard" product with two prices (recurring monthly + one-time setup fee)
2. Create webhook endpoint: `{APP_URL}/api/auth/stripe/webhook` with events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted

**Schema migration:**
Run `npx drizzle-kit push` after setting DATABASE_URL to sync the subscription table and new columns to the database.

## Next Phase Readiness
- Stripe plugin fully wired into auth -- ready for billing UI in Plan 02
- Subscription table schema defined -- ready for Drizzle queries
- Access gate in place -- users without subscription redirect to /billing
- Plan 02 needs to create the /billing page (route group) and subscribe/manage UI components

## Self-Check: PASSED

All 8 created files verified present. All 3 task commits verified in git log.

---
*Phase: 06-billing-and-launch-readiness*
*Completed: 2026-03-14*
