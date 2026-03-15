# Pitfalls Research: v2.0 Feature Additions to HeavyLeads

**Domain:** Adding free trials, expanded onboarding, automated scraping, and async triggers to an existing Better Auth + Stripe + Vercel + Neon SaaS application
**Researched:** 2026-03-15
**Confidence:** HIGH (verified against official docs, GitHub issues, and codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: createCustomerOnSignUp Creates User-Level Customer, But Subscriptions Are Organization-Level

**What goes wrong:**
The existing `auth.ts` has `createCustomerOnSignUp: true` which creates a Stripe customer linked to the **user** table (`user.stripeCustomerId`). But subscriptions use `referenceId: organizationId` and `customerType: "organization"` (see `subscribe-button.tsx` line 22-23). This mismatch means: (a) the user-level customer is created on signup but never actually used for checkout, (b) when `subscription.upgrade` is called with `customerType: "organization"`, the plugin creates a **second** Stripe customer for the organization, and (c) the user-level customer sits orphaned in Stripe. This is almost certainly the root cause of the production `createCustomerOnSignUp` failure -- the plugin tries to create a user-level customer during signup, but the organization may not exist yet (it is created during the signup flow), causing a timing issue.

**Why it happens:**
`createCustomerOnSignUp` fires during the auth signup hook, which runs before the organization is fully created and linked. The plugin's `organization: { enabled: true }` setting means organizations should get their own customers, but the user-level customer creation fires first regardless.

**How to avoid:**
1. Set `createCustomerOnSignUp: false` in `auth.ts` -- the user-level customer is never used since subscriptions are organization-scoped.
2. Instead, create the Stripe customer for the organization explicitly during onboarding completion or when the user first hits the billing page, using `getCustomerCreateParams` on the organization.
3. Alternatively, keep `createCustomerOnSignUp: true` but configure `getCustomerCreateParams` to handle the organization context, and add error handling that gracefully fails if the Stripe API call errors during signup.

**Warning signs:**
- Stripe dashboard shows customers with no subscriptions (orphaned user-level customers)
- Signup works locally but fails in production (different Stripe key environments)
- Error logs show "Failed to create customer" during registration

**Phase to address:** Phase 1 (Fix Stripe customer creation) -- this is the production blocker

---

### Pitfall 2: Free Trial Status Not Recognized by Dashboard Guards

**What goes wrong:**
The existing `getActiveSubscription()` in `billing.ts` already checks for `status: "trialing"` alongside `status: "active"`. This is correct. However, the **real danger** is in the trial-to-paid conversion flow. When a trial ends and the user has not provided payment info, Stripe sets the subscription status to `past_due` or `canceled` or `paused` (depending on `trial_settings.end_behavior.missing_payment_method`). The `getActiveSubscription()` function does NOT check for `past_due` or `paused`, so the user gets hard-locked out of the dashboard with no explanation -- the billing page shows "Subscribe" instead of "Your trial ended, add payment to continue."

**Why it happens:**
Developers implement free trials by adding the trial creation flow but forget to handle the **five** distinct states a trial subscription moves through: `trialing` -> `past_due` (payment failed) -> `active` (payment succeeded) OR `canceled` (gave up) OR `paused` (no payment method). The existing binary guard logic (`subscription ? show dashboard : show subscribe`) does not distinguish between "never subscribed," "trial expired," and "payment failed."

**How to avoid:**
1. Extend `getActiveSubscription()` or create a separate `getSubscriptionState()` function that returns a discriminated union: `{ state: "none" | "trialing" | "active" | "past_due" | "trial_expired" | "canceled" }`.
2. Update the dashboard layout guard and billing page to show different UI for each state.
3. Configure `trial_settings.end_behavior.missing_payment_method: "pause"` in Stripe so trial-ended subscriptions are recoverable without creating a new subscription.
4. Add a grace period banner: "Your trial ended 2 days ago. Add payment to keep your leads."

**Warning signs:**
- QA tests pass for "new user signs up and sees dashboard" but nobody tests "trial ends, user returns next week"
- Billing page always shows "Subscribe Now" even for users who had a trial
- Users report being asked to pay the setup fee again after trial ends

**Phase to address:** Phase 1 (Free trial implementation) -- must be designed from the start, not bolted on

---

### Pitfall 3: better-auth/stripe Plugin trialStart/trialEnd Fields Stay NULL in Database

**What goes wrong:**
Known bug (GitHub issues #4046, #2345): When a checkout session completes with a free trial, the `@better-auth/stripe` plugin fails to persist `trial_start` and `trial_end` to the subscription table. The webhook handler's `onSubscriptionUpdated` function omits these fields from the SQL UPDATE. This means `subscription.trialStart` and `subscription.trialEnd` are always NULL in the database, even while the user is actively trialing.

**Why it happens:**
The plugin extracts `trial_start` and `trial_end` from the Stripe subscription object but the update payload does not include them. The code does `new Date(subscription.trial_start * 1000)` which returns `Invalid Date` when `trial_start` is undefined (it evaluates `undefined * 1000 = NaN`).

**How to avoid:**
1. Check the installed `@better-auth/stripe` version. If the fix (PR #5847 and related) is not in the installed version, apply a workaround.
2. Workaround: Use the `onSubscriptionCreated` / `onSubscriptionUpdated` callbacks in the stripe plugin config to manually persist trial dates from the raw Stripe event.
3. Alternative workaround: Query the Stripe API directly for trial dates rather than relying on the database fields.
4. Test by creating a trial subscription, then immediately querying the database to verify `trial_start` and `trial_end` are populated.

**Warning signs:**
- `SELECT trial_start, trial_end FROM subscription WHERE status = 'trialing'` returns all NULLs
- "Days remaining in trial" UI shows NaN or negative numbers
- Trial abuse prevention (`hasEverTrialed`) fails because it checks `trialStart` which is always NULL

**Phase to address:** Phase 1 (Free trial implementation) -- must be validated before shipping trial feature

---

### Pitfall 4: Trial Abuse via hasEverTrialed Check Using Wrong Subscription Set

**What goes wrong:**
Known bug (GitHub issue #6863): The `@better-auth/stripe` plugin's trial abuse prevention is broken. When checking if a user has already used a trial, it calls `findOne()` to get a subscription record, then checks only that single record for trial history. If the user has a canceled subscription (with trial data) and a new incomplete subscription, `findOne()` may return the new incomplete one, which has no trial data. The system then incorrectly grants another free trial.

**Why it happens:**
The plugin uses `findOne()` instead of `findMany()` when checking trial history, and the database may return any matching record (not necessarily the one with trial data).

**How to avoid:**
1. Check if the installed version includes the fix for issue #6863.
2. If not fixed, implement a custom trial abuse check: query ALL subscriptions for the organization's `referenceId` and check if ANY has `trialStart` set or `status = 'trialing'`.
3. Add a `has_used_trial` boolean column to `company_profiles` or `organization` table as a denormalized flag, set it when trial starts, never unset it.
4. The denormalized flag approach is actually more robust than relying on the plugin's check.

**Warning signs:**
- Users report being able to sign up for multiple free trials
- Support tickets from users who accidentally got a second trial and were charged

**Phase to address:** Phase 1 (Free trial implementation) -- prevention must be in place before launch

---

### Pitfall 5: Vercel Cron Scraper Hits 300s Timeout With All Adapters Running Sequentially

**What goes wrong:**
The existing `pipeline.ts` runs adapters **sequentially** in a `for...of` loop (line 30-33). With 8+ adapters (Austin permits, Dallas permits, Atlanta permits, SAM.gov bids, ENR news, Construction Dive, PRNewswire, Google dorking), each involving HTTP scraping + geocoding with 25ms throttle per record, the total pipeline time easily exceeds 300 seconds (5 minutes). Vercel Functions have a default maxDuration of 300s on all plans (with Fluid Compute enabled). On the Hobby plan, 300s is also the maximum. On Pro, the maximum is 800s but requires explicit `maxDuration` configuration.

**Why it happens:**
The `node-cron` scheduler in `scheduler.ts` is designed for a long-running Node.js process -- it will not work on Vercel's serverless infrastructure at all. Developers often miss that Vercel cron jobs are HTTP-triggered, not process-resident. The existing scheduler code is a dead end on Vercel.

**How to avoid:**
1. Replace `scheduler.ts` (node-cron) with a Vercel Cron configuration in `vercel.json` that hits an API route.
2. Set `export const maxDuration = 300;` (or up to 800 on Pro) on the cron route handler.
3. Break the pipeline into chunks: run permit adapters in one cron invocation, bid/news adapters in another, or use a fan-out pattern where the cron job dispatches individual adapter runs via `fetch()` to separate endpoints.
4. Alternatively, run adapters in parallel with `Promise.allSettled()` instead of sequentially, which dramatically reduces wall-clock time (network I/O is the bottleneck, not CPU).
5. Add per-adapter timeouts using `AbortController` so one slow/hung scraper does not kill the whole pipeline.

**Warning signs:**
- Vercel logs show 504 FUNCTION_INVOCATION_TIMEOUT on the cron endpoint
- Some adapters run but later ones never execute (they were cut off)
- Pipeline "succeeds" locally but fails in production

**Phase to address:** Phase 3 (Automated scraping via Vercel Cron)

---

### Pitfall 6: First-Login Scraper Trigger Races with Cron Job, Causing Duplicate Leads

**What goes wrong:**
The plan is to trigger scraping on a user's first login so they see leads immediately. If a new user signs up at 05:55 UTC, their first-login trigger starts the pipeline. At 06:00 UTC (the scheduled cron time), the daily cron also starts the pipeline. Both are running concurrently against the same adapters and writing to the same `leads` table. While the dedup logic handles permit records (upsert on `sourceId + permitNumber`), non-permit records (bids, news, deep-web) use a check-then-insert pattern (lines 200-222 in `pipeline.ts`) which is NOT atomic -- two concurrent runs can both pass the "does this record exist?" check before either inserts.

**Why it happens:**
The current dedup for non-permit records is: (1) SELECT to check existence, (2) INSERT if not found. This is a classic TOCTOU (time-of-check-time-of-use) race condition. In concurrent execution, both processes can execute step 1 before either reaches step 2, resulting in duplicate records.

**How to avoid:**
1. Add a distributed lock mechanism: use a database advisory lock or a simple `pipeline_runs` table with a lock row. Before starting a pipeline run, attempt an atomic INSERT/UPDATE. If the lock is already held, skip or queue.
2. Fix the non-permit dedup to use an atomic upsert: add a unique constraint on `(source_id, title)` or `(source_id, external_id)` in the leads table, then use `onConflictDoNothing()` instead of the check-then-insert pattern.
3. For first-login triggers specifically, use an idempotency key (e.g., `organization_id + date`) and store it in a `scraper_runs` table. Check the key before starting.
4. Rate-limit: if a pipeline ran for this organization within the last hour, skip the first-login trigger.

**Warning signs:**
- Dashboard shows duplicate leads with identical titles but different IDs
- `leads` table row count spikes by 2x after adding first-login triggers
- Users see the same lead twice in their feed

**Phase to address:** Phase 3 (First-login trigger implementation)

---

### Pitfall 7: Expanding Onboarding Wizard Breaks Existing Users' Saved State

**What goes wrong:**
The current `completeOnboarding` server action does a single `db.insert(companyProfiles)` with all fields at once. There is no partial-save mechanism. If the wizard is expanded from 3 steps to 5+ steps (adding company details, team invites, dashboard tour), and a user abandons mid-wizard, they have NO saved progress. Worse: if the onboarding schema validation changes (new required fields), existing users who completed onboarding with the old schema will have NULL values for the new fields. The dashboard layout checks `profile.onboardingCompleted` but not whether new fields are populated, so existing users bypass the new onboarding steps entirely.

**Why it happens:**
The current design treats onboarding as atomic: all-or-nothing. Adding steps to an atomic wizard without a migration strategy for existing users creates a schema mismatch.

**How to avoid:**
1. Add a migration that sets sensible defaults for new fields on existing `company_profiles` rows.
2. Consider an `onboardingVersion` field on `company_profiles` (e.g., `v1` for current 3-step, `v2` for expanded). Dashboard guard checks `onboardingVersion >= CURRENT_VERSION` instead of just `onboardingCompleted`.
3. For mid-wizard abandonment: either keep the atomic approach (user must complete all steps) or add per-step persistence using PATCH updates to the company_profiles row.
4. The atomic approach is simpler and fine for 5 steps -- do not over-engineer partial saves for a short wizard.

**Warning signs:**
- Existing users never see the new company details/team invite steps
- New required fields are NULL for all pre-v2 organizations
- Onboarding page redirects to dashboard immediately for existing users

**Phase to address:** Phase 2 (Onboarding expansion)

---

### Pitfall 8: Image Upload for Company Logo Hits Vercel's 4.5MB Body Size Limit

**What goes wrong:**
Adding a company logo upload to onboarding means sending an image through a server action or API route. Vercel serverless functions have a hard 4.5MB request body limit. A user uploading a high-resolution company logo (common for print-quality logos) will get a `413 FUNCTION_PAYLOAD_TOO_LARGE` error with no helpful message.

**Why it happens:**
Server actions in Next.js process the request body on the server, which goes through the Vercel Function. The 4.5MB limit applies before the application code even runs.

**How to avoid:**
1. Use client-side direct upload to a storage service (Vercel Blob, Cloudinary, or S3 with presigned URLs). The image never touches the serverless function.
2. With Vercel Blob: generate a client upload token via server action, then upload directly from the browser using `@vercel/blob/client`.
3. Validate file size and type on the client BEFORE upload: max 2MB, accept only PNG/JPG/WebP/SVG.
4. Resize/compress on the client using Canvas API or a library like `browser-image-compression` before upload.
5. Store only the URL in `company_profiles.logo`, not the binary data.

**Warning signs:**
- Upload works locally (no Vercel body size limit in dev) but fails in production
- Large logo files silently fail with a generic error
- QA only tests with small test images

**Phase to address:** Phase 2 (Onboarding expansion -- company details step)

---

### Pitfall 9: Cron Endpoint Exposed Without Authentication

**What goes wrong:**
The existing `/api/scraper/run` route (line 7 in route.ts: `// TODO: Add auth guard before production use`) has NO authentication. Anyone who discovers this URL can trigger the scraper pipeline, causing unnecessary geocoding API calls, database writes, and potential rate limit exhaustion on scraped sources. When converting to a Vercel Cron endpoint, the same vulnerability persists unless `CRON_SECRET` is explicitly checked.

**Why it happens:**
The route was built for development convenience and never secured. Converting it to a cron endpoint requires adding the `CRON_SECRET` check, but it is easy to forget because the cron config in `vercel.json` feels like it "owns" the route.

**How to avoid:**
1. Add `CRON_SECRET` environment variable to Vercel project settings.
2. Add authorization check as the first line of the cron route handler: `if (request.headers.get('authorization') !== \`Bearer ${process.env.CRON_SECRET}\`) return new Response('Unauthorized', { status: 401 });`
3. For the "on-demand refresh" and "first-login trigger" endpoints (which are user-initiated, not cron-initiated), use session-based auth instead of `CRON_SECRET`.
4. Verify by trying to `curl` the endpoint without the header in production -- it should return 401.

**Warning signs:**
- Vercel logs show scraper runs at unexpected times
- Rate limit errors from scraped data sources
- Unusual spikes in geocoding API costs

**Phase to address:** Phase 3 (Automated scraping) -- must be done before deploying the cron route

---

### Pitfall 10: First-Login User Sees Empty Dashboard for 30+ Seconds While Scraper Runs

**What goes wrong:**
After onboarding, the user is redirected to billing, subscribes (or starts trial), then lands on the dashboard. The first-login trigger fires the scraper pipeline, which takes 30-120+ seconds to complete. During this entire time, the dashboard shows "No leads found" or a loading spinner. The user's first impression of the product -- the moment they should see value -- is a blank screen.

**Why it happens:**
The scraper pipeline is inherently slow (HTTP requests to external sources + geocoding). If the first-login trigger runs synchronously or the UI waits for it, the user experience is terrible. If it runs in the background, the user sees an empty state.

**How to avoid:**
1. **Do NOT block the dashboard on scraper completion.** Show a first-time user experience instead: "We are finding leads for you. This usually takes 1-2 minutes. You will see leads appear as we find them."
2. Use an optimistic approach: pre-seed with a small number of demo/sample leads relevant to the user's equipment types and location, clearly labeled as "sample leads."
3. Implement a polling mechanism or SSE (Server-Sent Events) on the dashboard that auto-refreshes the lead list as new leads are inserted.
4. Fire the scraper trigger as early as possible -- ideally right after onboarding completes (before the user even reaches billing), so leads are accumulating while they go through the subscription flow.
5. Prioritize one fast adapter first (e.g., SAM.gov bids which is an API call, not HTML scraping) to get some results quickly.

**Warning signs:**
- User analytics show high bounce rate on first dashboard visit
- Support tickets: "I signed up but there are no leads"
- Average time-to-first-lead exceeds 2 minutes

**Phase to address:** Phase 3 (First-login trigger) -- UX design must be part of the trigger implementation, not an afterthought

---

### Pitfall 11: Setup Fee Charged During Free Trial Checkout

**What goes wrong:**
The existing `getCheckoutSessionParams` in `auth.ts` (lines 44-60) adds the `PRICES.setupFee` line item for first-time subscribers. When free trials are added, this logic will fire during trial checkout too, meaning the user gets charged $499 setup fee immediately even though the subscription itself is a free trial. This contradicts the "no credit card required" trial goal, or at minimum creates a terrible UX where "free trial" costs $499 upfront.

**Why it happens:**
The `isFirstTime` check (`!subscription?.stripeSubscriptionId`) is based on whether a subscription record exists, not on whether the user is starting a trial. A first trial IS a first-time subscription, so the setup fee gets added.

**How to avoid:**
1. Modify `getCheckoutSessionParams` to check whether the checkout is for a trial period. If `plan.freeTrial` is configured or the subscription will have a trial, exclude the setup fee line items entirely.
2. Charge the setup fee only at the moment of trial-to-paid conversion, not at trial start. This can be done via a one-time invoice item added when the trial converts, using the `onTrialEnd` callback.
3. Alternatively, if the business model requires the setup fee regardless of trial: make this crystal clear in the UI ("7-day free trial, then $499 setup + $199/mo") and require a payment method upfront despite the trial.

**Warning signs:**
- Stripe Checkout shows a $499 charge for what was marketed as a "free trial"
- Trial conversion rate is near zero because users feel deceived
- `payment_method_collection: "if_required"` does not work because there is a non-zero amount due

**Phase to address:** Phase 1 (Free trial implementation)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `node-cron` scheduler alongside Vercel Cron | No code changes needed | Dead code that confuses future developers; `node-cron` never fires on Vercel | Never -- remove `scheduler.ts` when adding Vercel Cron |
| Using `company_profiles.onboardingCompleted` boolean instead of version tracking | Simple guard logic | Cannot detect users who completed old onboarding and need new steps | Only for MVP if no existing users need migration |
| Check-then-insert dedup for non-permit leads | Simpler than adding unique constraints | Race condition duplicates under concurrent pipeline runs | Never once concurrent runs exist (first-login + cron) |
| Storing logo as base64 in `company_profiles.logo` text column | No external storage needed | Bloats database, slow queries, impossible to serve via CDN | Never -- always use object storage |
| Hardcoding `PRICES.monthlySubscription` without trial variant | One price config | Cannot distinguish trial checkout from paid checkout in Stripe | Only if using Stripe's native `trial_period_days` on the same price |
| Running all adapters in a single function invocation | Simple pipeline logic | Hits Vercel timeout limits as adapters are added | Acceptable until adapter count exceeds 3-4, then must split |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Better Auth + Stripe plugin | Assuming `createCustomerOnSignUp` works for organization-scoped subscriptions | Disable user-level auto-creation; create organization customers explicitly or via `getCustomerCreateParams` |
| Better Auth + Stripe trials | Relying on `subscription.trialStart`/`trialEnd` database fields being populated | Verify with database query after first trial creation; implement fallback using Stripe API if fields are NULL |
| Vercel Cron + Next.js | Using `node-cron` or in-process scheduling | Use `vercel.json` cron config pointing to API route handlers; in-process schedulers do not persist across serverless invocations |
| Vercel Cron + Security | Deploying cron endpoint without `CRON_SECRET` check | Always validate `Authorization: Bearer ${CRON_SECRET}` header; Vercel sends this automatically |
| Vercel Functions + File Upload | Routing file uploads through server actions | Use client-side direct upload (Vercel Blob client upload, S3 presigned URLs); server function only generates upload token |
| Stripe Checkout + Free Trial | Setting `trial_period_days` without `payment_method_collection: "if_required"` | Must set both: `subscription_data.trial_period_days: 7` AND `payment_method_collection: "if_required"` for no-card trial |
| Stripe Trial + Existing Setup Fee | Applying setup fee during trial checkout (user pays $499 setup for a free trial) | Conditionally exclude setup fee line items when trial is active; only charge setup fee at trial-to-paid conversion |
| Neon PostgreSQL + Advisory Locks | Using `pg_advisory_lock` for pipeline concurrency control | Neon supports advisory locks, but connections may be pooled; use `pg_advisory_xact_lock` (transaction-scoped) to prevent lock leaks |
| Better Auth organization plugin + sign-in | Expecting `activeOrganizationId` to persist across sessions | It resets to NULL on new sign-in; must call `organization.setActive()` after login (already handled in `sign-in-form.tsx` lines 54-59, but easy to break) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential adapter execution in pipeline | Cron job times out; some adapters never run | Use `Promise.allSettled()` for parallel execution with individual error isolation | At 5+ adapters or when any single adapter takes >60s |
| Geocoding every record individually with 25ms throttle | Pipeline takes 10+ minutes for 200 records (200 * 25ms = 5s just in throttle delays, plus API latency) | Batch geocode, cache results, skip already-geocoded records, use bulk geocoding API | At 100+ records per pipeline run |
| `getActiveSubscription()` called on every page load in dashboard layout | Extra DB query on every navigation; slow dashboard | Cache subscription status in session or use middleware-level check with short TTL | At 50+ concurrent users |
| Loading all leads in dashboard without pagination | Dashboard page crashes or takes 10+ seconds | Implement cursor-based pagination from day 1; limit to 25 leads per page | At 500+ leads in database |
| Re-running full pipeline on "Refresh Leads" button | User hammers button, causing rate limit bans on scraped sources | Debounce to max 1 run per hour per organization; queue instead of immediate execution | Any user who clicks it twice |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unauthenticated scraper endpoint (`/api/scraper/run`) | Attackers can trigger unlimited scraper runs, exhausting geocoding API quota and getting IP banned from data sources | Add CRON_SECRET check for cron invocations; add session auth for user-triggered runs |
| Scraper API route using POST without CSRF protection | Third-party sites could trigger scraping via form submission | Validate Origin header or use GET with auth header for cron jobs (Vercel Cron sends GET by default) |
| Team invite during onboarding without email verification | Invite spoofing; wrong people gain access to organization | Verify inviter's email first; use signed invitation tokens with expiry |
| Free trial without email verification | Bot signups creating thousands of trial accounts | Require email verification before trial starts; add rate limiting on signup endpoint |
| Storing Stripe webhook secret in client-accessible env | Anyone can forge webhook events | Prefix with server-only convention; verify `STRIPE_WEBHOOK_SECRET` is not in `NEXT_PUBLIC_*` vars |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Empty dashboard on first visit after signup | User thinks product is broken; immediate churn | Show "Setting up your leads..." state with progress indicator; optionally show sample leads |
| No distinction between "no subscription" and "trial expired" on billing page | Confused user who already trialed sees "Subscribe Now" with no context | Show trial-aware messaging: "Your trial ended on [date]. Subscribe to continue." |
| Onboarding wizard with no progress persistence | User who accidentally closes tab must restart from step 1 | For a 5-step wizard this is annoying but tolerable; add a "picking up where you left off" UX if steps exceed 7 |
| Trial countdown not visible on dashboard | User does not know trial is ending; sudden paywall surprise | Show persistent banner: "3 days left in your free trial -- Subscribe now" |
| Setup fee surprise after free trial | User expected "free trial" to mean no upfront cost, then sees $499 setup fee at conversion | Clearly communicate pricing during trial signup: "After your 7-day trial: $499 setup + $199/mo" |
| "Refresh Leads" button with no feedback | User clicks, nothing visible happens for 30+ seconds | Show immediate loading state, stream results as they arrive, or show "Refresh queued -- new leads will appear shortly" |

## "Looks Done But Isn't" Checklist

- [ ] **Free trial:** trialStart and trialEnd are actually populated in the database after checkout -- not NULL (known better-auth/stripe bug)
- [ ] **Free trial:** Trial-to-paid conversion does not re-charge the setup fee if it was already paid (or intentionally does charge it if that is the business model)
- [ ] **Free trial:** `hasEverTrialed` check works across subscription cancellation/recreation cycles (known bug with single-subscription query)
- [ ] **Free trial:** Stripe `payment_method_collection: "if_required"` is set so trial does not require credit card
- [ ] **Free trial:** `trial_settings.end_behavior.missing_payment_method` is configured (cancel vs pause)
- [ ] **Free trial:** Setup fee line items are NOT included in trial checkout params
- [ ] **Dashboard guard:** Handles all subscription statuses: active, trialing, past_due, paused, canceled, incomplete (not just active + trialing)
- [ ] **Onboarding:** Existing v1 users with `onboardingCompleted = true` either see new steps or have new fields populated via migration
- [ ] **Onboarding:** Company logo upload works in production (not just localhost) -- test with 3MB+ image
- [ ] **Onboarding:** New onboarding schema validates correctly for both new and returning users
- [ ] **Cron job:** `CRON_SECRET` is set in Vercel project environment variables, not just `.env.local`
- [ ] **Cron job:** `maxDuration` is explicitly exported in the cron route handler (default 300s may not be enough)
- [ ] **Cron job:** Vercel plan supports the cron frequency needed (Hobby = once per day only, and invocation can be anywhere in the specified hour)
- [ ] **Cron job:** Route handler uses GET method (Vercel Cron sends GET requests, existing route only handles POST)
- [ ] **First-login trigger:** Cannot duplicate-fire if user refreshes dashboard rapidly after signup
- [ ] **First-login trigger:** Idempotent -- running twice for same org+date produces no duplicates
- [ ] **Scraper route:** Authentication check is present (not just the TODO comment)
- [ ] **Sign-in flow:** `organization.setActive()` still runs after sign-in (required to prevent infinite redirect loop per existing comment in sign-in-form.tsx)
- [ ] **node-cron scheduler:** `scheduler.ts` is removed or clearly deprecated when Vercel Cron is implemented

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate Stripe customers (user + org) | LOW | Bulk-delete orphaned user-level customers in Stripe dashboard; remove `stripeCustomerId` from user rows not linked to any subscription |
| NULL trialStart/trialEnd in database | LOW | Backfill from Stripe API: fetch all subscriptions with `status: trialing`, update database rows with correct timestamps |
| Duplicate leads from race condition | MEDIUM | Write a one-time dedup script that groups by `(source_id, title)`, keeps the oldest, deletes others; update `lead_sources` foreign keys |
| Existing users missing new onboarding fields | LOW | Database migration with sensible defaults; optional prompt to "complete your profile" on next login |
| Scraper endpoint abused before securing | MEDIUM | Rotate geocoding API keys; check for anomalous lead data inserted by attackers; add rate limiting to new secured endpoint |
| Trial abuse (users getting multiple trials) | HIGH | Audit Stripe for customers with multiple trial subscriptions; cannot easily claw back; implement `has_used_trial` flag immediately to prevent future abuse |
| Vercel cron timeout killing pipeline | LOW | Split into multiple cron jobs or parallelize adapters; no data loss since interrupted adapters simply do not write |
| Setup fee charged during trial | MEDIUM | Refund affected customers via Stripe dashboard; fix getCheckoutSessionParams to exclude fee during trial; communicate with affected users |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| createCustomerOnSignUp user/org mismatch | Phase 1 (Fix Stripe) | Signup creates org-level customer; no orphaned user customers in Stripe |
| Trial status not recognized by guards | Phase 1 (Free trial) | Test all 5 subscription states in dashboard layout; each shows appropriate UI |
| trialStart/trialEnd NULL in database | Phase 1 (Free trial) | After trial checkout, query DB and verify both fields are non-NULL timestamps |
| Trial abuse via hasEverTrialed | Phase 1 (Free trial) | Cancel trial, create new subscription, verify trial is NOT offered again |
| Setup fee during trial checkout | Phase 1 (Free trial) | Start trial checkout; verify Stripe Checkout page shows $0 due today |
| Onboarding expansion breaks existing users | Phase 2 (Onboarding) | Login as v1 user; verify they see new onboarding steps or have defaults populated |
| Image upload body size limit | Phase 2 (Onboarding) | Upload 3MB logo in production Vercel deployment; verify success |
| Vercel cron timeout | Phase 3 (Automated scraping) | Run pipeline in production with all adapters; verify it completes within maxDuration |
| First-login race condition duplicates | Phase 3 (First-login trigger) | Trigger first-login and cron simultaneously; verify no duplicate leads |
| Cron endpoint authentication | Phase 3 (Automated scraping) | `curl` cron endpoint without auth header; verify 401 response |
| Empty dashboard on first login | Phase 3 (First-login trigger) | Complete signup flow end-to-end; verify dashboard shows meaningful content within 10 seconds |

## Sources

- [Better Auth Stripe Plugin Docs](https://better-auth.com/docs/plugins/stripe) -- trial config, createCustomerOnSignUp, organization support
- [GitHub #3670: Duplicate customers on signup](https://github.com/better-auth/better-auth/issues/3670) -- createCustomerOnSignUp overwrites existing customer
- [GitHub #4046: trialStart/trialEnd not updated](https://github.com/better-auth/better-auth/issues/4046) -- trial dates NULL after checkout
- [GitHub #2345: Invalid time value on webhook](https://github.com/better-auth/better-auth/issues/2345) -- Date(undefined * 1000) error
- [GitHub #6863: hasEverTrialed uses wrong subscription set](https://github.com/better-auth/better-auth/issues/6863) -- trial abuse via findOne vs findMany
- [GitHub #2440: subscription.upgrade creates new customer every time](https://github.com/better-auth/better-auth/issues/2440) -- duplicate customer creation
- [GitHub #4957: Subscription updates not persisting](https://github.com/better-auth/better-auth/issues/4957) -- webhook persistence failures
- [Stripe Docs: Free Trial Configuration](https://docs.stripe.com/billing/subscriptions/trials) -- trial_period_days, payment_method_collection, trial_settings
- [Stripe Docs: Checkout Free Trials](https://docs.stripe.com/payments/checkout/free-trials) -- no-card trial setup
- [Vercel Docs: Cron Job Management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) -- CRON_SECRET, duration limits, idempotency, concurrency
- [Vercel Docs: Function Duration Limits](https://vercel.com/docs/functions/configuring-functions/duration) -- Hobby 300s max, Pro 800s max with Fluid Compute
- [Vercel KB: 4.5MB Body Size Limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) -- file upload workarounds
- [Vercel Docs: Vercel Blob Server Upload](https://vercel.com/docs/vercel-blob/server-upload) -- client-side direct upload pattern

---
*Pitfalls research for: HeavyLeads v2.0 feature additions*
*Researched: 2026-03-15*
