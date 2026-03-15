# Feature Research: v2.0 Production Rework

**Domain:** B2B SaaS lead intelligence platform (construction/heavy machinery)
**Researched:** 2026-03-15
**Confidence:** HIGH (patterns verified across Stripe docs, Vercel docs, and multiple B2B SaaS sources)

## Feature Landscape

This research covers the five new feature areas for HeavyLeads v2.0. Each is assessed against industry B2B SaaS patterns, the existing codebase, and the specific constraints of Vercel deployment with Stripe billing.

---

### Table Stakes (Users Expect These)

Features users assume exist. Missing these means the product feels broken or amateurish.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free trial without credit card | Every modern B2B SaaS offers risk-free exploration. Requiring CC upfront loses ~50% of potential signups. | MEDIUM | Better-auth's Stripe plugin does NOT natively support no-CC trials. Must implement at the application level with a `trialEndsAt` column on `company_profiles`, not through Stripe Checkout. |
| Trial countdown banner | Users need to know how long they have left. Without it, trial feels undefined and conversions drop. | LOW | Persistent banner in dashboard layout showing days remaining. Computed from `trialEndsAt` minus current date. |
| Trial expiry gate | When trial ends, users must be prompted to subscribe or lose access. Ungated expired trials train users to never pay. | LOW | Middleware check: if `trialEndsAt < now` AND no active subscription, redirect to billing page with "Trial expired" messaging. |
| Company details in onboarding | B2B products that skip company branding feel like toys. Company name/logo/website establish organizational identity. | LOW | Add 1 new step to existing wizard. New columns on `company_profiles`: `companyName`, `website`, `phone`, `logoUrl`, `industrySegment`. |
| Empty state for new users | Dashboard with zero leads looks broken. New users conclude the product does not work and leave within 30 seconds. | MEDIUM | Must trigger lead generation on first login AND show informative empty state with progress indicator while pipeline runs. |
| Automatic daily lead refresh | The core value proposition is "fresh leads every morning." Without automation, the product delivers nothing until someone manually hits an API endpoint. | MEDIUM | Vercel Cron job at `/api/cron/scrape` triggered daily. Hobby plan allows once/day with up to 5 min execution (fluid compute). Must convert existing `node-cron` scheduler to Vercel Cron via `vercel.json`. |
| On-demand lead refresh | Power users expect to be able to manually trigger a data update when they want fresh results NOW, not wait until tomorrow. | LOW | Button in dashboard header calling the existing `/api/scraper/run` endpoint with proper auth guard. Rate-limit to 1 per hour per org. |
| Pre-expiry conversion emails | Industry standard: nudge at 3 days remaining, 1 day remaining, and on expiry day. Without these, users forget they are on trial and simply churn. | MEDIUM | Trigger-based emails (not time-based). Check trial status in daily cron. Use existing email infrastructure (Resend). |

### Differentiators (Competitive Advantage)

