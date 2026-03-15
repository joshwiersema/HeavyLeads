# Architecture Research: v2.0 Feature Integration

**Domain:** Multi-tenant SaaS lead generation (HeavyLeads)
**Researched:** 2026-03-15
**Confidence:** HIGH

This document maps how six new features integrate with the existing HeavyLeads architecture. For each feature, it identifies: what existing code is modified vs. what is new, the data flow changes, and the integration constraints.

## System Overview: Current Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Route Groups (App Router)                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  (auth)  │  │(onboarding│  │  (billing)   │  │ (dashboard)  │    │
│  │ sign-in  │  │  wizard   │  │  subscribe/  │  │ leads/saved/ │    │
│  │ sign-up  │  │  3 steps  │  │  manage      │  │ bookmarks    │    │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  └──────┬───────┘    │
│       │              │               │               │              │
├───────┴──────────────┴───────────────┴───────────────┴──────────────┤
│                    Layout Guard Chain (Dashboard)                     │
│     auth → org → onboarding → subscription → content                │
├─────────────────────────────────────────────────────────────────────┤
│                    Server Actions (src/actions/)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ onboarding │  │ billing      │  │bookmarks │  │ lead-status  │  │
│  └────────────┘  └──────────────┘  └──────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    API Routes                                        │
│  ┌────────────────────┐  ┌──────────────────┐                       │
│  │ /api/auth/[...all] │  │ /api/scraper/run │                       │
│  │ (Better Auth)      │  │ (manual trigger) │                       │
│  └────────────────────┘  └──────────────────┘                       │
├─────────────────────────────────────────────────────────────────────┤
│                    Data Layer                                        │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Better Auth  │  │  Company   │  │  Leads   │  │ Subscriptions│  │
│  │ user/org/    │  │  Profiles  │  │  + src   │  │ (@ba/stripe) │  │
│  │ member/inv   │  │           │  │  + dedup  │  │              │  │
│  └──────────────┘  └───────────┘  └──────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    External Services                                 │
│  ┌────────┐  ┌──────┐  ┌────────────┐  ┌────────┐  ┌──────────┐  │
│  │ Stripe │  │ Neon │  │ Geocoding  │  │ Resend │  │ Crawlee  │  │
│  └────────┘  └──────┘  └────────────┘  └────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Feature 1: Free Trial (1-Week, No Credit Card)

### Integration Decision: Bypass Stripe Checkout

**Confidence:** HIGH

The project requires "no credit card to explore." The @better-auth/stripe plugin's `freeTrial` configuration routes through Stripe Checkout, which creates a checkout session -- even with `payment_method_collection: "if_required"`, the user still lands on a Stripe-hosted page. This is unnecessary friction for a no-card trial.

**Recommended approach:** Create the trial subscription directly via a server action at signup completion, bypassing Stripe Checkout entirely. The subscription table already has `trialStart`, `trialEnd`, and `status` columns (managed by @better-auth/stripe). We write a "trialing" subscription row directly to the database.

### Where Trial State Lives

Trial state lives in the **existing `subscription` table**, not a separate field. The subscription table already has all needed columns:

| Column | Trial Value |
|--------|-------------|
| `status` | `"trialing"` |
| `trialStart` | signup timestamp |
| `trialEnd` | signup + 7 days |
| `plan` | `"standard"` |
| `referenceId` | organizationId |
| `stripeSubscriptionId` | `null` (no Stripe sub yet) |
| `stripeCustomerId` | from Stripe customer (created on signup via `createCustomerOnSignUp: true`) |

This works because `getActiveSubscription()` in `src/lib/billing.ts` already checks for `status = "trialing"`:

```typescript
// EXISTING CODE -- already handles trials
or(
  eq(subscription.status, "active"),
  eq(subscription.status, "trialing")
)
```

### Dashboard Guard Change

The dashboard layout guard (`src/app/(dashboard)/layout.tsx`) requires **one small addition**. The existing `getActiveSubscription()` call returns trialing subscriptions, so the guard passes. However, it must also check whether the trial has expired (trialEnd < now). An expired trial should redirect to /billing, not grant dashboard access.

**Option A (recommended):** Update `getActiveSubscription()` to exclude expired trials:

```typescript
export async function getActiveSubscription(organizationId: string) {
  const sub = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, organizationId),
      or(
        eq(subscription.status, "active"),
        and(
          eq(subscription.status, "trialing"),
          // Only return trialing if not expired
          gte(subscription.trialEnd, new Date())
        )
      )
    ),
  });
  return sub ?? null;
}
```

