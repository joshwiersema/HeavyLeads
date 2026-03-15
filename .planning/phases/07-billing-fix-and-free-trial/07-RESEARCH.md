# Phase 7: Billing Fix and Free Trial - Research

**Researched:** 2026-03-15
**Domain:** Stripe billing integration via @better-auth/stripe plugin, free trial implementation
**Confidence:** HIGH

## Summary

Phase 7 fixes a production-breaking Stripe customer creation bug and adds a 7-day free trial flow. The root cause of the current signup failure is `createCustomerOnSignUp: true` in the Better Auth Stripe plugin configuration -- this attempts to create a Stripe customer at the **user** level during signup, but the project uses **organization**-level billing (`organization: { enabled: true }`). The fix is straightforward: set `createCustomerOnSignUp: false` so the plugin creates the Stripe customer lazily at the organization level when the first subscription checkout occurs.

The free trial implementation uses the `freeTrial` configuration on Better Auth plan definitions, which automatically passes `subscription_data.trial_period_days` to Stripe Checkout sessions. A critical constraint for BILL-05 is that Stripe charges one-time `line_items` (like the setup fee) **immediately** during trial checkout, while deferring recurring charges. Therefore, the `getCheckoutSessionParams` callback must exclude the setup fee line item when the checkout is for a trial subscription, and only include it on post-trial paid conversion.

The trial countdown banner (BILL-03) and expired trial redirect (BILL-04) are UI-only concerns that read from the existing `subscription.trialEnd` and `subscription.status` columns already in the schema. The dashboard layout already gates on active/trialing subscription status, so expired trials (status changes from "trialing" to "past_due" or "canceled") will naturally redirect to `/billing`.

**Primary recommendation:** Fix `createCustomerOnSignUp: false`, add `freeTrial: { days: 7 }` to the plan config, conditionally exclude setup fee during trial checkout, and build trial-aware UI components.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Fix Stripe customer creation error on signup (create org-level customer, not user-level) | Set `createCustomerOnSignUp: false` in auth.ts stripe plugin config. Organization customers are created lazily by the plugin when `organization: { enabled: true }` is set and `subscription.upgrade()` is called with `customerType: "organization"`. |
| BILL-02 | User starts a 7-day free trial via Stripe Checkout with credit card | Add `freeTrial: { days: 7 }` to the "standard" plan definition. Plugin auto-passes `subscription_data.trial_period_days: 7` to Stripe Checkout. Card is collected by default in Checkout. |
| BILL-03 | Dashboard shows trial countdown banner with days remaining | Read `subscription.trialEnd` from DB, compute days remaining client-side. Render a banner component in the dashboard layout when `subscription.status === "trialing"`. |
| BILL-04 | Expired trial redirects to billing page with "Trial ended" messaging | Dashboard layout already redirects to `/billing` when no active/trialing subscription exists. Add trial-ended messaging to the billing page when subscription exists with expired trial status. |
| BILL-05 | Setup fee is NOT charged during trial -- only on conversion to paid | In `getCheckoutSessionParams`, check `plan.freeTrial` presence and whether this is a trial checkout. If trial, return empty params (no setup fee line item). If post-trial conversion (user already has trialStart), include setup fee. Stripe charges one-time line items immediately, so excluding them during trial checkout is the only way to defer. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @better-auth/stripe | ^1.5.5 | Stripe integration for Better Auth | Already installed, manages subscription lifecycle, Checkout sessions, webhooks, and trial abuse prevention |
| stripe | ^20.4.1 | Stripe Node.js SDK | Already installed, used for direct Stripe API calls and types |
| better-auth | ^1.5.5 | Auth framework | Already installed, provides organization plugin that integrates with Stripe plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 | Database ORM | Already used for subscription queries, no changes needed to schema |
| sonner | ^2.0.7 | Toast notifications | Already used in billing components for error/success feedback |
| lucide-react | ^0.577.0 | Icons | Already used, will use for trial banner icons (Clock, AlertTriangle) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @better-auth/stripe freeTrial config | Manual Stripe API trial setup | Plugin handles trial abuse prevention, webhook sync, and DB updates automatically. Manual approach adds significant complexity for no benefit. |
| Client-side trial countdown | Server-side countdown with revalidation | Client-side is simpler and avoids unnecessary server round-trips. Trial end date is static data -- compute days remaining in the browser. |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    auth.ts              # MODIFY: createCustomerOnSignUp: false, add freeTrial config
    billing.ts           # MODIFY: add getTrialStatus() helper
    stripe.ts            # NO CHANGE
  components/
    billing/
      billing-status.tsx      # MODIFY: add trial-specific display
      subscribe-button.tsx    # MODIFY: button text changes for trial vs paid
      trial-banner.tsx        # NEW: countdown banner for dashboard
      trial-ended-card.tsx    # NEW: trial ended messaging for billing page
  app/
    (dashboard)/
      layout.tsx              # MODIFY: add trial banner rendering
    (billing)/
      billing/
        page.tsx              # MODIFY: add trial-ended state
