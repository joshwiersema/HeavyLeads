# Stack Research: v2.0 Feature Additions

**Domain:** SaaS lead generation platform -- new feature stack additions
**Researched:** 2026-03-15
**Confidence:** HIGH

## Existing Stack (DO NOT re-add)

Already installed and validated in v1.0. Listed here only as integration reference:

| Technology | Version | Role |
|------------|---------|------|
| Next.js | 16.1.6 | Framework |
| React | 19.2.3 | UI |
| Better Auth | ^1.5.5 | Auth + org plugin |
| @better-auth/stripe | ^1.5.5 | Billing integration |
| Stripe (stripe-js + stripe) | ^8.9.0 / ^20.4.1 | Payment processing |
| Drizzle ORM | ^0.45.1 | Database ORM |
| @neondatabase/serverless | ^1.0.2 | PostgreSQL driver |
| Crawlee | ^3.16.0 | Web scraping |
| react-hook-form + @hookform/resolvers | ^7.71.2 / ^5.2.2 | Form management |
| zod | ^4.3.6 | Validation |
| Resend + @react-email/components | ^6.9.3 / ^1.0.9 | Email |
| shadcn/ui (base-ui) | ^1.3.0 | Component library |
| sonner | ^2.0.7 | Toasts |
| lucide-react | ^0.577.0 | Icons |
| @vis.gl/react-google-maps | ^1.7.1 | Map display |
| node-cron | ^4.2.1 | Scheduler (NOT usable on Vercel -- replaced by Vercel Cron) |
| Vitest | ^4.1.0 | Testing |

---

## New Stack Additions

### 1. Vercel Blob -- Logo/Image Upload

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @vercel/blob | latest | Company logo upload during onboarding | Native Vercel integration, zero config with Vercel deployment, direct next/image optimization support, public blob URLs served via CDN. No separate S3/Cloudinary needed. |

**Integration points:**
- Server Actions: `put()` from `@vercel/blob` in a Next.js server action
- Public store: logos are non-sensitive, public access is appropriate
- Size limit: 4.5 MB per server upload (sufficient for logos; client upload API available for larger files)
- Environment variable: `BLOB_READ_WRITE_TOKEN` (auto-created when connecting Blob store in Vercel dashboard)
- The `organization` table already has a `logo` text column -- store the blob URL there

**Usage pattern (server action):**
```typescript
"use server";
import { put } from "@vercel/blob";

export async function uploadLogo(formData: FormData) {
  const file = formData.get("logo") as File;
  const blob = await put(`logos/${orgId}/${file.name}`, file, {
    access: "public",
  });
  return blob.url; // Store in organization.logo column
}
```

**Why not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Cloudinary | Extra service, SDK, API keys. Overkill for logo upload. |
| AWS S3 + @aws-sdk/client-s3 | Requires IAM config, CORS setup. Vercel Blob is simpler for Vercel-deployed apps. |
| uploadthing | Additional dependency + third-party service. Vercel Blob is first-party. |
| Local filesystem | Does not work on Vercel (ephemeral filesystem in serverless). |

**Confidence:** HIGH -- Official Vercel product, documented integration with Next.js server actions.

---

### 2. Free Trial Billing -- No New Dependencies

**No new packages required.** The existing `@better-auth/stripe` plugin and `stripe` SDK already support everything needed.

**Approach: Use `onCustomerCreate` hook for no-credit-card trials**

The project requirement is "no credit card required to explore." The Better Auth Stripe plugin's built-in `freeTrial` config works via Stripe Checkout, which still presents a checkout session to the user (even if `payment_method_collection: 'if_required'` skips card collection). For a truly frictionless experience -- sign up, complete onboarding, start using the app immediately -- the recommended pattern is to use the `onCustomerCreate` hook to create a Stripe subscription with a trial directly via the Stripe API, bypassing checkout entirely.

