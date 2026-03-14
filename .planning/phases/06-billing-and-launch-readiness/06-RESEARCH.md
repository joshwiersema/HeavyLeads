# Phase 6: Billing and Launch Readiness - Research

**Researched:** 2026-03-14
**Domain:** Stripe subscription billing, access gating, webhook lifecycle
**Confidence:** HIGH

## Summary

Phase 6 adds subscription billing so company admins can self-service subscribe with a one-time setup fee and ongoing monthly charge. The existing project uses Better Auth with the organization plugin for multi-tenancy (organizationId on all tenant-scoped data). Better Auth publishes an official `@better-auth/stripe` plugin that integrates directly with the organization plugin, handling customer creation, subscription table management, webhook routing, and billing portal sessions -- all through the same `/api/auth/[...all]` catch-all route that already exists.

The one-time setup fee requirement is achievable by combining Stripe Checkout's ability to mix recurring and one-time price line items in subscription mode. The Better Auth Stripe plugin exposes a `getCheckoutSessionParams` callback that allows injecting additional line items (the setup fee) into the checkout session before it is created. Webhook-driven subscription state stored in a `subscription` table (auto-created by the plugin's migration) becomes the source of truth for gating access to lead data.

**Primary recommendation:** Use `@better-auth/stripe` plugin with the organization integration enabled, define a single "standard" plan with a monthly recurring price, and use `getCheckoutSessionParams` to inject the one-time setup fee price. Gate dashboard access by checking subscription status in the existing dashboard layout server component.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-05 | Subscription billing with one-time setup fee + ongoing monthly charges via Stripe | Better Auth Stripe plugin handles subscription lifecycle; `getCheckoutSessionParams` callback injects setup fee as one-time line item; Stripe Checkout supports mixed recurring + one-time prices in subscription mode |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@better-auth/stripe` | latest (compatible with better-auth ^1.5.5) | Subscription management, webhook handling, customer creation | Official Better Auth plugin; integrates with existing organization plugin; auto-manages subscription table and webhook routing |
| `stripe` | ^20.4.1 | Stripe Node.js SDK (peer dependency of @better-auth/stripe) | Required by the plugin; provides Stripe API client and webhook signature verification |
| `@stripe/stripe-js` | ^8.9.0 | Client-side Stripe.js loader | PCI-compliant Stripe.js loading for redirect to Checkout; lightweight wrapper |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@better-auth/stripe/client` | (included in @better-auth/stripe) | Client-side subscription hooks | For subscription.upgrade(), subscription.cancel(), subscription.billingPortal() calls from client components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @better-auth/stripe | Manual Stripe integration | Full control but requires building: webhook route, signature verification, subscription table, customer lifecycle, billing portal session creation. The plugin handles all of this and integrates with existing Better Auth organization flow. Manual approach only if plugin proves too limiting. |
| Stripe Checkout (hosted) | Stripe Elements (embedded) | Hosted Checkout is simpler, handles PCI compliance entirely on Stripe's side, and supports mixed recurring + one-time line items out of the box. Elements requires more UI work for no gain at MVP. |

**Installation:**
```bash
npm install @better-auth/stripe stripe @stripe/stripe-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── auth.ts                          # Add stripe plugin to existing config
│   ├── auth-client.ts                   # Add stripeClient plugin
│   ├── stripe.ts                        # NEW: Stripe client instance + price IDs
│   └── db/
│       └── schema/
│           └── subscriptions.ts         # NEW: Export plugin-managed subscription table for Drizzle queries
├── app/
│   ├── api/auth/[...all]/route.ts       # Existing -- plugin adds webhook endpoint automatically
│   ├── (dashboard)/
│   │   └── layout.tsx                   # MODIFY: Add subscription status check (access gate)
│   └── (dashboard)/
│       └── settings/
│           └── billing/
│               └── page.tsx             # NEW: Billing management page (subscribe, portal, status)
└── components/
    └── billing/
        ├── subscribe-button.tsx         # NEW: Initiates checkout
        └── billing-status.tsx           # NEW: Shows current subscription status
```