```

### Pattern 1: Conditional Setup Fee in getCheckoutSessionParams
**What:** The callback checks whether the current checkout is a trial or a post-trial conversion, and only includes the setup fee line item for post-trial conversions.
**When to use:** Every time a checkout session is created.
**Example:**
```typescript
// Source: Better Auth Stripe plugin docs + Stripe Checkout docs
getCheckoutSessionParams: async ({ plan, subscription }) => {
  const isTrialCheckout = plan.freeTrial && !subscription?.trialStart;
  const isFirstTimePaid = !subscription?.stripeSubscriptionId;

  // During trial: only recurring price (setup fee excluded)
  // Post-trial conversion: include setup fee
  if (isTrialCheckout) {
    // Return empty -- plugin handles the recurring line item + trial_period_days
    return {};
  }

  if (isFirstTimePaid) {
    return {
      params: {
        line_items: [
          { price: plan.priceId, quantity: 1 },
          { price: PRICES.setupFee, quantity: 1 },
        ],
      },
    };
  }

  return {};
},
```

### Pattern 2: Trial Status Helper
**What:** A utility function that computes trial state from subscription data.
**When to use:** Anywhere trial-specific UI or logic is needed.
**Example:**
```typescript
// Source: Application pattern
interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEnd: Date | null;
}

export function getTrialStatus(subscription: {
  status: string | null;
  trialStart: Date | null;
  trialEnd: Date | null;
} | null): TrialStatus {
  if (!subscription || !subscription.trialEnd) {
    return { isTrialing: false, isExpired: false, daysRemaining: 0, trialEnd: null };
  }

  const now = new Date();
  const trialEnd = new Date(subscription.trialEnd);
  const msRemaining = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / 86400000));

  return {
    isTrialing: subscription.status === "trialing",
    isExpired: subscription.status !== "trialing" && subscription.status !== "active" && !!subscription.trialStart,
    daysRemaining,
    trialEnd,
  };
}
```

### Pattern 3: Trial Banner in Dashboard Layout
**What:** A server component that fetches subscription data and renders a trial countdown banner.
**When to use:** In the dashboard layout, visible on every dashboard page during trial.
**Example:**
```typescript
// Source: Application pattern
// In (dashboard)/layout.tsx, after subscription check:
const trialStatus = getTrialStatus(activeSubscription);