Features that set HeavyLeads apart from ConstructConnect, PlanHub, and generic lead gen platforms.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Guided dashboard tour | Reduces time-to-value from minutes to seconds. Most B2B lead platforms dump users into a complex dashboard with no guidance. A 5-6 step tour showing lead feed, filters, lead details, bookmarks, and saved searches creates an immediate "aha" moment. | MEDIUM | Use Driver.js (4KB, framework-agnostic, Next.js compatible) over React Joyride (not updated for React 19). Tour triggers once after onboarding completion via a `hasSeenTour` flag on user record. |
| First-login lead trigger | While competitors make you wait 24 hours for your first batch of leads, HeavyLeads shows you relevant leads within minutes of completing onboarding. This is the single most important differentiator for trial conversion. | HIGH | Trigger scraping pipeline immediately after onboarding completes. Must run asynchronously (fire-and-forget from the client perspective) because pipeline takes 1-3 minutes. Show a progress card in dashboard: "Finding leads near [city]... checking permits, bids, news..." |
| Team invite during onboarding | Most B2B lead platforms require the admin to invite team members after setup, which means the team never gets invited. Embedding invites in onboarding gets the whole team using the product during the trial window, dramatically increasing conversion. | MEDIUM | New wizard step after company details. Uses existing better-auth organization plugin's `inviteMember` API. Invite via email with "Skip for now" option. |
| Custom search beyond defaults | Users can search for leads in a location, keyword, or project type that is different from their onboarding defaults. Competitors like ConstructConnect charge extra for broader search. HeavyLeads includes it. | MEDIUM | Separate search page/modal with city/state, keywords, project type fields. Runs the existing scraping pipeline against user-specified parameters (not just the org defaults). Results merge into the main lead feed with a "custom search" source tag. |
| Pipeline progress indicator | When lead generation is running (first-login or on-demand), show real-time progress: which adapters are running, how many leads found so far, estimated time remaining. This turns a boring wait into engagement. | MEDIUM | Server-Sent Events (SSE) or polling endpoint. Pipeline already tracks per-adapter results. Expose status via `/api/scraper/status` endpoint with adapter-level progress. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly choosing NOT to build these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Freemium tier (permanent free plan) | "Let users always use a limited version for free." | Heavy machinery sales teams either need the product or they do not. A freemium tier creates support burden for users who will never convert, and devalues the product. The pipeline has real scraping/geocoding costs per-org. | 7-day free trial with full access. Users experience full value, then make a clear buy/no-buy decision. |
| Credit card required at trial start | "Higher quality leads, fewer spam signups." | Cuts signups by ~50% per industry data. For a niche B2B product, every signup matters. Spam risk is low because signup requires email verification + org creation. | Application-level trial (no Stripe involvement until conversion). Bot prevention via email verification in better-auth. |
| Real-time lead notifications (push/SMS) | "Notify me instantly when a new lead appears." | Scraping runs daily/on-demand, not real-time. Push notifications for batch data create false urgency and notification fatigue. Construction projects do not require minute-level response times. | Daily email digest (already built). On-demand refresh button for when users actively want fresh data. |
| Unlimited custom searches | "Let me search any city, any time." | Each custom search runs the full scraping pipeline against 8 adapters with geocoding. Unrestricted access creates infrastructure cost issues and potential scraper rate-limit/ban risks. | Rate-limited custom search: 3 per day during trial, 10 per day on paid plan. Queue-based with clear limits shown in UI. |
| AI-generated lead summaries | "Use AI to summarize each lead." | Adds LLM API costs per-lead, latency to every page load, and questionable value -- the leads already have structured data (title, description, equipment inference, scoring). AI summaries would paraphrase existing data. | Existing equipment inference + scoring provides structured intelligence without LLM costs. |
| Onboarding video walkthrough | "Record a video showing how to use the product." | Videos go stale quickly as UI changes. Users skip them. They are a maintenance burden. | Interactive guided tour (Driver.js) that walks through the actual live UI. Always up-to-date because it highlights real elements. |
| Multi-step trial extensions | "Let users request a trial extension if they haven't explored enough." | Creates operational overhead, inconsistent policies, and trains users to ask for free access instead of converting. | One extension option: 3 additional days, granted automatically if user completed onboarding but has not yet subscribed. One-time only, tracked in DB. |

## Feature Dependencies