This approach was validated by a community solution on the Better Auth GitHub (issue #4631, comment by @michalkow, Dec 2025) and follows Stripe's documented `subscriptions.create` API with `trial_period_days`.

**Configuration change in existing `src/lib/auth.ts`:**
```typescript
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
        freeTrial: {
          days: 7,
          onTrialEnd: async ({ subscription }, ctx) => {
            // Send "trial ending" email via Resend
          },
          onTrialExpired: async (subscription, ctx) => {
            // Send "trial expired, upgrade now" email via Resend
          },
        },
      },
    ],
    // Existing getCheckoutSessionParams for setup fee stays as-is
    // It handles post-trial upgrade checkout (where we DO want payment)
    getCheckoutSessionParams: async ({ plan, subscription }) => {
      const isFirstTime = !subscription?.stripeSubscriptionId;
      if (isFirstTime) {
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
  onCustomerCreate: async ({ stripeCustomer, user }, ctx) => {
    // Create subscription with 7-day trial, NO payment method required
    const sub = await stripeClient.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: PRICES.monthlySubscription, quantity: 1 }],
      trial_period_days: 7,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
    });

    // Write subscription record via Better Auth adapter
    await ctx.context.adapter.create({
      model: "subscription",
      data: {
        stripeCustomerId: stripeCustomer.id,
        referenceId: user.id, // Will need to be org ID for org-scoped billing
        status: sub.status, // "trialing"
        plan: "standard",
        periodEnd: new Date(sub.items.data[0]?.current_period_end! * 1000),
        periodStart: new Date(sub.items.data[0]?.current_period_start! * 1000),
        stripeSubscriptionId: sub.id,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      },
    });
  },
  organization: { enabled: true },
})
```

**Key Stripe parameters:**
- `trial_period_days: 7` -- sets a 7-day trial
- `trial_settings.end_behavior.missing_payment_method: "cancel"` -- auto-cancel if no card added by trial end
- No checkout session redirect -- subscription created server-side on user registration
- Existing subscription table already has `trialStart`/`trialEnd` columns (verified in schema)

**Trial abuse prevention:** Built into the Better Auth Stripe plugin -- users can only get one trial per account across all plans.

**Alternative approach (if checkout flow is acceptable):**
Instead of `onCustomerCreate`, use `getCheckoutSessionParams` to add trial params to the checkout session:
```typescript
params: {
  subscription_data: { trial_period_days: 7 },
  payment_method_collection: "if_required",
}
```
This still sends the user through Stripe Checkout but skips card collection. Simpler code but more friction.

**Confidence:** HIGH -- Stripe's trial API is mature and well-documented. The `onCustomerCreate` pattern is community-validated. Subscription schema already has trial columns.

---

### 3. Guided Product Tour -- NextStep.js

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nextstepjs | ^2.2.0 | Dashboard walkthrough after onboarding | Built specifically for Next.js App Router. Provides `NextStepProvider` + `NextStep` wrapper that integrates natively with React component tree. Supports cross-page routing, custom card components, and analytics callbacks. |
| motion | ^11.x | Animation engine (peer dep for NextStep) | Required peer dependency for NextStep.js animations. Formerly called "framer-motion", renamed to "motion" in v11+. |

**Why NextStep.js over alternatives:**

| Library | Version | Weekly DLs | Pros | Cons |
|---------|---------|-----------|------|------|
| **nextstepjs** | 2.2.0 | ~10K | Native Next.js App Router support, declarative steps, cross-page routing, custom cards, zero deps beyond motion | Newer library, smaller community |
| driver.js | 1.4.0 | ~200K | Lightweight (zero deps), mature, framework-agnostic | No React hooks/context. Manual useEffect + ref wiring. |
| react-joyride | 6.x | ~340K | Most battle-tested, large community | Heavier bundle. React 19 compatibility unverified. |
| shepherd.js | 14.x | ~100K | Framework-agnostic with React wrapper | Extra abstraction layer over vanilla JS lib. |
| intro.js | 7.x | ~50K | Lightweight | Commercial license required for SaaS use. |

**NextStep.js advantages for this project:**
1. **Native Next.js App Router support** -- wraps in `layout.tsx`, works across route changes
2. **Zero dependencies beyond Motion** -- minimal bundle impact
3. **Declarative step definition** -- steps are data objects with `selector`, `title`, `content`, `side`
4. **Event callbacks** -- `onStepChange`, `onComplete` for tracking tour completion in the `company_profiles` table
5. **Custom card components** -- can use existing shadcn/ui Card styles for visual consistency

**Setup:**
```bash
npm install nextstepjs motion
```

**Usage pattern:**
```tsx
// app/(dashboard)/layout.tsx
import { NextStepProvider, NextStep } from "nextstepjs";
import { dashboardTourSteps } from "@/lib/tour-steps";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextStepProvider>
      <NextStep steps={dashboardTourSteps}>
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
```

```typescript
// lib/tour-steps.ts
import type { Tour } from "nextstepjs";

export const dashboardTourSteps: Tour[] = [
  {
    tour: "dashboard-intro",
    steps: [
      {
        title: "Your Lead Feed",
        content: "Fresh construction leads appear here daily, filtered to your location and equipment types.",
        selector: "#lead-list",
        side: "right",
        showControls: true,
        showSkip: true,
      },
      {
        title: "Filter Leads",
        content: "Narrow results by project type, distance, or equipment relevance.",
        selector: "#lead-filters",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      // ... more steps targeting existing dashboard elements
    ],
  },
];
```

**Fallback:** If NextStep.js proves unstable with React 19 or Next.js 16, driver.js (1.4.0) is the backup. Same concept, more manual wiring with `useEffect` and CSS selectors. Installation: `npm install driver.js` + `import "driver.js/dist/driver.css"`.

**Confidence:** MEDIUM -- NextStep.js is newer (lower adoption) but specifically designed for Next.js. The API is clean. If stability concerns arise during implementation, driver.js is the proven fallback.

---

### 4. Vercel Cron Jobs -- Replaces node-cron (No New Packages)

**No new npm packages.** This is a configuration change + new API route.

**Problem:** The existing `node-cron` scheduler (`src/lib/scraper/scheduler.ts`) does NOT work on Vercel:
1. Vercel Functions are serverless -- no persistent process to run `cron.schedule()`
2. The scheduler only runs during `next dev` but never in Vercel production
3. This is why the dashboard is empty for new users -- scraper never runs automatically

**Solution: Vercel Cron Jobs via `vercel.json`**

Vercel Cron Jobs trigger HTTP GET requests to API routes on a schedule. The existing scraper API route at `/api/scraper/run` (currently POST, unauthenticated) needs to be restructured into a secured GET endpoint at `/api/cron/scrape`.

**Configuration:**
```json
// vercel.json (new file at project root)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**New API route:**
```typescript
// app/api/cron/scrape/route.ts
import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { initializeAdapters } from "@/lib/scraper/adapters";
import { getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";

export const maxDuration = 300; // 5 minutes (Hobby plan max with Fluid Compute)

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    initializeAdapters();
    const adapters = getRegisteredAdapters();
    const result = await runPipeline(adapters);
    clearAdapters();
    return Response.json(result);
  } catch (error) {
    clearAdapters();
    return Response.json(
      { error: error instanceof Error ? error.message : "Pipeline error" },
      { status: 500 }
    );
  }
}
```

**Plan constraints:**

| Plan | Cron Jobs | Min Frequency | Max Duration (Fluid Compute) | Max Duration (No FC) |
|------|-----------|---------------|------------------------------|----------------------|
| Hobby | 2 | Once/day | 300s (5 min) | 60s |
| Pro | 40 | Once/min | 800s (13 min) | 300s (5 min) |

- Hobby plan: 2 cron jobs, once per day each. Sufficient for daily scraping + email digest.
- Hobby timing caveat: Vercel may invoke within the specified hour (e.g., `0 6 * * *` could trigger 06:00-06:59). Pro plan invokes within the specified minute.
- Timezone: Always UTC (existing scheduler uses UTC, so no change).
- Fluid Compute (enabled by default): Gives 300s function duration on Hobby. Must stay enabled.
- No retries: Vercel does not retry failed cron jobs. The existing per-adapter error isolation handles this.
- Idempotency: Vercel may deliver duplicate events. The pipeline's deduplication layer already handles this.

**Security:** Add `CRON_SECRET` environment variable (random 16+ char string) in Vercel project settings. Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` header.