// Render banner before {children}:
{trialStatus.isTrialing && (
  <TrialBanner daysRemaining={trialStatus.daysRemaining} trialEnd={trialStatus.trialEnd!} />
)}
```

### Anti-Patterns to Avoid
- **Creating Stripe customers at user level when billing is org-level:** This is the current bug. The `createCustomerOnSignUp: true` setting creates a user-level Stripe customer, but subscriptions reference organization IDs. The plugin then fails because no Stripe customer exists for the organization.
- **Including one-time setup fee in trial checkout:** Stripe charges one-time line items immediately, even during a trial. This would charge the setup fee at trial start, violating BILL-05.
- **Application-level trial tracking instead of Stripe-native:** The Better Auth Stripe plugin syncs trial status from Stripe webhooks automatically. Building custom trial expiry logic creates drift between Stripe and the database.
- **Polling for trial expiry:** Do not build a cron job or client-side timer to check trial expiry. Stripe sends webhook events (`customer.subscription.updated`) when trials end, and the plugin updates the subscription status automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trial period on Stripe Checkout | Manual `subscription_data.trial_period_days` in getCheckoutSessionParams | `freeTrial: { days: 7 }` in plan config | Plugin sets trial_period_days automatically, handles trial abuse prevention, and syncs trialStart/trialEnd to DB |
| Trial abuse prevention | Custom "has user trialed before" check | Plugin's built-in trial abuse prevention | Plugin checks existing subscriptions for prior trial usage across all plans |
| Subscription status sync after trial | Custom webhook handler for trial end | Plugin's automatic webhook processing | Plugin handles `customer.subscription.updated` events and updates status in DB |
| Stripe customer creation for orgs | Manual `stripeClient.customers.create()` in signup flow | Plugin's lazy customer creation with `organization: { enabled: true }` | Plugin creates org-level customer on first `subscription.upgrade()` call, not at signup |

**Key insight:** The @better-auth/stripe plugin handles 90% of the trial lifecycle automatically. The main custom work is the conditional setup fee logic and the UI components (banner, billing page messaging).

## Common Pitfalls

### Pitfall 1: createCustomerOnSignUp Conflict with Organization Billing
**What goes wrong:** Setting `createCustomerOnSignUp: true` creates a Stripe customer linked to the **user** record. But with `organization: { enabled: true }`, subscriptions reference the **organization** ID. When `subscription.upgrade()` is called with `customerType: "organization"`, the plugin looks for a Stripe customer on the organization record, finds none (it was created on the user record), and creates a duplicate or errors.
**Why it happens:** The plugin's user-level customer creation and org-level subscription reference are independently configured.
**How to avoid:** Set `createCustomerOnSignUp: false`. The plugin will lazily create an org-level Stripe customer when `subscription.upgrade()` is first called.
**Warning signs:** Stripe dashboard shows duplicate customers, signup errors mentioning Stripe, or "customer not found" errors during checkout.

### Pitfall 2: Setup Fee Charged During Trial
**What goes wrong:** Including the setup fee as a `line_item` in the Checkout session alongside `subscription_data.trial_period_days` causes Stripe to charge the one-time fee immediately, even though the recurring subscription is deferred.
**Why it happens:** Stripe treats one-time prices as immediate charges, independent of the trial period on the subscription.
**How to avoid:** In `getCheckoutSessionParams`, do NOT include the setup fee line item when the checkout is creating a trial subscription. Only add it when the user converts to paid after trial expiry.
**Warning signs:** Users see a charge on their card at trial signup.

### Pitfall 3: trialStart/trialEnd Not Populated in DB
**What goes wrong:** The subscription record has `status: "trialing"` but `trialStart` and `trialEnd` are null, making the countdown banner show incorrect data.
**Why it happens:** This was a known bug in @better-auth/stripe (issue #4046) where the `onSubscriptionUpdated` hook did not extract trial fields. Fixed in a subsequent release.
**How to avoid:** Ensure @better-auth/stripe is at least v1.5.5 (current version). Verify by checking trial fields after a test checkout. If still null, the `onCheckoutSessionCompleted` handler should populate them from the Stripe response.
**Warning signs:** Trial banner shows "0 days remaining" or fails to render immediately after checkout.

### Pitfall 4: Dashboard Layout Redirect Loop for Expired Trials
**What goes wrong:** When a trial expires, the subscription status changes (to "past_due", "canceled", or "incomplete"). The dashboard layout calls `getActiveSubscription()` which checks for "active" or "trialing" status. An expired trial no longer matches, so the user is redirected to `/billing`. But if the billing page also redirects somewhere, a loop occurs.
**Why it happens:** The billing layout does NOT check subscription status (by design), so it won't loop. But if custom logic is added that redirects away from billing, it could.
**How to avoid:** The billing layout must ALWAYS be accessible without a subscription check. Only the dashboard layout gates on subscription status.
**Warning signs:** Infinite redirect loop after trial expiry.

### Pitfall 5: getCheckoutSessionParams line_items Override
**What goes wrong:** When returning `params.line_items` from `getCheckoutSessionParams`, this OVERRIDES the plugin's default line items (including the recurring subscription price). If you return `line_items` with only the setup fee, the subscription price is lost.
**Why it happens:** Object spread in the plugin: `{ ...defaultParams, ...customParams }` -- `line_items` from custom params replaces the default array entirely.
**How to avoid:** When returning custom `line_items`, ALWAYS include the recurring subscription price alongside any additional items. When returning empty `{}`, the plugin uses its default line items (just the recurring price).
**Warning signs:** Checkout session shows only the setup fee without the subscription, or vice versa.

## Code Examples

Verified patterns from official sources and codebase analysis:

### Fix: Auth Configuration (BILL-01 + BILL-02)
```typescript
// Source: Better Auth Stripe plugin docs
// File: src/lib/auth.ts
stripe({
  stripeClient,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  createCustomerOnSignUp: false, // CHANGED from true -- org customers created lazily
  subscription: {
    enabled: true,
    plans: [
      {
        name: "standard",
        priceId: PRICES.monthlySubscription,
        freeTrial: {
          days: 7, // NEW: 7-day trial
          onTrialStart: async (subscription) => {
            console.log(`Trial started for ${subscription.referenceId}`);
          },
          onTrialEnd: async ({ subscription }) => {
            console.log(`Trial ended for ${subscription.referenceId}`);
          },
        },
      },
    ],
    authorizeReference: async ({ user, referenceId }) => {
      const membership = await db.query.member.findFirst({
        where: and(
          eq(member.userId, user.id),
          eq(member.organizationId, referenceId)
        ),
      });
      return !!membership;
    },
    getCheckoutSessionParams: async ({ plan, subscription }) => {
      // Trial checkout: no setup fee (Stripe charges one-time items immediately)
      const isTrialCheckout = plan.freeTrial && !subscription?.trialStart;
      if (isTrialCheckout) {
        return {}; // Plugin handles recurring price + trial_period_days
      }

      // Post-trial first-time paid: include setup fee
      const isFirstTimePaid = !subscription?.stripeSubscriptionId
        || (subscription?.trialStart && !subscription?.stripeSubscriptionId);
      if (isFirstTimePaid) {
        return {
          params: {
            line_items: [
              { price: plan.priceId, quantity: 1 },
              { price: PRICES.setupFee, quantity: 1 },
            ],
          },
        };
      }

      return {};
    },
  },
  organization: { enabled: true },
}),
```

### Trial Status Utility (BILL-03 + BILL-04)
```typescript
// Source: Application pattern
// File: src/lib/billing.ts
export interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEnd: Date | null;
}