### Pattern 1: Better Auth Stripe Plugin Integration
**What:** Add the Stripe plugin to the existing Better Auth configuration, leveraging the organization plugin integration for organization-level billing.
**When to use:** When the project already uses Better Auth with the organization plugin (this project does).
**Example:**
```typescript
// src/lib/stripe.ts
import Stripe from "stripe";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

// Price IDs from Stripe Dashboard (create Products + Prices in Stripe first)
export const PRICES = {
  monthlySubscription: process.env.STRIPE_MONTHLY_PRICE_ID!,
  setupFee: process.env.STRIPE_SETUP_FEE_PRICE_ID!,
} as const;
```

```typescript
// src/lib/auth.ts (modified)
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { stripeClient, PRICES } from "./stripe";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 50,
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "standard",
            priceId: PRICES.monthlySubscription,
          },
        ],
      },
      organization: {
        enabled: true,
      },
      getCheckoutSessionParams: async ({ plan, session }) => ({
        line_items: [
          {
            price: PRICES.setupFee,
            quantity: 1,
          },
        ],
      }),
    }),
    nextCookies(), // MUST be last plugin
  ],
});
```

```typescript
// src/lib/auth-client.ts (modified)
"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    stripeClient({ subscription: true }),
  ],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  useActiveOrganization,
} = authClient;
```

### Pattern 2: One-Time Setup Fee via Mixed Line Items
**What:** Stripe Checkout in subscription mode supports up to 20 recurring line items and 20 one-time line items. The one-time items appear only on the initial invoice. The `getCheckoutSessionParams` callback in the Better Auth plugin lets you inject the setup fee price as an additional one-time line item.
**When to use:** When a subscription needs a one-time activation/setup charge alongside recurring billing.
**Example:** See Pattern 1 auth.ts example above -- the `getCheckoutSessionParams` callback returns additional line_items that are merged into the checkout session.

### Pattern 3: Subscription Access Gating in Dashboard Layout
**What:** Check subscription status in the existing dashboard layout server component. If no active subscription exists for the organization, redirect to a billing/subscribe page instead of showing the dashboard.
**When to use:** To gate access to lead data behind an active subscription.
**Example:**
```typescript
// src/app/(dashboard)/layout.tsx -- subscription check addition
// After existing auth + onboarding checks:

// Check subscription status
const subscription = await db.query.subscription.findFirst({
  where: and(
    eq(subscriptionTable.referenceId, session.session.activeOrganizationId),
    or(
      eq(subscriptionTable.status, "active"),
      eq(subscriptionTable.status, "trialing")
    )
  ),
});

if (!subscription) {
  redirect("/settings/billing");
}
```