**Disposition of node-cron:** The `src/lib/scraper/scheduler.ts` file should be deprecated. Keep `node-cron` in package.json temporarily for any local dev scripts, but it is not the production scheduling mechanism.

**Confidence:** HIGH -- Vercel Cron is well-documented and matches the existing architecture. The pipeline is already stateless and idempotent.

---

### 5. On-Demand and First-Login Scraper Triggers -- No New Dependencies

**No new packages.** New server actions that call the existing `runPipeline()` function.

**On-demand "Refresh Leads" button:**
- New server action: `refreshLeads(organizationId)` that calls `runPipeline()` with adapters filtered to the organization's location + equipment types
- Protected by auth check (user must have active subscription or trial status "trialing")
- Returns results summary for toast notification via sonner
- `maxDuration` export on the server action or route: 300s

**First-login trigger:**
- After onboarding completes, the `completeOnboarding` server action triggers a pipeline run using the newly saved company profile (hqAddress, serviceRadius, equipmentTypes)
- The user is redirected to the dashboard immediately; a loading state shows "Generating your first leads..."
- Pipeline runs server-side; dashboard polls or uses a timestamp check to detect new leads

**Duration constraint:** Both triggers are user-initiated Vercel Function calls. With Fluid Compute, Hobby plan allows 300s. The pipeline runs adapters sequentially; if total time exceeds 300s, the pipeline should be partitioned (run highest-priority adapters first, queue the rest).