```
[Free Trial System]
    |-- requires --> [Fix Stripe Customer Creation Bug]
    |-- requires --> [Application-Level Trial Tracking]
    |                    |-- requires --> [company_profiles.trialEndsAt column]
    |                    |-- enables --> [Trial Countdown Banner]
    |                    |-- enables --> [Trial Expiry Gate (middleware)]
    |                    |-- enables --> [Pre-Expiry Conversion Emails]
    |
    |-- must-precede --> [Billing Page Updates] (show trial status, not just subscription)

[Professional Onboarding]
    |-- extends --> [Existing 3-Step Wizard]
    |-- requires --> [company_profiles schema additions]
    |-- step: Company Details
    |-- step: Team Invites
    |       |-- requires --> [better-auth organization.inviteMember API]
    |-- step: Existing Location
    |-- step: Existing Equipment
    |-- step: Existing Radius
    |-- after-complete --> [First-Login Lead Trigger]
    |                          |-- requires --> [Automatic Lead Generation]
    |-- after-complete --> [Guided Dashboard Tour]
    |                          |-- requires --> [Dashboard has leads to show]
    |                          |-- requires --> [Driver.js integration]

[Automatic Lead Generation]
    |-- requires --> [Vercel Cron Configuration (vercel.json)]
    |-- requires --> [Auth guard on /api/scraper/run]
    |-- requires --> [Convert node-cron scheduler to Vercel Cron]
    |-- enables --> [First-Login Lead Trigger]
    |-- enables --> [On-Demand Refresh Button]
    |-- enables --> [Pipeline Progress Indicator]

[Custom Search]
    |-- extends --> [Existing Scraping Pipeline]
    |-- extends --> [Existing Saved Searches]
    |-- requires --> [New custom_searches table or extension of saved_searches]
    |-- requires --> [Rate limiting per org]
    |-- requires --> [Automatic Lead Generation working first]

[Guided Dashboard Tour]
    |-- requires --> [Leads visible in dashboard]
    |       |-- requires --> [First-Login Lead Trigger complete]
    |-- requires --> [Driver.js installed]
    |-- triggered-by --> [Onboarding completion + hasSeenTour flag]
```

### Dependency Notes

- **Free Trial requires fixing Stripe bug first:** The Stripe customer creation error during registration must be resolved before trial flow works. Currently, signup fails at Stripe customer creation, which blocks everything downstream.
- **First-Login Lead Trigger requires Automatic Lead Generation:** The pipeline must be callable from server actions/API routes before it can be triggered on first login. The existing `node-cron` scheduler does not work on Vercel serverless.
- **Guided Tour requires leads in dashboard:** Showing a tour of an empty dashboard is counterproductive. The tour must fire AFTER the first-login lead trigger has populated at least some leads. This means: onboarding completes -> trigger pipeline -> show progress indicator -> when leads arrive -> trigger tour.
- **Custom Search requires working pipeline:** Custom search extends the scraping pipeline with user-specified parameters. The pipeline must be reliably callable and monitored before adding user-triggered ad-hoc runs.
- **Team Invites are independent:** The better-auth organization plugin already supports `inviteMember`. This step can be built in parallel with other onboarding work.

## Implementation Priority (v2.0 Scope)

### Phase 1: Foundation (Must Ship First)

Critical path items that unblock everything else.

- [ ] **Fix Stripe customer creation error** -- Production blocker. Auth/billing flow is broken. Debug the better-auth Stripe plugin configuration.
- [ ] **Application-level free trial** -- Add `trialEndsAt` to `company_profiles`, set to `now + 7 days` on org creation. Middleware gate checks trial OR subscription status.
- [ ] **Trial countdown banner** -- Persistent UI element showing days remaining in trial. Simple date math from `trialEndsAt`.
- [ ] **Trial expiry redirect** -- Middleware: expired trial + no subscription = redirect to billing with "Trial expired" message.

### Phase 2: Professional Onboarding

Transform the thin 3-step wizard into a professional B2B experience.

- [ ] **Company details step** -- New step 1 in wizard: company name, website, phone, logo upload, industry segment.
- [ ] **Team invite step** -- New step 2: email-based invites using better-auth org plugin. "Skip for now" option.
- [ ] **Updated billing page** -- Show trial status ("5 days remaining"), conversion CTA, feature comparison. Not just "Subscribe."

### Phase 3: Automatic Lead Generation

The core value enabler -- making leads appear automatically.