### Pattern 4: Webhook-Driven State (Source of Truth)
**What:** The Better Auth Stripe plugin automatically handles webhook events (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`) and updates the subscription table accordingly. The webhook endpoint is automatically registered at `/api/auth/stripe/webhook` through the existing catch-all route.
**When to use:** Always. Never rely on client-side redirect from Checkout to confirm subscription state.
**Key events handled automatically:**
- `checkout.session.completed` -- creates subscription record
- `customer.subscription.updated` -- updates status, period dates, cancellation flags
- `customer.subscription.deleted` -- marks subscription as canceled

### Anti-Patterns to Avoid
- **Checking payment on client-side redirect:** Never trust the success_url redirect to mean payment succeeded. Always use webhook-confirmed subscription status from the database.
- **Building a custom webhook handler when the plugin handles it:** The Better Auth Stripe plugin already manages webhook signature verification and subscription state updates. Adding a separate `/api/webhooks/stripe` route would create conflicting handlers.
- **Storing Stripe price IDs in the database:** Keep price IDs in environment variables or a config file. They are deployment-specific (test vs live mode) and do not change per-tenant.
- **Querying Stripe API on every page load:** Check the local subscription table, which is kept in sync by webhooks. Stripe API calls are for mutations only (create checkout, create portal session).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC verification | `@better-auth/stripe` plugin (uses `stripe.webhooks.constructEvent` internally) | Raw body handling in Next.js App Router is tricky; plugin handles it correctly |
| Subscription table + migrations | Custom Drizzle schema for subscriptions | `@better-auth/stripe` auto-managed table (run `npx auth migrate`) | Plugin manages 15+ fields (status, period dates, trial dates, cancellation flags, seats) and keeps them in sync with Stripe |
| Customer creation lifecycle | Manual Stripe customer creation on signup | `createCustomerOnSignUp: true` in plugin config | Handles edge cases: duplicate customers, org vs user customers, idempotency |
| Billing portal sessions | Custom billing management UI | `authClient.subscription.billingPortal()` -> Stripe Customer Portal | Portal handles payment method updates, invoice history, cancellation -- zero UI to build |
| Subscription status sync | Polling Stripe API or manual status updates | Webhook-driven updates via plugin | Automatic, real-time, handles retries and edge cases |
| Checkout session creation | Manual `stripe.checkout.sessions.create()` calls | `authClient.subscription.upgrade()` | Plugin handles customer lookup, plan validation, organization association |

**Key insight:** The Better Auth Stripe plugin eliminates 80% of custom billing code. The only custom work needed is: (1) injecting the setup fee via `getCheckoutSessionParams`, (2) adding the subscription check to the dashboard layout, and (3) building a simple billing settings page with subscribe/manage buttons.

## Common Pitfalls

### Pitfall 1: Webhook Endpoint URL Misconfiguration
**What goes wrong:** Stripe webhooks never reach the app because the webhook URL is wrong or the signing secret doesn't match.
**Why it happens:** Better Auth Stripe plugin registers its webhook handler at `/api/auth/stripe/webhook`, not the common `/api/webhooks/stripe`. Developers configure the wrong URL in the Stripe Dashboard.
**How to avoid:** Register webhook endpoint in Stripe Dashboard pointing to `https://your-domain.com/api/auth/stripe/webhook`. Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook`.
**Warning signs:** Subscription table never updates after checkout completes; `stripe trigger` events show failures in Stripe Dashboard.

### Pitfall 2: Test vs Live Mode Secret Mismatch
**What goes wrong:** Webhook signature verification fails in production because the signing secret is from test mode.
**Why it happens:** Stripe uses different signing secrets for test and live mode webhooks. Developers copy the test secret to production.
**How to avoid:** Create separate webhook endpoints in Stripe Dashboard for test and live modes. Use different environment variables per deployment (STRIPE_WEBHOOK_SECRET).
**Warning signs:** All webhook events return 400 errors in Stripe Dashboard logs.

### Pitfall 3: Missing Database Migration After Plugin Installation
**What goes wrong:** The subscription table doesn't exist, causing runtime errors when webhooks fire.
**Why it happens:** The `@better-auth/stripe` plugin requires running `npx auth generate` (to generate Drizzle migration) then `npx drizzle-kit push` (to apply schema). Developers forget one or both steps.
**How to avoid:** Run `npx auth generate` immediately after adding the plugin to auth config, then `npx drizzle-kit push` to apply the schema changes.
**Warning signs:** "relation subscription does not exist" errors in server logs.

### Pitfall 4: Checkout Succeeds But Access Not Granted
**What goes wrong:** User pays successfully, sees the success URL, but the dashboard still redirects them to billing page.
**Why it happens:** The webhook hasn't been processed yet (there's a short delay), or the webhook endpoint is misconfigured and never receives events.
**How to avoid:** Add a brief polling mechanism or "Processing your subscription..." intermediate state on the success page that checks subscription status before redirecting to dashboard.
**Warning signs:** Users report paying but not getting access; subscription table is empty.