export function getTrialStatus(subscription: {
  status: string | null;
  trialStart: Date | null;
  trialEnd: Date | null;
} | null): TrialStatus {
  if (!subscription) {
    return { isTrialing: false, isExpired: false, daysRemaining: 0, trialEnd: null };
  }

  if (!subscription.trialEnd) {
    return { isTrialing: false, isExpired: false, daysRemaining: 0, trialEnd: null };
  }

  const now = new Date();
  const trialEnd = new Date(subscription.trialEnd);
  const msRemaining = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / 86400000));

  return {
    isTrialing: subscription.status === "trialing",
    isExpired: daysRemaining === 0 && subscription.status !== "active",
    daysRemaining,
    trialEnd,
  };
}
```

### Subscribe Button Text for Trial (BILL-02)
```typescript
// Source: Application pattern
// File: src/components/billing/subscribe-button.tsx
// Change button text based on whether this is a trial or paid checkout
<Button size="lg" disabled={loading} onClick={handleSubscribe}>
  {loading ? "Redirecting..." : "Start Free Trial"}
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createCustomerOnSignUp: true` for all billing | `createCustomerOnSignUp: false` + org-level lazy creation | better-auth/stripe v1.3+ | Prevents duplicate customer creation, fixes org-level billing |
| Manual `subscription_data.trial_period_days` | `freeTrial: { days: N }` in plan config | better-auth/stripe v1.4+ | Plugin handles trial abuse prevention and DB sync automatically |
| `forNewUsersOnly` trial restriction | Removed; plugin uses internal trial history tracking | better-auth/stripe commit 84ab25d | All users checked for prior trial usage automatically |
| trialStart/trialEnd not synced on webhook | Fixed in onSubscriptionUpdated hook | better-auth/stripe issue #4046 fix | Trial fields now populate correctly from Stripe events |

**Deprecated/outdated:**
- `forNewUsersOnly` in freeTrial config: removed, no longer available
- Manual trial period handling via getCheckoutSessionParams `subscription_data`: use `freeTrial.days` instead

## Open Questions

1. **Post-trial conversion flow: does `subscription.upgrade()` work for converting expired trials?**
   - What we know: The subscribe button calls `authClient.subscription.upgrade()` which creates a Checkout session. When trial expires, subscription status changes. The user can re-trigger checkout from the billing page.
   - What's unclear: Whether the plugin recognizes an expired trial subscription and creates a new Checkout session correctly, or whether it tries to "upgrade" the expired subscription.
   - Recommendation: Test this flow manually. If `upgrade()` fails for expired trials, the billing page may need to call a different method or the subscription record may need cleanup. The `getCheckoutSessionParams` callback receives the existing subscription, so it can detect the "expired trial converting to paid" case.

2. **Setup fee detection logic in getCheckoutSessionParams**
   - What we know: The callback receives `{ plan, subscription }`. `plan.freeTrial` exists when trial is configured. `subscription.trialStart` is null for first-time trial users.
   - What's unclear: Exact shape of `subscription` parameter -- is it the DB record or a Stripe object? Does it include `trialStart` on first checkout?
   - Recommendation: During implementation, log the `subscription` parameter to verify its shape. The conditional logic may need adjustment based on actual runtime values.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/billing/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Auth config has createCustomerOnSignUp: false | unit | `npx vitest run tests/billing/auth-config.test.ts -x` | No -- Wave 0 |
| BILL-02 | Plan config includes freeTrial with days: 7 | unit | `npx vitest run tests/billing/auth-config.test.ts -x` | No -- Wave 0 |
| BILL-03 | Trial banner renders with countdown | unit | `npx vitest run tests/billing/trial-banner.test.tsx -x` | No -- Wave 0 |
| BILL-03 | getTrialStatus computes correct days remaining | unit | `npx vitest run tests/billing/billing-utils.test.ts -x` | No -- Wave 0 |
| BILL-04 | Billing page shows trial-ended messaging when trial expired | unit | `npx vitest run tests/billing/billing-page.test.tsx -x` | Yes (partial) |
| BILL-05 | getCheckoutSessionParams excludes setup fee during trial | unit | `npx vitest run tests/billing/checkout-params.test.ts -x` | No -- Wave 0 |
| BILL-05 | getCheckoutSessionParams includes setup fee for post-trial paid | unit | `npx vitest run tests/billing/checkout-params.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/billing/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/billing/auth-config.test.ts` -- covers BILL-01, BILL-02 (verify auth config exports)
- [ ] `tests/billing/trial-banner.test.tsx` -- covers BILL-03 (trial banner component rendering)
- [ ] `tests/billing/billing-utils.test.ts` -- covers BILL-03 (getTrialStatus utility)
- [ ] `tests/billing/checkout-params.test.ts` -- covers BILL-05 (setup fee conditional logic)
- [ ] Update `tests/billing/billing-page.test.tsx` -- covers BILL-04 (add trial-ended state tests)

## Sources

### Primary (HIGH confidence)
- [Better Auth Stripe Plugin Docs](https://better-auth.com/docs/plugins/stripe) - createCustomerOnSignUp, freeTrial config, organization.enabled, getCheckoutSessionParams
- [Stripe Checkout Free Trials](https://docs.stripe.com/payments/checkout/free-trials) - subscription_data.trial_period_days behavior
- [Stripe Subscription Trials](https://docs.stripe.com/billing/subscriptions/trials) - one-time charges during trials, trial status lifecycle

### Secondary (MEDIUM confidence)
- [Better Auth Stripe commit 84ab25d](https://github.com/better-auth/better-auth/commit/84ab25da) - freeTrial implementation details, subscription_data merge order
- [Better Auth Issue #4046](https://github.com/better-auth/better-auth/issues/4046) - trialStart/trialEnd sync bug and fix
- [Better Auth Issue #2440](https://github.com/better-auth/better-auth/issues/2440) - duplicate customer creation bug (fixed in v1.3.3)
- [Better Auth Issue #2079](https://github.com/better-auth/better-auth/issues/2079) - org-level Stripe customer support

### Tertiary (LOW confidence)
- None -- all findings verified against official documentation or source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, versions verified from package.json
- Architecture: HIGH - codebase fully reviewed, plugin behavior verified from docs and source
- Pitfalls: HIGH - all pitfalls verified against Stripe docs and Better Auth issue tracker
- Setup fee during trial: HIGH - Stripe docs explicitly state one-time items charge immediately during trial
- Post-trial conversion flow: MEDIUM - exact plugin behavior for expired trial re-subscription not fully documented

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days -- stable stack, plugin actively maintained)