**Confidence:** HIGH -- Application logic only, no new stack dependencies.

---

### 6. Custom Search -- No New Dependencies

**No new packages.** Custom search leverages existing Drizzle ORM queries and Crawlee adapters.

**MVP approach (search stored leads):**
- Query the existing `leads` table with location + keyword + project type filters
- Use PostGIS-style distance calculation (or Drizzle ORM `sql` template for haversine formula)
- New search form built with existing react-hook-form + zod + shadcn/ui
- Fast response, no scraping delay

**Future enhancement (trigger new scrape):**
- Create parameterized adapter runs that accept user-specified location/keywords
- More complex, but delivers results beyond pre-scraped data
- Should be gated behind paid subscriptions (not trial)

**Confidence:** HIGH -- All infrastructure exists.

---

## Installation Summary

### New packages to install:

```bash
# Image upload for company logos
npm install @vercel/blob

# Guided product tour + animation engine
npm install nextstepjs motion
```

Three packages total. Everything else leverages existing stack.

### Packages to remove (optional cleanup):

```bash
# node-cron is replaced by Vercel Cron for production
# Can keep for local dev convenience, or remove entirely
npm uninstall node-cron @types/node-cron
```

### Environment variables to add:

| Variable | Source | Purpose |
|----------|--------|---------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Dashboard (auto-created when connecting Blob store) | Vercel Blob authentication |
| `CRON_SECRET` | Generate random 16+ char string, add in Vercel project settings | Secure cron job endpoint |

### Files to create/modify:

| File | Change |
|------|--------|
| `vercel.json` (new) | Add `crons` array for daily scrape schedule |
| `src/lib/auth.ts` (modify) | Add `freeTrial` config to plan, add `onCustomerCreate` hook for no-checkout trial |
| `src/app/api/cron/scrape/route.ts` (new) | Cron-triggered scraper endpoint (GET + CRON_SECRET auth) |
| `src/lib/tour-steps.ts` (new) | Dashboard tour step definitions |
| Dashboard layout (modify) | Wrap with `NextStepProvider` + `NextStep` |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @vercel/blob | Cloudinary | If you need on-the-fly image transformations (resize, crop, filters) beyond what next/image provides. Adds third-party dependency. |
| @vercel/blob | AWS S3 + @aws-sdk/client-s3 | If you move off Vercel or need advanced S3 features (lifecycle policies, versioning). |
| nextstepjs | driver.js (1.4.0) | If bundle size is absolute priority. Works in React but requires manual useEffect + ref wiring. Zero deps, zero framework coupling. |
| nextstepjs | react-joyride | If you need the most battle-tested solution (340K weekly downloads). Heavier bundle. Verify React 19 compatibility. |
| Vercel Cron | Upstash QStash | If you need retry logic, delays, or message queuing beyond simple scheduled HTTP calls. Adds separate service but provides guaranteed delivery. |
| Vercel Cron | Inngest | If the scraper evolves into a complex multi-step workflow with branching, retries, and observability. Overkill for a single daily job. |
| onCustomerCreate hook | freeTrial config + Stripe Checkout | If you want users to go through Stripe Checkout for trials. Use `getCheckoutSessionParams` with `payment_method_collection: "if_required"` and `subscription_data.trial_period_days: 7`. More friction but simpler code, Stripe-hosted UI. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| node-cron in production on Vercel | Serverless has no persistent process. Only runs during `next dev`. This is why the scraper never triggers in production. | Vercel Cron Jobs (vercel.json) |
| multer / formidable | Server-side file parsing libraries. Not needed with Vercel Blob's `put()` which accepts File/Blob directly from FormData in server actions. | @vercel/blob `put()` |
| AWS S3 SDK | ~1MB bundle addition, requires IAM configuration. Overkill when Vercel Blob is first-party. | @vercel/blob |
| intro.js | Requires commercial license for SaaS products. | nextstepjs or driver.js |
| react-dropzone | Extra dependency for drag-and-drop file upload. A native `<input type="file">` with styled label provides adequate UX for single logo upload. | Native file input with CSS styling |
| Custom setInterval scheduling | Same problem as node-cron on Vercel -- no persistent process. | Vercel Cron Jobs |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @vercel/blob | Next.js 16, Vercel deployment | Requires `BLOB_READ_WRITE_TOKEN` env var. Works with server actions and route handlers. Public and private store modes available. |
| nextstepjs ^2.2.0 | React 19, Next.js 16 App Router | Requires `motion` as peer dependency. Provider + wrapper must be in a client component boundary. |
| motion ^11.x | React 19 | Peer dependency for nextstepjs. Renamed from "framer-motion" in v11. Do NOT install "framer-motion" -- use "motion" package. |
| Vercel Cron | Next.js 16, any Vercel plan | Hobby: 2 jobs, once/day max. Pro: 40 jobs, once/min. Triggers GET requests. Timezone always UTC. |
| @better-auth/stripe freeTrial | better-auth ^1.5.5, stripe ^20.x | `freeTrial.days` on plan config. `onCustomerCreate` hook for no-checkout trial. `trialStart`/`trialEnd` columns already exist in subscription table. Trial abuse prevention is automatic. |

---

## Sources

- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) -- Configuration, expressions, how cron triggers work. HIGH confidence.
- [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) -- CRON_SECRET security, duration limits, error handling, concurrency, idempotency. HIGH confidence.
- [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- maxDuration limits: Hobby 300s, Pro 800s with Fluid Compute (default). HIGH confidence.
- [Vercel Blob documentation](https://vercel.com/docs/vercel-blob) -- Overview, public/private stores, SDK usage, CDN caching. HIGH confidence.
- [Vercel Blob Server Upload](https://vercel.com/docs/vercel-blob/server-upload) -- Server action pattern, 4.5MB limit, BLOB_READ_WRITE_TOKEN. HIGH confidence.
- [Vercel Blob Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) -- Hobby: 1GB free storage, 10GB transfer. $0.023/GB-month after. HIGH confidence.
- [Better Auth Stripe plugin](https://better-auth.com/docs/plugins/stripe) -- freeTrial config (days, callbacks), plan setup, trial abuse prevention. HIGH confidence.
- [Better Auth issue #4631](https://github.com/better-auth/better-auth/issues/4631) -- Community solution for no-checkout trial via `onCustomerCreate` hook. Code example by @michalkow (Dec 2025). MEDIUM confidence (community pattern, not official docs, but code is clear and correct).
- [Stripe free trial docs](https://docs.stripe.com/payments/checkout/free-trials) -- `payment_method_collection: "if_required"`, `subscription_data.trial_period_days`, `trial_settings.end_behavior`. HIGH confidence.
- [Stripe trial periods](https://docs.stripe.com/billing/subscriptions/trials) -- `subscriptions.create` with `trial_period_days`. HIGH confidence.
- [NextStep.js](https://nextstepjs.com/) -- Product tour library, Next.js App Router integration, step API, provider pattern. MEDIUM confidence (newer library).
- [driver.js installation](https://driverjs.com/docs/installation) -- v1.4.0, npm install, CSS import, highlight API. HIGH confidence (mature library).
- [5 Best React Onboarding Libraries 2026](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared) -- Comparison of tour libraries. MEDIUM confidence (blog post).

---
*Stack research for: HeavyLeads v2.0 feature additions*
*Researched: 2026-03-15*