### Pitfall 5: Forgetting to Add Stripe Plugin Before nextCookies
**What goes wrong:** Plugin doesn't initialize correctly or session data is incomplete.
**Why it happens:** The existing auth.ts has a comment "MUST be last plugin" for nextCookies(). Developers add the stripe plugin after nextCookies.
**How to avoid:** Add stripe() plugin before nextCookies() in the plugins array. The order matters.
**Warning signs:** Stripe-related auth routes return 404 or undefined behavior.

### Pitfall 6: Setup Fee Charged on Every Subscription Change
**What goes wrong:** The one-time setup fee is re-charged when a user cancels and re-subscribes.
**Why it happens:** The `getCheckoutSessionParams` callback unconditionally adds the setup fee line item.
**How to avoid:** Check if the organization already has a `stripeCustomerId` (indicating they've been a customer before) and conditionally include the setup fee only for first-time subscribers.
**Warning signs:** Customer complaints about being double-charged for setup.

## Code Examples

### Subscribing from Client Component
```typescript
// Source: https://better-auth.com/docs/plugins/stripe
"use client";

import { authClient } from "@/lib/auth-client";

export function SubscribeButton({ organizationId }: { organizationId: string }) {
  const handleSubscribe = async () => {
    const { data, error } = await authClient.subscription.upgrade({
      plan: "standard",
      successUrl: "/dashboard",
      cancelUrl: "/settings/billing",
      referenceId: organizationId,
      customerType: "organization",
    });

    if (data?.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    }
  };

  return <button onClick={handleSubscribe}>Subscribe</button>;
}
```

### Accessing Billing Portal
```typescript
// Source: https://better-auth.com/docs/plugins/stripe
"use client";

import { authClient } from "@/lib/auth-client";

export function ManageBillingButton() {
  const handleManage = async () => {
    const { data } = await authClient.subscription.billingPortal({
      returnUrl: "/settings/billing",
    });

    if (data?.url) {
      window.location.href = data.url; // Redirect to Stripe Customer Portal
    }
  };

  return <button onClick={handleManage}>Manage Billing</button>;
}
```

### Checking Subscription Status Server-Side
```typescript
// Pattern for server components / server actions
import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { eq, or } from "drizzle-orm";

export async function getActiveSubscription(organizationId: string) {
  const sub = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, organizationId),
      or(
        eq(subscription.status, "active"),
        eq(subscription.status, "trialing")
      )
    ),
  });
  return sub;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Stripe integration with custom webhook routes | Better Auth Stripe plugin with automatic webhook handling | 2024-2025 (plugin maturity) | Eliminates 80% of custom billing code; subscription table managed automatically |
| Pages Router webhook with custom body parser config | App Router `request.text()` for raw body | Next.js 13+ (2023) | No more `export const config = { api: { bodyParser: false } }` hack |
| Stripe Checkout with only recurring items | Mixed recurring + one-time items in subscription mode | Stripe API 2020+ | Setup fees can be included in same checkout session |
| Custom billing management UI | Stripe Customer Portal (hosted) | Stripe 2020+ | Zero UI code for payment updates, invoice history, cancellation |

**Deprecated/outdated:**
- `@stripe/react-stripe-js` Elements for simple checkout: Use Stripe Checkout (hosted) instead for MVP. Elements are for custom payment forms.
- Next.js Pages Router `api/` routes with `bodyParser: false`: Use App Router route handlers with `request.text()`.

## Open Questions

1. **getCheckoutSessionParams Merge Behavior**
   - What we know: The callback returns additional checkout session params. The docs mention it can return `line_items`.
   - What's unclear: Whether the returned `line_items` array is merged with or replaces the plugin's auto-generated line items for the plan price. Most likely merged (additive).
   - Recommendation: Test during implementation. If replace behavior, include both the plan price and setup fee in the callback return. Fallback: create checkout session manually using Stripe SDK if plugin callback is too limiting.

2. **Subscription Table Schema Compatibility with Drizzle**
   - What we know: The plugin auto-manages a `subscription` table. The project uses Drizzle with `npx drizzle-kit push` for schema management.
   - What's unclear: Exact column names and whether `npx auth generate` produces Drizzle-compatible migration files or raw SQL.
   - Recommendation: Run `npx auth generate` after plugin installation and inspect the output. If it produces a Drizzle schema file, export it from schema/index.ts. If raw SQL, use `npx drizzle-kit push` after `npx auth migrate`.

3. **Stripe Products/Prices Pre-Creation**
   - What we know: Price IDs must exist in Stripe before checkout can be initiated.
   - What's unclear: Whether the project owner has a Stripe account set up.
   - Recommendation: Document the required Stripe Dashboard setup steps (create products, create prices, copy IDs to env vars). Implementation should work with both test and live mode prices.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/billing/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-05a | Checkout session creation with setup fee + recurring line items | unit | `npx vitest run tests/billing/checkout.test.ts -x` | Wave 0 |
| PLAT-05b | Webhook event processing updates subscription status | unit | `npx vitest run tests/billing/webhook.test.ts -x` | Wave 0 |
| PLAT-05c | Dashboard access gated by active subscription | unit | `npx vitest run tests/billing/access-gate.test.ts -x` | Wave 0 |
| PLAT-05d | Billing page renders subscribe/manage buttons based on status | unit | `npx vitest run tests/billing/billing-page.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/billing/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/billing/checkout.test.ts` -- covers PLAT-05a (mock Stripe client, verify checkout session params include setup fee)
- [ ] `tests/billing/webhook.test.ts` -- covers PLAT-05b (mock webhook events, verify subscription status updates)
- [ ] `tests/billing/access-gate.test.ts` -- covers PLAT-05c (mock subscription query, verify redirect behavior)
- [ ] `tests/billing/billing-page.test.tsx` -- covers PLAT-05d (render billing page with/without active subscription)
- [ ] `tests/helpers/billing.ts` -- shared fixtures (mock subscription, mock Stripe events)

## Sources

### Primary (HIGH confidence)
- [Stripe Subscriptions with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions) -- subscription mode, mixed line items, webhook events
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create) -- line_items structure, subscription_data, one-time + recurring limits
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) -- complete event list, status transitions, retry behavior
- [Better Auth Stripe Plugin](https://better-auth.com/docs/plugins/stripe) -- plugin configuration, organization integration, getCheckoutSessionParams, subscription table schema
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal) -- portal session creation, return URL handling

### Secondary (MEDIUM confidence)
- [Stripe Node.js SDK (npm)](https://www.npmjs.com/package/stripe) -- version 20.4.1, API version 2025-11-17.clover
- [@stripe/stripe-js (npm)](https://www.npmjs.com/package/@stripe/stripe-js) -- version 8.9.0
- [Next.js App Router Webhook Pattern](https://www.geeksforgeeks.org/reactjs/how-to-add-stripe-webhook-using-nextjs-13-app-router/) -- request.text() raw body, constructEvent usage
- [Vercel Subscription Starter](https://github.com/vercel/nextjs-subscription-payments) -- reference architecture for Next.js + Stripe

### Tertiary (LOW confidence)
- [getCheckoutSessionParams merge behavior](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/stripe.mdx) -- callback returns additional params; merge vs replace behavior not explicitly documented. Flagged for validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@better-auth/stripe` is the official plugin for the auth library already in use; Stripe SDK versions confirmed from npm
- Architecture: HIGH -- Patterns well-documented in both Stripe and Better Auth docs; organization plugin integration confirmed
- Pitfalls: HIGH -- Common issues well-documented across multiple sources (webhook URL, raw body, test/live mismatch)
- Setup fee approach: MEDIUM -- `getCheckoutSessionParams` callback exists but exact merge behavior with plan line items needs validation during implementation

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- Stripe API stable, Better Auth plugin actively maintained)