**Option B:** Keep `getActiveSubscription()` unchanged and add an `isTrialExpired()` check in the layout guard. More explicit but scatters trial logic across files.

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| `createTrialSubscription()` | NEW server action | `src/actions/billing.ts` |
| Onboarding completion flow | MODIFY | `src/actions/onboarding.ts` or wizard redirect logic |
| `getActiveSubscription()` | MODIFY | `src/lib/billing.ts` (add trial expiry check) |
| Billing page trial banner | MODIFY | `src/app/(billing)/billing/page.tsx` |
| Trial days remaining helper | NEW utility | `src/lib/billing.ts` |

### Data Flow

```
Sign-up → Create user → Create org → Set active org
    → Redirect to /onboarding
    → Complete onboarding wizard
    → completeOnboarding() action inserts company_profiles row
    → createTrialSubscription() action inserts subscription row
        status: "trialing", trialEnd: now + 7 days
    → Redirect to /dashboard (guard passes because trialing + not expired)
```

### Trial Expiry UX

The billing page needs trial-aware states:

1. **During trial:** "You have X days left on your free trial. Subscribe to keep access."
2. **Trial expired:** "Your free trial has ended. Subscribe to continue using HeavyLeads."
3. **After payment:** Standard active subscription view (already exists).

The dashboard sidebar should show a subtle trial banner with days remaining. This is a presentational change, not an architectural one.

### Why Not Use the Plugin's freeTrial Config

The @better-auth/stripe plugin's `freeTrial.days` option calls `subscription.upgrade()` which creates a Stripe Checkout session. This requires the user to visit Stripe, even if no card is collected. For "no credit card required" trials, we need to skip Checkout entirely. The plugin does not expose an API for creating a trial subscription without checkout (confirmed: GitHub issue #4631 was closed as "not planned").

Writing directly to the subscription table is safe because the plugin reads from this same table and the `status: "trialing"` value is one the plugin recognizes. When the user later subscribes via Checkout, the @better-auth/stripe plugin will create a new subscription row with `status: "active"`.

**Risk:** If a future Better Auth update changes the subscription table schema or adds validation on insert, the direct-write approach could break. Mitigate by pinning `@better-auth/stripe` version and testing on upgrades.

---

## Feature 2: Onboarding Expansion (Company Details + Logo)

### Schema Changes

The existing `company_profiles` table needs new columns for company details:

| New Column | Type | Purpose |
|------------|------|---------|
| `website` | `text` | Company website URL |
| `phone` | `text` | Contact phone |
| `industrySegment` | `text` | e.g., "rental", "sales", "both", "service" |

The `organization` table already has `logo` and `name` fields (from Better Auth). Use `organization.logo` for logo storage and `organization.name` for the company display name. Do not duplicate these in company_profiles -- that creates two sources of truth.

### Wizard Step Addition

The wizard uses a `STEPS` array in `src/components/onboarding/wizard-shell.tsx`:

```typescript
const STEPS = [
  { component: StepLocation, label: "Location", fields: ["hqAddress"] },
  { component: StepEquipment, label: "Equipment", fields: ["equipmentTypes"] },
  { component: StepRadius, label: "Radius", fields: ["serviceRadius"] },
];
```

To add steps, insert entries into this array. The wizard iterates over the array index, so insertion requires no structural changes -- just add entries and update the form schema.

**Recommended step order:**

```
Step 1: Company Details (website, phone, industry, logo upload)  ← NEW
Step 2: Location (existing -- hqAddress)
Step 3: Equipment (existing -- equipmentTypes)
Step 4: Service Radius (existing -- serviceRadius)
Step 5: Team Invites (optional, can skip)  ← NEW
```

Company details first because company identity is the most natural first question after account creation.

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| `StepCompanyDetails` | NEW component | `src/components/onboarding/step-company-details.tsx` |
| `StepTeamInvites` | NEW component | `src/components/onboarding/step-team-invites.tsx` |
| Wizard STEPS array | MODIFY | `src/components/onboarding/wizard-shell.tsx` |
| Onboarding schema | MODIFY | `src/lib/validators/onboarding.ts` |
| `completeOnboarding()` action | MODIFY | `src/actions/onboarding.ts` |
| company_profiles migration | NEW | Drizzle migration |
| company_profiles schema | MODIFY | `src/lib/db/schema/company-profiles.ts` |
| Logo upload component | NEW | `src/components/onboarding/logo-upload.tsx` |

### Logo Upload Strategy

Vercel has a 4.5MB request body limit for serverless functions. For logo uploads:

- **Recommended:** Use Vercel Blob Storage for file storage. Upload directly from the client via a signed upload URL, get back a public URL, store the URL in `organization.logo` via `authClient.organization.update()`.
- **Alternative:** Base64-encode small logos (<500KB) and store in the `organization.logo` text field. Simpler but wastes DB storage and prevents CDN caching.
- **Decision:** Use Vercel Blob for production quality. Add `@vercel/blob` to dependencies.

### Updated Onboarding Schema

```typescript
export const onboardingSchema = z.object({
  // NEW: Company details (step 1)
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  industrySegment: z.enum(["rental", "sales", "both", "service"]).optional(),
  // EXISTING: Location (step 2)
  hqAddress: z.string().min(5),
  // EXISTING: Equipment (step 3)
  equipmentTypes: z.array(z.string()).min(1),
  // EXISTING: Radius (step 4)
  serviceRadius: z.number().min(10).max(500),
});
```

Team invites are NOT part of this schema -- see Feature 3 for why.

---

## Feature 3: Team Invites (Better Auth Organization Plugin)

### How inviteMember Works

**Confidence:** HIGH (verified via official Better Auth docs)

The organization plugin already includes invitation infrastructure. The `invitation` table exists in the schema (`src/lib/db/schema/auth.ts`). The client already has `organizationClient()` configured.

**Client-side call:**
```typescript
await authClient.organization.inviteMember({
  email: "colleague@company.com",
  role: "member",           // or "admin"
  organizationId: orgId,    // defaults to active org if omitted
});
```

**Required server config addition:** The organization plugin needs a `sendInvitationEmail` callback to actually send emails:

```typescript
organization({
  creatorRole: "owner",
  membershipLimit: 50,
  async sendInvitationEmail(data) {
    // data.id = invitation ID
    // data.email = recipient email
    // data.organization = { name, ... }
    // data.inviter = { name, email, ... }
    const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invite/${data.id}`;
    await resend.emails.send({
      to: data.email,
      subject: `Join ${data.organization.name} on HeavyLeads`,
      // ... email template
    });
  },
}),
```

**Invitation acceptance flow:**
1. Recipient clicks link in email -> lands on `/accept-invite/[id]` page
2. Page calls `authClient.organization.getInvitation({ query: { id } })` to show details
3. If recipient has an account, they sign in and call `authClient.organization.acceptInvitation({ invitationId })`
4. If recipient is new, they sign up first, then accept the invitation
5. On acceptance, Better Auth creates a `member` row and sets the org as active

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| `sendInvitationEmail` config | MODIFY | `src/lib/auth.ts` (organization plugin config) |
| `StepTeamInvites` component | NEW | `src/components/onboarding/step-team-invites.tsx` |
| Accept invite page | NEW | `src/app/(auth)/accept-invite/[id]/page.tsx` |
| Invite email template | NEW | `src/components/emails/team-invite.tsx` |
| Team management settings page | NEW | `src/app/(dashboard)/settings/team/page.tsx` |

### Onboarding Integration

The team invite step in onboarding is **optional and non-blocking**. The user enters email addresses and roles, we fire off `authClient.organization.inviteMember()` for each, and proceed regardless of success/failure. Invitations are asynchronous -- the invitees join later.

**Why invites are not in the onboarding form schema:** The invite step does not submit data to `completeOnboarding()`. It fires independent API calls via the Better Auth client. If invites were part of the form schema:
- A bad email would fail validation and block onboarding completion
- The `completeOnboarding()` server action would need to call Better Auth's invite API, mixing concerns
- If invite sending fails (rate limit, network), the entire onboarding fails

Instead, the invite step has its own local state and fires invites directly from the client component. The wizard's "Complete Setup" button on this step calls `completeOnboarding()` (for the profile data from steps 1-4) and fires invite requests in parallel (non-blocking, toast on success/failure).

### Schema Impact

None -- the `invitation` table already exists from the Better Auth organization plugin. No migration needed for this feature.

---

## Feature 4: Vercel Cron for Daily Scraping

### Configuration

**Confidence:** HIGH (verified via official Vercel docs)

The existing `node-cron` scheduler in `src/lib/scraper/scheduler.ts` **does not work on Vercel**. Vercel serverless functions are stateless -- there is no long-running process to hold the cron schedule. This must be replaced with Vercel's native cron job system.

**vercel.json configuration:**

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Constraints

| Constraint | Value | Impact |
|-----------|-------|--------|
| Max duration (Pro + Fluid Compute) | 800 seconds (~13 min) | Scraper must complete in under 13 min |
| Max duration (Hobby) | 60 seconds | Not viable for full pipeline on Hobby |
| Min frequency (Pro) | Once per minute | Daily at 6AM UTC is fine |
| Min frequency (Hobby) | Once per day | Daily is fine, but timing imprecise (up to +59 min) |
| Max cron jobs per project | 100 | Plenty of headroom |
| Production only | Yes | Cron only fires on production deployment |
| No automatic retries | -- | Must handle failures gracefully within the run |
| Idempotency needed | -- | Vercel may invoke the same cron event twice; scraper upserts are already idempotent |
| Timezone | UTC only | Schedule accordingly |
| HTTP method | GET only | Vercel Cron sends GET requests, not POST |

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| Cron scraper route | NEW | `src/app/api/cron/scrape/route.ts` |
| `vercel.json` | NEW | project root |
| CRON_SECRET env var | NEW | Vercel dashboard |
| `scheduler.ts` | DEPRECATE | `src/lib/scraper/scheduler.ts` (remove node-cron usage) |

### Cron Route Implementation Pattern

```typescript
// src/app/api/cron/scrape/route.ts
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET (Vercel sends as Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Run pipeline (reuse existing infrastructure)
  const { initializeAdapters } = await import("@/lib/scraper/adapters");
  const { getRegisteredAdapters, clearAdapters } = await import("@/lib/scraper/registry");
  const { runPipeline } = await import("@/lib/scraper/pipeline");

  try {
    initializeAdapters();
    const adapters = getRegisteredAdapters();
    const result = await runPipeline(adapters);
    clearAdapters();
    return Response.json(result);
  } catch (error) {
    clearAdapters();
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
```

**Key point:** The existing `/api/scraper/run` route uses POST. The cron route must use GET because Vercel Cron sends GET requests. The existing POST route remains for manual triggers but must also be secured (currently has a `// TODO: Add auth guard` comment).

### Timeout Risk

The scraper runs 8 adapters sequentially. If each adapter takes 30-90 seconds, total time could be 4-12 minutes. This fits within the 800-second Fluid Compute limit on Pro, but is tight.

**Mitigation options if timeout is hit:**
1. Run adapters in parallel with `Promise.allSettled()` instead of sequentially (fastest fix)
2. Split into per-adapter cron jobs (e.g., `/api/cron/scrape/permits`, `/api/cron/scrape/bids`, `/api/cron/scrape/news`)
3. Use a fan-out pattern where the cron route triggers individual adapter runs via internal fetch() calls

### node-cron Deprecation

The `scheduler.ts` file and `node-cron` dependency can be removed after Vercel Cron is working. The `node-cron` package in `package.json` and `@types/node-cron` in devDependencies should be removed as cleanup.

---

## Feature 5: First-Login Scraper Trigger

### Decision: Async Job, Not Blocking

**Confidence:** HIGH

The scraper takes 4-12 minutes to complete. Blocking the first dashboard load for that long is unacceptable. The scraper must run asynchronously.

### Trigger Mechanism

Detect "first visit for this org" by checking if leads exist within the org's geographic area. This check happens in the dashboard page component.

**Detection logic:**
```
User lands on /dashboard (layout guard passes)
    → Dashboard page queries lead count within org's service radius
    → If zero leads AND org created recently (< 24h):
        → Fire async scraper trigger
        → Show "Generating your first leads..." UI
    → If leads exist:
        → Show normal lead feed
```

### Implementation: Fire-and-Forget with Polling

The dashboard fires a server action that internally calls the scraper API, then the client polls for results.

```
Dashboard Page Load (0 leads detected)
    ↓
Server action: triggerFirstScrape()
    → Internally calls /api/scraper/run via fetch()
    → Returns immediately (does not await pipeline completion)
    ↓
Client shows "Generating leads..." skeleton UI
    ↓
Client polls a lightweight lead-count endpoint every 10s
    ↓
When lead count > 0 → router.refresh() to show real data
```

### Progress Display

Since the scraper runs in a separate serverless function invocation, the dashboard cannot observe it in real-time. Two options:

1. **Simple lead-count polling** (recommended): Client polls a lightweight endpoint that counts leads in the org's radius. When count > 0, refresh the page. Show a loading skeleton with "We're finding leads near [city]..." messaging. Simple, no new schema needed.

2. **Scraper status table** (more complex): A `scraper_runs` table tracks pipeline status per adapter. The dashboard polls this table for granular progress ("Found 12 permits, checking bid boards..."). More informative but adds schema complexity that may not be worth it for the MVP.

**Recommendation:** Start with simple polling (#1). Upgrade to #2 only if user feedback indicates the wait feels too opaque.

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| `triggerFirstScrape()` | NEW server action | `src/actions/scraper.ts` |
| `getLeadCountForOrg()` | NEW utility | `src/lib/leads/queries.ts` |
| First-login empty state | NEW component | `src/components/dashboard/first-run-loader.tsx` |
| Lead count API endpoint | NEW | `src/app/api/leads/count/route.ts` |
| Dashboard page | MODIFY | `src/app/(dashboard)/dashboard/page.tsx` |
| `/api/scraper/run` auth guard | MODIFY | `src/app/api/scraper/run/route.ts` |

### Security Consideration

The `/api/scraper/run` endpoint currently has no auth guard (`// TODO: Add auth guard`). Before enabling first-login triggers:
- Add session-based auth to prevent unauthorized access
- Add rate limiting (one trigger per org per hour) to prevent abuse
- The cron route (`/api/cron/scrape`) uses CRON_SECRET, which is separate from session auth

### On-Demand "Refresh Leads" Button

Same mechanism as first-login trigger, but user-initiated from the dashboard. A "Refresh Leads" button fires `triggerFirstScrape()` and shows a brief loading state. Rate-limit to prevent abuse (e.g., max once per hour per org).

---

## Feature 6: Custom Search

### Architecture: Extension of Existing Query Layer

**Confidence:** MEDIUM (depends on how search queries map to scraper adapters)

Custom search is user-initiated: the user specifies a location, keywords, and/or project type, and gets results beyond their default geo-filtered feed.

### Two Approaches

**Option A: Query-time filtering of existing leads (recommended for MVP)**
- Search across all leads in the database with a different geographic center
- Fast (milliseconds), no new scraping needed
- Limited to already-scraped data, but the daily cron populates a growing lead pool

**Option B: On-demand scraping with custom parameters (future enhancement)**
- Trigger specific adapters with user-provided search terms
- Slow (minutes), but discovers new data
- More complex, risk of abuse

**Recommendation:** Option A for the v2.0 milestone. The existing `getFilteredLeads()` function already supports keyword, date range, equipment, and project size filters. Custom search just needs a different center point (user-specified location instead of HQ) and a potentially wider radius.

### Integration with Existing Query Layer

The `getFilteredLeads()` in `src/lib/leads/queries.ts` already accepts all needed parameters:

```typescript
interface GetFilteredLeadsParams {
  hqLat: number;              // Override with search location lat
  hqLng: number;              // Override with search location lng
  serviceRadiusMiles: number; // Override with search radius
  dealerEquipment: string[];  // From org profile (or override)
  keyword?: string;           // Already supported
  dateFrom?: Date;            // Already supported
  dateTo?: Date;              // Already supported
  minProjectSize?: number;    // Already supported
  maxProjectSize?: number;    // Already supported
  // ...
}
```

Custom search calls `getFilteredLeads()` with a geocoded search location instead of HQ coordinates. No new query logic needed.

### New Components and Modifications

| Item | Type | Location |
|------|------|----------|
| Custom search page | NEW | `src/app/(dashboard)/dashboard/search/page.tsx` |
| Search form component | NEW | `src/components/search/custom-search-form.tsx` |
| Search results component | NEW (or reuse lead-card) | `src/components/search/search-results.tsx` |
| Geocode search location | REUSE | `src/lib/geocoding.ts` (already exists) |
| Search server action | NEW | `src/actions/search.ts` |
| Sidebar nav link | MODIFY | `src/app/(dashboard)/layout.tsx` |

### Data Flow

```
User enters: location="Denver, CO", keyword="crane", radius=100mi
    ↓
Server action: geocodeAddress("Denver, CO") → { lat, lng }
    ↓
getFilteredLeads({
  hqLat: denverLat,           // Override HQ with search location
  hqLng: denverLng,
  serviceRadiusMiles: 100,    // Override with search radius
  keyword: "crane",
  dealerEquipment: orgProfile.equipmentTypes,
})
    ↓
Return enriched leads → render in search results (reuse lead-card component)
```

### Saved Search Enhancement

Custom searches should be saveable to the existing `saved_searches` table. The table already stores: `keyword`, `radiusMiles`, `equipmentFilter`, date/size filters, and `isDigestEnabled`. For custom searches with a different center, add:

```typescript
// New columns on saved_searches table
searchLat: real("search_lat"),          // null = use HQ
searchLng: real("search_lng"),          // null = use HQ
searchLocation: text("search_location"), // display name, e.g. "Denver, CO"
```

When `searchLat`/`searchLng` are null, the saved search uses the org's HQ (current behavior). When populated, it uses the custom location.

---

## Recommended Project Structure (Changed Files Summary)

```
src/
├── actions/
│   ├── billing.ts              # MODIFY: add createTrialSubscription()
│   ├── onboarding.ts           # MODIFY: handle new fields, trigger trial
│   ├── scraper.ts              # NEW: triggerFirstScrape(), refreshLeads()
│   └── search.ts               # NEW: custom search action
├── app/
│   ├── (auth)/
│   │   └── accept-invite/
│   │       └── [id]/
│   │           └── page.tsx    # NEW: invitation acceptance
│   ├── (billing)/
│   │   └── billing/
│   │       └── page.tsx        # MODIFY: trial-aware UI states
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # MODIFY: first-run detection + empty state
│   │   │   └── search/
│   │   │       └── page.tsx    # NEW: custom search page
│   │   ├── settings/
│   │   │   └── team/
│   │   │       └── page.tsx    # NEW: team management
│   │   └── layout.tsx          # MODIFY: add search nav, trial banner
│   └── api/
│       ├── cron/
│       │   └── scrape/
│       │       └── route.ts    # NEW: Vercel Cron endpoint (GET)
│       ├── scraper/
│       │   └── run/
│       │       └── route.ts    # MODIFY: add auth guard
│       └── leads/
│           └── count/
│               └── route.ts    # NEW: lightweight lead count for polling
├── components/
│   ├── dashboard/
│   │   └── first-run-loader.tsx    # NEW: first-login loading state
│   ├── emails/
│   │   └── team-invite.tsx         # NEW: invite email template
│   ├── onboarding/
│   │   ├── wizard-shell.tsx        # MODIFY: add new steps to STEPS array
│   │   ├── step-company-details.tsx # NEW
│   │   ├── step-team-invites.tsx    # NEW
│   │   └── logo-upload.tsx          # NEW
│   └── search/
│       ├── custom-search-form.tsx   # NEW
│       └── search-results.tsx       # NEW
├── lib/
│   ├── auth.ts                 # MODIFY: add sendInvitationEmail callback
│   ├── billing.ts              # MODIFY: trial expiry logic
│   ├── db/schema/
│   │   ├── company-profiles.ts # MODIFY: add website, phone, industrySegment
│   │   └── saved-searches.ts   # MODIFY: add searchLat/Lng/Location
│   ├── scraper/
│   │   └── scheduler.ts        # DEPRECATE: replace with Vercel Cron
│   └── validators/
│       └── onboarding.ts       # MODIFY: add new company detail fields
└── vercel.json                  # NEW: cron configuration
```

## Architectural Patterns

### Pattern 1: Trial via Direct DB Insert (Bypass Plugin Lifecycle)

**What:** Create a "trialing" subscription row directly in the database at signup, bypassing the @better-auth/stripe plugin's checkout flow.
**When to use:** When a free trial requires zero payment information and zero external redirects.
**Trade-offs:**
- PRO: Seamless UX -- user completes onboarding and lands directly on the dashboard
- PRO: Works with existing `getActiveSubscription()` guard unchanged
- CON: Bypasses plugin's managed lifecycle; must handle trial expiry manually
- CON: Must stay compatible with future @better-auth/stripe schema changes (pin version)

### Pattern 2: Wizard Step Array Extension

**What:** The onboarding wizard defines steps as an array of `{ component, label, fields }` objects. Adding steps means adding entries to this array.
**When to use:** Any time the wizard needs new steps.
**Trade-offs:**
- PRO: No structural changes to wizard navigation logic
- PRO: Steps can be conditionally included (e.g., skip invites for solo users)
- CON: All form data must fit in a single `useForm` instance, or the wizard must handle steps with independent state

**Key decision:** The team invites step has independent state (not part of the onboarding form). The wizard shell needs to accommodate steps that are "action steps" (fire API calls) vs. "form steps" (collect form data). This can be handled by making the step's `fields` array empty for non-form steps and having the step component manage its own state.

### Pattern 3: Fire-and-Forget with Client Polling

**What:** Trigger a long-running operation via server action (which internally calls an API), then poll a lightweight endpoint from the client.
**When to use:** When an operation exceeds acceptable page-load time (>3s) but doesn't justify WebSockets or a queue system.
**Trade-offs:**
- PRO: Simple to implement in Vercel's serverless model (no WebSockets, no persistent connections)
- PRO: Polling interval can be tuned (10s is reasonable for the scraper use case)
- CON: Unnecessary network requests while polling; accept this tradeoff for simplicity
- CON: If the serverless function times out mid-pipeline, partial results are still written (pipeline is fault-tolerant per-adapter)

### Pattern 4: Query Reuse with Parameter Override

**What:** Custom search reuses `getFilteredLeads()` with overridden lat/lng center instead of building a separate query path.
**When to use:** When the existing query already supports the needed filters and just needs a different origin point.
**Trade-offs:**
- PRO: Single source of truth for lead enrichment, scoring, and filtering
- PRO: No query duplication or divergence
- CON: Custom search inherits the same scoring algorithm as the default feed (may want different scoring for exploratory searches in the future)

## Data Flow Changes: v1.0 vs v2.0

### Current Flow (v1.0)

```
Sign-up → Onboarding (3 steps) → /billing → Stripe Checkout → /dashboard
Manual POST to /api/scraper/run → leads appear
```

### New Flow (v2.0)

```
Sign-up → Onboarding (5 steps: company, location, equipment, radius, invites)
    → Trial subscription created (no checkout)
    → /dashboard (first-run: trigger async scrape + loading state)
    → Leads appear via polling (seconds to minutes)
    → Trial banner: "X days left" in sidebar
    → Trial expires → redirect to /billing → Stripe Checkout → /dashboard

Daily: Vercel Cron GET /api/cron/scrape → pipeline → new leads
On-demand: "Refresh Leads" button → POST /api/scraper/run (authed)
Custom: Search page → geocode input → getFilteredLeads(custom center)
Team: Invites sent during onboarding → recipients get email → accept → join org
```

### Guard Chain (Updated)

```
Dashboard Layout Guard:
  1. auth check → no session → /sign-in (unchanged)
  2. activeOrganizationId check → no org → /onboarding (unchanged)
  3. onboarding check → not completed → /onboarding (unchanged)
  4. subscription check → getActiveSubscription()
     → Returns "active" or "trialing" (with trialEnd > now) → continue
     → Returns null (no sub or expired trial) → /billing
  5. Content rendered
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 orgs | Current architecture is fine. Single cron run at 6AM UTC. Shared lead pool filtered per-org by geography. |
| 100-1K orgs | Scraper timing matters. If pipeline exceeds 800s, parallelize adapters or split into multiple cron jobs. Custom search may slow with 500K+ leads -- add DB index on (lat, lng). |
| 1K+ orgs | Geo queries become the bottleneck. Add PostGIS for spatial indexing. Move scraper to dedicated compute (not serverless). Consider per-region lead partitioning. |

### First Bottleneck: Scraper Timeout on Vercel

The scraper running 8 adapters sequentially is the first constraint. External data fetching is unpredictable.
- **Detect:** Monitor cron job execution time in Vercel logs.
- **Fix:** Parallelize adapters with `Promise.allSettled()`, or split into per-adapter cron routes.

### Second Bottleneck: Haversine Query Performance

The Haversine distance formula in SQL evaluates per-row. At 100K+ leads, the full-table scan becomes noticeable.
- **Detect:** Dashboard page load time exceeds 2s.
- **Fix:** Add a bounding-box pre-filter (`WHERE lat BETWEEN x-d AND x+d AND lng BETWEEN y-d AND y+d`) before the trig calculation. Or add PostGIS with a spatial index.

## Anti-Patterns

### Anti-Pattern 1: Blocking Scraper on First Login

**What people do:** Await the full scraper pipeline before rendering the dashboard.
**Why it's wrong:** 4-12 minute blank screen. User abandons.
**Do this instead:** Render immediately with a loading skeleton, trigger scraper async, poll for results.

### Anti-Pattern 2: Storing Trial State Outside the Subscription Table

**What people do:** Add `trialExpiresAt` to the `organization` or `user` table.
**Why it's wrong:** Two sources of truth for access control. The billing guard checks subscriptions; a separate trial field requires parallel checks and can fall out of sync.
**Do this instead:** Use the existing subscription table with `status: "trialing"` and `trialEnd`. Guard logic stays in `getActiveSubscription()`.

### Anti-Pattern 3: Coupling Invite Step to Onboarding Form Submission

**What people do:** Include invite emails in the onboarding form schema and send invites inside `completeOnboarding()`.
**Why it's wrong:** If invite sending fails (bad email, rate limit, network error), the entire onboarding fails. The critical path (company setup) fails because of a non-critical operation (invites).
**Do this instead:** Fire invites as separate non-blocking calls from the client. Toast on success/failure but never gate onboarding completion on invite success.

### Anti-Pattern 4: Using node-cron on Vercel

**What people do:** Import `node-cron` and call `cron.schedule()` in a server module.
**Why it's wrong:** Vercel functions are ephemeral. There is no persistent process. The cron schedule evaporates when the function cold-starts or the instance is recycled.
**Do this instead:** Use Vercel's native cron configuration in `vercel.json`, which triggers HTTP GET requests to your API routes on schedule.

### Anti-Pattern 5: Building a Separate Search Query

**What people do:** Write a completely new database query function for custom search, duplicating the enrichment/scoring/filtering logic from `getFilteredLeads()`.
**Why it's wrong:** Two query paths diverge over time. Bug fixes in one are missed in the other. Scoring logic differs silently.
**Do this instead:** Parameterize the existing `getFilteredLeads()` and call it with different center coordinates. One function, many entry points.

## Integration Points

### External Services

| Service | Integration Pattern | Gotchas |
|---------|---------------------|---------|
| Stripe | @better-auth/stripe plugin for paid subscriptions; direct DB write for trial | Trial rows bypass plugin lifecycle; must not conflict with later checkout flow |
| Vercel Cron | `vercel.json` + GET route handler with CRON_SECRET | Production-only; Hobby plan = once/day with imprecise timing; no retries |
| Resend | Invitation emails + existing digest emails | Rate limits (100/day on free tier); invitation emails must include accept link |
| Vercel Blob (new) | Logo upload storage | Requires `@vercel/blob` package; client-side upload via signed URLs |
| Neon | Drizzle ORM queries | Serverless HTTP driver handles connection pooling; be aware of concurrent queries from cron + user requests |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Onboarding -> Trial | Server action chain | `completeOnboarding()` calls `createTrialSubscription()` sequentially |
| Onboarding -> Invites | Client-side calls | `authClient.organization.inviteMember()` fired from step component, not from server action |
| Dashboard -> Scraper | Server action -> internal fetch | `triggerFirstScrape()` calls `/api/scraper/run` internally |
| Dashboard -> Lead Count | Client polling | Lightweight GET endpoint polled every 10s during first-run loading |
| Cron -> Scraper | HTTP GET (Vercel-initiated) | Same pipeline code, different trigger (GET + CRON_SECRET vs. POST + session) |
| Custom Search -> Lead Queries | Direct function call | Reuses `getFilteredLeads()` with overridden lat/lng params |
| Invites -> Better Auth | Client SDK | `authClient.organization.inviteMember()` triggers server-side plugin |
| Invites -> Resend | Server callback | `sendInvitationEmail` in auth config calls Resend API |

## Build Order Recommendation

Based on dependency analysis of the existing guard chain and feature dependencies:

| Order | Feature | Depends On | Rationale |
|-------|---------|------------|-----------|
| 1 | Free trial + Stripe fix | Nothing | Unblocks user access -- without this, every new user hits a paywall |
| 2 | Vercel Cron | Nothing | Unblocks lead generation -- dashboard is empty without automated scraping |
| 3 | First-login scraper trigger | Secured scraper API (#2) | Ensures new users see leads immediately, not after the next daily cron |
| 4 | Onboarding expansion | Trial in place (#1) | Benefits from trial being active so expanded onboarding flows into the dashboard |
| 5 | Team invites | Onboarding expansion (#4) | The invite step is added to the expanded wizard; also needs sendInvitationEmail config |
| 6 | Custom search | Nothing (parallel-safe) | Independent feature, can be built alongside #4-5 |

**Critical path:** Features 1 and 2 together create the minimum "try before you buy" experience: user signs up, completes onboarding, gets a trial, and sees leads generated by the cron. Features 3-6 are enhancements on top of that foundation.

## Sources

- [Better Auth Organization Plugin](https://better-auth.com/docs/plugins/organization) -- inviteMember API, sendInvitationEmail, invitation acceptance flow
- [Better Auth Stripe Plugin](https://better-auth.com/docs/plugins/stripe) -- freeTrial configuration, subscription lifecycle
- [GitHub Issue #4631: Trial without checkout](https://github.com/better-auth/better-auth/issues/4631) -- confirmed no official API for checkout-free trials; closed as "not planned"
- [GitHub Issue #4046: Trial fields fix](https://github.com/better-auth/better-auth/issues/4046) -- trialStart/trialEnd bug fixed in PR #4121
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- configuration format, production-only, GET method, cron expressions
- [Vercel Cron Management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) -- CRON_SECRET, timeout = function timeout, no retries, idempotency requirement
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Hobby: once/day; Pro: once/min; 100 cron jobs per project
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- Pro: 60s default, 800s with Fluid Compute
- [Stripe Trials without Payment](https://docs.stripe.com/billing/subscriptions/trials) -- trial_period_days, payment_method_collection: "if_required"

---
*Architecture research for: HeavyLeads v2.0 feature integration*
*Researched: 2026-03-15*