- [ ] **Vercel Cron configuration** -- Create `vercel.json` with daily cron job. Auth guard via `CRON_SECRET`.
- [ ] **Cron API route** -- New `/api/cron/scrape` GET handler (Vercel Cron sends GET, not POST). Replace `node-cron` scheduler.
- [ ] **First-login lead trigger** -- After onboarding completes, fire pipeline asynchronously. Show progress card in dashboard.
- [ ] **On-demand refresh** -- "Refresh Leads" button in dashboard header. Rate-limited, shows progress.
- [ ] **Pipeline progress indicator** -- Polling endpoint or SSE for pipeline status. Per-adapter progress.
- [ ] **Empty state design** -- Informative card when no leads: "We're finding leads near [city]..." with progress, or "No leads yet" with action prompts.

### Phase 4: Guided Tour + Custom Search

Polish features that maximize trial conversion and engagement.

- [ ] **Dashboard tour** -- Driver.js integration. 5-6 steps covering lead feed, filters, lead detail, bookmarks, saved searches. Triggered once after first leads arrive.
- [ ] **Custom search page** -- Search form: city/state, keywords, project type. Runs pipeline with custom params. Results merge into lead feed.
- [ ] **Pre-expiry emails** -- Automated emails at 3 days, 1 day, and expiry. Trigger from daily cron check.

### Future Consideration (Post v2.0)

Features to defer until v2.0 is stable and conversion data is available.

- [ ] **One-time trial extension** -- Auto-grant 3 extra days if user completed onboarding but hasn't subscribed. Track in DB. Only worth building after seeing trial conversion metrics.
- [ ] **Onboarding checklist widget** -- Persistent sidebar checklist showing setup progress (company details, team invite, first search, etc.). Nice-to-have after core onboarding works.
- [ ] **Smart conversion triggers** -- Contextual upgrade prompts based on user behavior (e.g., when user hits rate limit on custom search, or bookmarks 5+ leads). Requires usage analytics first.
- [ ] **Custom search scheduling** -- Let users schedule recurring custom searches. Extension of saved searches. Depends on custom search proving valuable.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fix Stripe customer creation | HIGH (blocker) | LOW | P0 |
| Application-level free trial | HIGH | MEDIUM | P1 |
| Trial countdown + expiry gate | HIGH | LOW | P1 |
| Company details onboarding step | MEDIUM | LOW | P1 |
| Team invite onboarding step | MEDIUM | MEDIUM | P2 |
| Vercel Cron daily automation | HIGH | MEDIUM | P1 |
| First-login lead trigger | HIGH | HIGH | P1 |
| Empty state with progress | HIGH | MEDIUM | P1 |
| On-demand refresh button | MEDIUM | LOW | P2 |
| Pipeline progress indicator | MEDIUM | MEDIUM | P2 |
| Guided dashboard tour (Driver.js) | MEDIUM | MEDIUM | P2 |
| Custom search page | MEDIUM | MEDIUM | P2 |
| Pre-expiry conversion emails | MEDIUM | MEDIUM | P2 |
| Updated billing page (trial status) | MEDIUM | LOW | P1 |
| Trial extension (auto 3-day) | LOW | LOW | P3 |
| Onboarding checklist widget | LOW | MEDIUM | P3 |

**Priority key:**
- P0: Production blocker, fix immediately
- P1: Must have for v2.0 launch
- P2: Should have, add in v2.0 if time permits
- P3: Nice to have, defer to v2.1+

## Competitor Feature Analysis

| Feature | ConstructConnect | PlanHub | HeavyLeads (v2.0) |
|---------|------------------|---------|-------------------|
| Free trial | 14-day trial (CC required) | Limited free tier + paid upgrades | 7-day full-access trial, no CC required |
| Onboarding | Minimal -- jumps to project search | Basic profile setup | 5-step wizard with company details, team invites, location, equipment, radius |
| Lead freshness | Updated daily by 400+ researchers (manual data entry) | User-submitted, inconsistent updates | Automated daily scraping from 8 sources + on-demand refresh |
| Search flexibility | Full project database search (paid) | Keyword + location search | Default radius-based feed + custom search with location/keywords/project type |
| Team features | Multi-user dashboards, bid tracking | Unlimited team members, project posting | Org-based multi-tenant, team invites during onboarding, shared lead statuses |
| Guided onboarding | None (complex UI, steep learning curve) | Basic tooltips | Interactive dashboard tour (Driver.js), progress indicators |
| First-use experience | Shows project results immediately (huge existing database) | Shows available bids immediately | Triggers scraping pipeline on first login, shows progress while loading |
| Pricing model | Subscription only (higher price point) | Free tier + paid add-ons | Setup fee + monthly subscription after free trial |

### Key Competitive Insight

ConstructConnect and PlanHub have massive existing databases, so they can show results instantly. HeavyLeads scrapes on-demand, so the first-use experience gap is the biggest risk. The first-login lead trigger with progress indicators is NOT optional -- it is the single most important feature for v2.0 trial conversion. Without it, users complete onboarding, land on an empty dashboard, and leave.

## Detailed Feature Specifications

### 1. Free Trial System

**Standard UX flow (no-CC trial):**
1. User signs up (email + password) -> better-auth creates user + Stripe customer
2. User creates organization -> application sets `trialEndsAt = now + 7 days` on company profile
3. User completes onboarding -> redirected to dashboard (not billing page)
4. Dashboard shows trial banner: "You have X days left in your free trial"
5. At 3 days remaining: email nudge with feature highlights
6. At 1 day remaining: email with urgency + subscribe link
7. On expiry: middleware redirects ALL dashboard routes to billing page with "Trial ended" messaging
8. User subscribes through existing Stripe Checkout flow (setup fee + monthly)

**Why application-level, not Stripe-level trial:**
The better-auth Stripe plugin does not support creating trial subscriptions without checkout (confirmed via GitHub issue #4631, closed as "not planned"). Stripe's own API supports `payment_method_collection=if_required` with `trial_period_days`, but better-auth's abstraction layer does not expose this. Building an application-level trial is simpler, more reliable, and fully within our control:
- Store `trialEndsAt` in `company_profiles`
- Middleware checks: `hasActiveSubscription(orgId) OR trialIsActive(orgId)`
- No Stripe API calls needed during trial period
- Clean conversion: trial expires -> user goes through normal Stripe Checkout

**Trial expiry handling:**
- `missing_payment_method` behavior is moot because we never create a Stripe subscription during trial
- Expiry is enforced purely in middleware
- Expired users see billing page with clear "Your 7-day trial has ended" message and subscribe button

### 2. Professional Onboarding

**Expanded wizard steps (5 steps total):**

| Step | Fields | Validation | Purpose |
|------|--------|------------|---------|
| 1. Company Details | Company name, website (optional), phone (optional), industry segment (dropdown) | Name required, URL format if provided | Establish organizational identity |
| 2. Team Setup | Email addresses for invites, role selection (member/admin) | Valid email format, max 5 invites during onboarding | Get the whole team on board during trial |
| 3. Location | HQ address (existing) | Address geocodes successfully | Geographic center for lead matching |
| 4. Equipment | Equipment types (existing) | At least 1 selected | Equipment matching for lead scoring |
| 5. Service Radius | Radius slider (existing) | 10-500 miles range | Geographic filter for lead feed |

**Industry segment options for heavy machinery:** Equipment Rental, Equipment Sales, Equipment Service/Repair, General Contractor, Specialty Contractor, Material Supplier, Other.

**What makes onboarding feel polished (B2B patterns):**
- Progress bar showing "Step 2 of 5: Team Setup"
- Ability to go back to previous steps without losing data (already implemented)
- Contextual helper text explaining WHY each piece of information matters
- "Skip for now" on optional steps (team invite, company website/phone)
- Completion animation/celebration moment before redirect
- Logo upload with preview (drag-and-drop or file picker)

### 3. Guided Dashboard Tour

**Table stakes for product tours:**
- Spotlight/highlight effect on target element
- Tooltip with step description positioned near the highlighted element
- Step counter ("2 of 6")
- Next/Back/Skip navigation
- Dim/overlay on non-highlighted areas
- Keyboard navigation (Escape to skip, Enter to advance)

**Nice-to-have tour features (defer):**
- Branching tours based on user role
- Analytics on tour completion rates
- Re-triggerable from help menu
- Video embeds in tour steps

**Recommended tour steps (6 steps):**
1. **Lead Feed** -- "This is your lead feed. We found X leads near [city] matching your equipment."
2. **Lead Card** -- "Each card shows project details, equipment needs, and a relevance score."
3. **Filters** -- "Filter by equipment type, radius, keywords, date range, and project size."
4. **Lead Detail** (navigate to one) -- "Click a lead to see full details, map, timeline, and sources."
5. **Bookmarks** -- "Bookmark leads to review later. Your team can see shared bookmarks."
6. **Saved Searches** -- "Save filter combinations and get daily email digests for new matches."

**Technology choice: Driver.js**
- 4KB gzipped, zero dependencies, framework-agnostic
- Works with Next.js App Router via dynamic import in client components
- Active maintenance, compatible with React 18/19
- React Joyride has NOT been updated for React 19 and has stale maintenance (9+ months without updates)

### 4. Automatic Lead Generation

**Daily cron pattern:**
- Vercel Cron sends GET to `/api/cron/scrape` once daily at 06:00 UTC
- Route validates `Authorization: Bearer ${CRON_SECRET}` header (Vercel auto-injects for legitimate cron calls)
- Function initializes adapters, runs pipeline, triggers email digest
- `maxDuration = 300` (5 minutes, Hobby plan max with fluid compute)
- Idempotent: pipeline upserts leads, so duplicate cron invocations are safe

**First-use experience pattern:**
1. User completes onboarding
2. Server action fires async POST to `/api/scraper/run` (with auth)
3. Dashboard shows progress card: "Finding leads near Austin, TX..."
4. Progress states: "Checking city permits... Scanning government bids... Searching construction news..."
5. Polling endpoint `/api/scraper/status` returns `{ running: boolean, adaptersComplete: number, totalAdapters: number, leadsFound: number }`
6. When complete: progress card transitions to lead feed. Tour triggers.
7. If pipeline finds 0 leads: show helpful empty state with suggestions (expand radius, check equipment types)

**On-demand refresh:**
- Button in dashboard header: "Refresh Leads" with refresh icon
- Rate-limited: 1 per hour per organization
- Shows inline progress (same as first-use but smaller/less prominent)
- Disabled state with tooltip when rate-limited: "Next refresh available in X minutes"

**Critical constraint -- Vercel function timeout:**
- Hobby plan: 300s (5 min) max with fluid compute enabled
- Pro plan: 800s (13 min) max
- The existing pipeline runs 8 adapters sequentially with geocoding
- If pipeline exceeds 5 min, must either: parallelize adapters, or split into multiple invocations via chained API calls
- Recommendation: measure pipeline duration first. If under 4 min, keep sequential. If over, implement adapter batching (4 adapters per invocation, 2 invocations).

### 5. Custom Search

**How B2B platforms handle search beyond defaults:**
- Separate search interface from the main feed (dedicated page or modal)
- User specifies: location (city/state/address), keywords, project type
- System runs a targeted search against those parameters
- Results appear in a "Custom Search Results" view or merge into main feed
- Search can be saved for re-running later (extends existing saved searches)

**Implementation approach:**
- New page: `/dashboard/search` with form fields
- Location: city/state text input with geocoding (existing `geocodeAddress` utility)
- Keywords: free text (maps to existing keyword filter)
- Project type: dropdown (commercial, residential, infrastructure, industrial, etc.)
- "Search" button triggers pipeline run with custom params
- Results displayed inline on the same page
- "Save this search" button to create a saved search entry for later re-use + digest

**Differences from default feed:**
- Default feed: uses org's HQ location + equipment + service radius
- Custom search: user-specified location + keywords + project type. Does NOT replace default feed.
- Custom search results get a `source: 'custom_search'` tag so users can distinguish them
- Results persist in the leads table and appear in default feed IF they fall within org's service radius

**Rate limiting:**
- Trial users: 3 custom searches per day
- Paid users: 10 custom searches per day
- Track via `custom_search_runs` table: `orgId, createdAt`
- Show remaining quota in UI: "3 of 10 searches used today"

## Sources

### Stripe & Billing
- [Stripe trial periods documentation](https://docs.stripe.com/billing/subscriptions/trials) -- HIGH confidence
- [Stripe free trial without payment method](https://docs.stripe.com/payments/checkout/free-trials) -- HIGH confidence
- [Better-auth Stripe plugin docs](https://better-auth.com/docs/plugins/stripe) -- HIGH confidence
- [Better-auth issue #4631: trial without checkout](https://github.com/better-auth/better-auth/issues/4631) -- HIGH confidence (closed, not planned)

### Vercel & Infrastructure
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) -- HIGH confidence
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- HIGH confidence
- [Vercel function duration limits](https://vercel.com/docs/functions/configuring-functions/duration) -- HIGH confidence

### Free Trial UX
- [Userpilot: SaaS free trial best practices](https://userpilot.com/blog/saas-free-trial-best-practices/) -- MEDIUM confidence
- [Maxio: SaaS free trial conversions](https://www.maxio.com/blog/saas-free-trials-7-best-practices-for-increased-conversions) -- MEDIUM confidence
- [The Good: converting free trial users](https://thegood.com/insights/how-to-convert-free-trial-users-to-paying-customers/) -- MEDIUM confidence
- [Encharge: SaaS free trial best practices 2026](https://encharge.io/saas-free-trial-best-practices/) -- MEDIUM confidence

### Onboarding
- [Insaim: SaaS onboarding best practices 2025](https://www.insaim.design/blog/saas-onboarding-best-practices-for-2025-examples) -- MEDIUM confidence
- [ProductLed: SaaS onboarding best practices](https://productled.com/blog/5-best-practices-for-better-saas-user-onboarding) -- MEDIUM confidence
- [ProductFruits: B2B SaaS onboarding guide](https://productfruits.com/blog/b2b-saas-onboarding) -- MEDIUM confidence
- [Auth0: user onboarding strategies B2B SaaS](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/) -- MEDIUM confidence

### Product Tours
- [OnboardJS: 5 best React onboarding libraries 2026](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared) -- MEDIUM confidence
- [Sandro Roth: evaluating tour libraries for React](https://sandroroth.com/blog/evaluating-tour-libraries/) -- MEDIUM confidence
- [Userpilot: product tours guide](https://userpilot.com/blog/product-tours/) -- MEDIUM confidence
- [DEV Community: building custom React tour component](https://dev.to/codewithjohnson/how-to-build-a-custom-react-tour-component-1b0b) -- MEDIUM confidence

### Empty States & Progress
- [Userpilot: empty state in SaaS](https://userpilot.com/blog/empty-state-saas/) -- MEDIUM confidence
- [Smashing Magazine: role of empty states in onboarding](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/) -- MEDIUM confidence
- [DEV Community: progress indicators for SaaS](https://dev.to/lollypopdesign/progress-indicators-explained-types-variations-best-practices-for-saas-design-392n) -- MEDIUM confidence

### Competitor Analysis
- [PlanHub vs ConstructConnect comparison](https://planhub.com/resources/constructconnect-vs-planhub/) -- MEDIUM confidence
- [SelectHub: PlanHub vs ConstructConnect](https://www.selecthub.com/construction-bidding-software/planhub-vs-constructconnect/) -- MEDIUM confidence
- [Planyard: top 10 construction lead generation platforms](https://planyard.com/blog/top-10-construction-lead-generation-platforms) -- MEDIUM confidence
- [Downtobid: PlanHub vs ConstructConnect vs Downtobid](https://downtobid.com/blog/planhub-vs-constructconnect-vs-downtobid) -- MEDIUM confidence

---
*Feature research for: HeavyLeads v2.0 Production Rework*
*Researched: 2026-03-15*
