# Pitfalls Research: LeadForge v3.0 Multi-Industry Expansion

**Domain:** Expanding a live production Next.js/Drizzle/Neon SaaS from single-industry (heavy equipment) to 5-industry platform
**Researched:** 2026-03-16
**Confidence:** HIGH (verified against codebase analysis, official docs, Vercel docs, Drizzle docs, and prior incident history)

**CRITICAL CONTEXT:** The production app is live at heavy-leads.vercel.app with real users, active subscriptions, and daily cron scraping. Past incidents include a production 500 from adding env.ts to db/index.ts, double-nested Stripe checkout params, geocoding returning 0,0 instead of null, and build-passing-but-runtime-failing on Vercel. Every change must be additive and safe against the running system.

---

## Critical Pitfalls

Mistakes that cause production outages, data corruption, user lockout, or require significant rework on a live system.

---

### Pitfall 1: Drizzle Migration Drops and Recreates Columns Instead of Altering Them

**Severity:** CRITICAL

**What goes wrong:** When renaming a column or table in the Drizzle schema (e.g., renaming `equipmentTypes` to `serviceCategories` on `company_profiles`, or renaming the `leads` table to `opportunities`), `drizzle-kit generate` interprets the rename as a "drop old column + add new column." The generated migration drops the column with all existing production data, then creates a fresh empty column. On a table with thousands of leads or hundreds of company profiles, this is silent, irrecoverable data destruction.

**Why it happens:** Schema diffing cannot distinguish "rename" from "drop + add" without explicit hints. Drizzle added `strict: true` mode which prompts you for ambiguous changes like renames, but the default behavior does not protect you. The current project uses `npx drizzle-kit push` for some operations (the known issue about `leads_source_url_dedup_idx` in project notes), which bypasses migration files entirely and applies changes directly.

**Warning signs:**
- The generated SQL file contains `ALTER TABLE ... DROP COLUMN` followed by `ALTER TABLE ... ADD COLUMN` instead of `ALTER TABLE ... RENAME COLUMN`
- Running `drizzle-kit generate` with `strict: true` prompts "Is this a rename?" -- if you see this prompt, the default mode would have silently dropped the column
- Any migration that changes the number of NOT NULL columns on a table with existing data

**How to avoid:**
1. NEVER use `drizzle-kit push` against the production Neon database. It was used earlier (per known issues) but must stop for v3.0. Use `drizzle-kit generate` + `drizzle-kit migrate` exclusively.
2. Enable `strict: true` in `drizzle.config.ts` to catch rename ambiguities.
3. Review every generated `.sql` migration file manually before applying. Search for `DROP COLUMN` -- if found, verify it is intentional.
4. For renames, write a custom migration: `ALTER TABLE company_profiles RENAME COLUMN equipment_types TO service_categories;` instead of relying on the diff.
5. Test every migration against a Neon branch (Neon supports database branching) before applying to production.
6. Back up production data before applying schema changes: `pg_dump` or Neon's point-in-time restore.

**Phase to address:** Database schema expansion (should be the earliest phase -- schema changes are prerequisites for all other features).

**Confidence:** HIGH -- Drizzle docs explicitly warn about column renames; the `strict: true` feature exists specifically for this reason. The project already has a known issue with `drizzle-kit push` on production.

---

### Pitfall 2: Schema Migration Breaks Live Queries During Deploy Window

**Severity:** CRITICAL

**What goes wrong:** Vercel deploys are not atomic with database migrations. If a migration adds a required (NOT NULL without default) column to the `leads` table, or changes the `company_profiles` schema, there is a window where the new code expects the new column but the migration has not run yet (or vice versa: the migration has run but old code is still serving). The Neon serverless driver does not buffer schema changes -- queries against non-existent columns fail immediately with a PostgreSQL error.

**Why it happens:** Vercel's deployment model replaces functions gradually (rolling). The database migration is a separate step that must be explicitly triggered. There is no built-in coordination between "run migration" and "deploy code." This is the exact same category of incident that caused the production 500 when env.ts was added to db/index.ts -- the code changed but the environment was not ready.

**Warning signs:**
- 500 errors in Vercel logs immediately after a deploy that includes schema changes
- Errors mentioning `column "X" does not exist` or `relation "X" does not exist`
- The migration script and the code change are in the same git commit/PR

**How to avoid:**
1. **Expand-then-contract pattern:** All schema changes must be backward-compatible. Phase 1: add new columns as nullable with defaults. Phase 2: deploy code that writes to new columns. Phase 3: backfill old data. Phase 4 (much later): remove old columns.
2. Add new columns with `DEFAULT` values so old code inserting without the new column does not fail.
3. Run migrations BEFORE deploying the new code. The migration script should be run manually via `npx drizzle-kit migrate` against the Neon connection string, then deploy the code.
4. Never add NOT NULL columns without a DEFAULT on a table that is actively being written to.
5. For the `leads` table specifically: the pipeline cron runs daily at 6 AM UTC. Time migrations outside the cron window.

**Phase to address:** Database schema expansion -- establish the expand/contract discipline as a project rule from the start.

**Confidence:** HIGH -- this is a universal production migration pattern, and this project has direct experience with the deploy/runtime desync problem.

---

### Pitfall 3: Adding `industryId` to Leads Without Backfilling Breaks All Existing Queries

**Severity:** CRITICAL

**What goes wrong:** The multi-industry expansion requires associating leads with industries. Adding an `industry_id` column to the `leads` table (or a `lead_industries` junction table) means every existing lead has no industry association. If any query filters by `industry_id` (e.g., "show only HVAC leads"), all existing heavy equipment leads are excluded from results. If `industry_id` is NOT NULL, the existing pipeline cannot insert leads until the scrapers are updated. If the feed query requires industry context, existing users see an empty dashboard.

**Why it happens:** The current `leads` table has no industry concept. The `company_profiles` table has `equipmentTypes` (an array) but no industry field. The scoring engine uses `inferEquipmentNeeds()` which is hard-coded for heavy equipment keywords. Adding industry as a required dimension creates a chicken-and-egg: you need the industry data to display leads, but existing leads have no industry data.

**Warning signs:**
- After deploying industry-aware queries, existing users see 0 leads on their dashboard
- The existing scraping pipeline starts failing because it cannot provide the required `industry_id`
- The `getFilteredLeads` function returns empty results for organizations that were previously seeing leads

**How to avoid:**
1. Default all existing leads to `industry_id = 'heavy_equipment'` in the migration that adds the column.
2. Make `industry_id` nullable initially, with the query treating NULL as "matches all industries" (or specifically as heavy_equipment).
3. Update the existing scraper adapters to set `industry_id = 'heavy_equipment'` before adding new industry-specific scrapers.
4. The company_profiles `equipmentTypes` field must be mapped to the new industry model -- do not create a parallel system that ignores the existing data.
5. Update `getFilteredLeads` to default to "all industries" when no industry filter is present, preserving existing user experience.

**Phase to address:** Database schema expansion -- the industry column must be added with backfill as part of the schema phase, before any industry-aware code ships.

**Confidence:** HIGH -- directly observable from the current schema where `leads` has no industry concept and `getFilteredLeads` has no industry parameter.

---

### Pitfall 4: Onboarding Wizard Expansion Loses Existing User Data on Schema Change

**Severity:** CRITICAL

**What goes wrong:** The current `company_profiles` table stores `equipmentTypes` (text array), `hqAddress`, coordinates, and `serviceRadiusMiles`. The multi-industry onboarding will add `industryId`, possibly rename `equipmentTypes` to `serviceCategories`, and add industry-specific fields. If the onboarding flow is replaced wholesale, existing users who completed onboarding have `onboardingCompleted = true` but their profile data may not match the new schema. Three failure modes:

1. **Existing users forced through re-onboarding:** If the new schema requires fields that existing profiles lack, and the dashboard guard checks for those fields, existing users are redirected back to onboarding.
2. **Profile data silently nulled:** If the migration renames/replaces the `equipmentTypes` column, existing users lose their equipment preferences.
3. **Onboarding redirect loop:** The current onboarding page checks `profile?.onboardingCompleted` and redirects to `/dashboard` if true. If the new code checks for additional required fields AND `onboardingCompleted`, users can get stuck in a loop where onboarding says "already completed" but the dashboard says "profile incomplete."

**Why it happens:** The current wizard (3 steps: location, equipment, radius) stores state via `react-hook-form` with `zodResolver`. The form submits to the `completeOnboarding` server action which upserts the `company_profiles` row and sets `onboardingCompleted = true`. Expanding to a multi-step industry wizard changes the form shape, validation schema, and server action payload. If these are not backward-compatible with existing profile data, the system breaks for current users.

**Warning signs:**
- After deploying the new onboarding, log in as the existing admin account (josh.wiersema06@gmail.com). If redirected to onboarding instead of dashboard, the guard is broken.
- Check the `company_profiles` table for the admin org: if `equipmentTypes` is null/empty but was previously populated, the migration destroyed the data.

**How to avoid:**
1. Add new fields to `company_profiles` as nullable columns. Never drop or rename existing columns in the same migration.
2. Existing users with `onboardingCompleted = true` should NEVER be forced through re-onboarding. If new fields are needed, show a "Update your profile" banner on the dashboard instead.
3. The onboarding page guard should remain: `if (profile?.onboardingCompleted) redirect("/dashboard")`. New profile fields are populated via settings, not re-onboarding.
4. Default existing profiles' `industryId` to `'heavy_equipment'` in the migration.
5. The new wizard should be for NEW users only. Existing user profile updates go through a separate settings page.

**Phase to address:** Onboarding wizard redesign -- must be coordinated with the schema migration phase and explicitly protect existing user data.

**Confidence:** HIGH -- the existing onboarding guard at `src/app/(onboarding)/onboarding/page.tsx` lines 29-37 shows the exact check that could break.

---

### Pitfall 5: Email Verification Enabling Locks Out All Existing Users

**Severity:** CRITICAL

**What goes wrong:** When `requireEmailVerification: true` is set in better-auth's `emailAndPassword` config, every sign-in attempt checks `emailVerified`. All existing users who signed up before this flag was enabled have `emailVerified: false` (or null). They cannot log in. This was documented as Pitfall 1 in v2.1 research and remains critical for v3.0.

**Why it happens:** better-auth treats email verification as a gate on sign-in, not just sign-up. There is no built-in migration path for existing users. The flag is binary.

**Warning signs:** Test sign-in with the existing admin account on a preview deploy. If sign-in fails or redirects to "verify your email," the migration was missed.

**How to avoid:**
1. Run `UPDATE "user" SET "email_verified" = true WHERE "email_verified" IS NULL OR "email_verified" = false;` BEFORE deploying the code change.
2. Deploy the SQL migration, verify it ran, THEN deploy the code.
3. Consider using `sendOnSignIn: true` in the config so that unverified users get a verification email when they try to sign in, rather than being silently locked out.
4. Test the complete flow on a Vercel preview deploy with the admin account before merging to main.

**Phase to address:** Auth enhancements -- the DB migration is a hard prerequisite, not a cleanup step.

**Confidence:** HIGH -- better-auth docs explicitly confirm this behavior; verified in v2.1 research and still applicable.

---

### Pitfall 6: Scaling from 1 Cron to 10 Cron Jobs Hits Vercel Plan Limits and Causes Concurrent Execution Conflicts

**Severity:** CRITICAL

**What goes wrong:** The current system has 1 cron job (`/api/cron/scrape` at 6 AM daily) with `maxDuration = 300` (5 minutes). Scaling to 10 cron jobs (per-industry scrapers, storm alerts, data cleanup, email digests, etc.) introduces three failure modes:

1. **Hobby plan frequency limit:** Hobby plans allow only once-per-day execution per cron job. If the app needs hourly storm checks or more frequent scraping, this is a hard blocker. The Pro plan allows per-minute scheduling.
2. **Concurrent execution race conditions:** If two cron jobs run simultaneously and both write to the `leads` or `pipeline_runs` tables, they can create duplicate leads or corrupt the pipeline run status. The current pipeline uses `initializeAdapters()` which writes to a module-level `Map` -- two concurrent invocations would share this mutable state within the same serverless instance.
3. **Function duration billing explosion:** Each cron job is a serverless function invocation. 10 cron jobs running 5 minutes each = 50 function-minutes per execution cycle. On Pro plan, this consumes significant function execution time quota.

**Why it happens:** The current architecture treats scraping as a single monolithic operation. The cron handler at `/api/cron/scrape` initializes ALL adapters, runs them sequentially, then triggers the email digest. This serial approach works for 8 adapters within a 5-minute window. Splitting into per-industry crons means parallelism, which the current mutable registry pattern does not support.

**Warning signs:**
- Cron job deployment fails with "Hobby accounts are limited to daily cron jobs"
- Pipeline runs table shows overlapping `running` records with the same timestamp
- Vercel function usage dashboard shows unexpected spikes in execution time
- Leads are duplicated in the database after concurrent scraper runs

**How to avoid:**
1. **Stay on one cron job** for scraping but add an internal dispatcher that iterates through industries. The 5-minute Pro plan limit (or 13-minute with `maxDuration = 800`) is sufficient for sequential industry scraping.
2. If multiple cron jobs are needed, ensure they have non-overlapping schedules (e.g., industry A at 6:00, B at 6:15, C at 6:30) with enough gap for each to complete.
3. Add a distributed lock: before starting, check `pipeline_runs` for any run with `status = 'running'` and `startedAt` within the last 15 minutes. Skip if found.
4. Remove the module-level mutable `Map` in the registry. Pass adapter lists as function arguments instead of relying on shared mutable state.
5. For storm alerts (which need higher frequency), use a separate lightweight cron job that only calls the weather API -- no heavy scraping.
6. Budget function execution time: calculate total monthly cron execution time and compare against the Pro plan quota.

**Vercel cron limits (verified):**
- Hobby: 100 cron jobs, once per day, hourly precision (+/- 59 min)
- Pro: 100 cron jobs, once per minute, per-minute precision
- Function duration: Pro default 300s, max 800s with fluid compute

**Phase to address:** Cron architecture expansion -- design the dispatcher pattern before adding new cron endpoints.

**Confidence:** HIGH -- Vercel cron docs confirm limits; the mutable registry pattern is directly visible in `src/lib/scraper/registry.ts`.

---

### Pitfall 7: Query-Time Scoring Causes N+1 and Performance Collapse at Scale

**Severity:** CRITICAL

**What goes wrong:** The current `getFilteredLeadsWithCount` function fetches ALL leads within the Haversine radius (no SQL LIMIT), enriches each one in memory with `inferEquipmentNeeds()`, `scoreLead()`, `getFreshnessBadge()`, and `mapTimeline()`, then sorts by score and paginates in memory. This works at current volumes (< 5,000 leads). At multi-industry scale (50,000+ leads across 5 industries), this means:

1. **Full table scan per request:** Every page load fetches ALL qualifying leads, not just one page.
2. **O(n) enrichment:** Each lead runs through inference, scoring, and freshness computation in JavaScript.
3. **Memory pressure:** 50,000 enriched lead objects in a serverless function's memory.
4. **Pagination inconsistency:** Since scoring is computed at query time, the same lead can have different scores on different page loads if the user's profile changes between requests.

**Why it happens:** The current architecture was designed for < 5,000 leads in a single-industry, single-radius context. The comment in `queries.ts` says "Haversine WHERE clause already limits results to a reasonable set (typically <5000 for any realistic radius)." With 5 industries and nationwide leads, this assumption breaks.

**Warning signs:**
- Dashboard load time exceeds 3 seconds
- Vercel function logs show the leads query taking > 2 seconds
- Memory usage in Vercel function logs approaches the 1024 MB limit
- Users on slow connections see a loading spinner for 5+ seconds

**How to avoid:**
1. **Move scoring to SQL** where possible. Equipment match can be computed with array overlap in PostgreSQL (`array_length(ARRAY[...] & equipment_types, 1)`). Distance is already in SQL. Only value scoring requires the log computation.
2. **Push pagination to SQL.** After moving scoring to SQL, ORDER BY and LIMIT/OFFSET can happen in the database instead of in memory.
3. **Add composite indexes** for the most common query patterns: `(source_type, industry_id, scraped_at)` and spatial indexes.
4. **Cache enrichment results** for leads that have not changed since last scrape. Store precomputed scores in a materialized column or cache table.
5. **Phase this carefully:** Start with the current in-memory approach for the first industry expansion, then migrate to SQL-based scoring when lead volume exceeds 10,000. Do not attempt the SQL scoring rewrite simultaneously with the industry expansion.

**Phase to address:** Scoring engine redesign -- should be its own dedicated phase after the schema and scraper phases, not mixed with the initial industry expansion.

**Confidence:** HIGH -- the `getFilteredLeadsWithCount` function at `queries.ts` lines 456-607 shows the full-fetch pattern explicitly. The "typically <5000" assumption is commented in the code.

---

### Pitfall 8: Cursor-Based Pagination With Score-Sorted Results Creates Unstable Cursors

**Severity:** HIGH

**What goes wrong:** Switching from offset to cursor-based pagination requires a stable, unique, monotonic sort key. The current feed sorts by `score DESC, scrapedAt DESC`. Score is computed at query time based on the user's profile (location, equipment types, service radius). If the user updates their profile, every lead's score changes, invalidating all existing cursors. Even without profile changes, leads scraped between page loads can shift scores for nearby leads (e.g., a new high-value lead changes the relative ranking).

**Why it happens:** Cursor pagination assumes the sort order is stable between requests. Score-based sorting violates this assumption because score is derived, not intrinsic. The compound cursor `(score, scrapedAt, id)` is only valid as long as scores do not change.

**Warning signs:**
- Users navigating to page 3 see the same leads they saw on page 2
- Leads disappear from the feed when navigating backward
- Error messages about invalid or expired cursors

**How to avoid:**
1. **Use `(scrapedAt, id)` as the cursor, not `(score, scrapedAt, id)`.** Fetch a window of leads ordered by `scrapedAt DESC`, then score and re-sort within that window client-side or server-side. This makes the cursor stable.
2. **Encode cursors as opaque base64 tokens**, not raw IDs or timestamps. This prevents clients from constructing or manipulating cursors.
3. **Handle cursor invalidation gracefully:** If a cursor points to a deleted or modified record, fall back to the first page with a clear UI message, not an error.
4. **Do not expose auto-increment IDs** or UUIDs directly in cursors -- use a composite `(timestamp, uuid)` encoded as an opaque string.
5. Keep offset pagination as a fallback for the first release. Cursor pagination can be added later when lead volumes justify it.

**Phase to address:** Pagination redesign -- can be deferred to after the initial multi-industry launch if lead volumes are < 10,000.

**Confidence:** HIGH -- this is a well-documented limitation of cursor pagination with derived sort keys.

---

### Pitfall 9: Government API Integration (SAM.gov, NOAA, FEMA) Breaks Silently Due to Rate Limits, Downtime, and Format Changes

**Severity:** HIGH

**What goes wrong:** Government APIs have unique failure modes compared to commercial APIs:

1. **SAM.gov rate limit is 1,000 requests/day** (not per minute or per second). One overly aggressive scraping session burns the daily quota, and the API key is temporarily blocked. There is no real-time rate limit header -- you hit a wall and get HTTP 429 or silent empty responses.
2. **NOAA/Weather.gov API has undocumented rate limits** that trigger HTTP 503 errors. The rate limit resets within 5 seconds, but without retry logic, the scraper records 0 results and moves on.
3. **FEMA OpenFEMA returns max 1,000 records per call** and requires cursor-based pagination (not offset) to retrieve full datasets. Scraping without pagination misses most results.
4. **EIA (Energy Information Administration) API keys must be re-registered periodically** and the API version can change without deprecation notice.
5. **Government APIs have unannounced maintenance windows**, especially around fiscal year transitions (October) and during government shutdowns.
6. **Data format changes without versioning:** Government APIs sometimes change field names, add/remove fields, or change date formats in minor updates without bumping the API version.

**Why it happens:** Government APIs are not built to SaaS standards. They have limited budgets, inconsistent documentation, and no SLAs. The current project already has a known issue: `SAM_GOV_API_KEY` is not configured and the Dallas permits API returns 500 from their server.

**Warning signs:**
- Scraper adapter returns 0 results but no error (silent failure)
- API key is rejected after previously working
- Response schema does not match the Zod validation schema, causing all records to be classified as invalid
- Pipeline run shows high `invalidCount` for a government source

**How to avoid:**
1. **Implement per-source rate limiting with exponential backoff.** The existing `rate-limit.ts` file must be configured per source: SAM.gov at max 40 requests/hour (conservative, 960/day to stay under 1,000), NOAA at 1 request/second.
2. **Add circuit breakers.** If a source returns 3 consecutive errors, disable it for 1 hour and log an alert.
3. **Cache government API responses aggressively.** Storm data and bid postings change infrequently -- cache for 4-6 hours.
4. **Validate response schemas loosely.** Use Zod `.passthrough()` instead of strict parsing so unexpected new fields do not cause rejection. Log schema mismatches as warnings, not errors.
5. **Store the raw API response** alongside the parsed data for debugging format changes.
6. **Test with real API keys in staging** before adding new government sources. Do not assume the documented API matches reality.

**Phase to address:** Per-industry scraper development -- each government API integration should include rate limiting, circuit breakers, and caching from day one.

**Confidence:** HIGH -- SAM.gov rate limits confirmed by official docs; NOAA docs confirm rate limiting behavior; the project's known issues already document government API problems.

---

### Pitfall 10: Scraper Registry Tight Coupling Makes Multi-Industry Testing Impossible

**Severity:** HIGH

**What goes wrong:** The current scraper architecture has a module-level mutable `Map` in `registry.ts`, a single `initializeAdapters()` function in `adapters/index.ts` that registers ALL 8 adapters, and a pipeline that runs all registered adapters sequentially. This design has three problems for multi-industry expansion:

1. **No industry isolation:** You cannot run "only HVAC scrapers" or "only roofing scrapers." It is all-or-nothing.
2. **Testing requires the full registry:** To test a new HVAC adapter, you must either register only that adapter (requiring test-specific initialization code) or run the entire pipeline and filter results.
3. **The mutable global Map is not serverless-safe:** In Vercel serverless, the same instance can serve multiple requests. If two concurrent cron jobs call `initializeAdapters()`, the second call adds duplicates to the Map (since `clearAdapters()` is only called after the pipeline completes, not before `initializeAdapters()`).

**Why it happens:** The registry was designed for a single-pipeline, single-cron architecture. The `initializeAdapters` function hard-codes all adapters. There is no concept of adapter groups, industry tags, or conditional registration.

**Warning signs:**
- Adding a new adapter requires modifying `adapters/index.ts` (tight coupling)
- Unit testing an adapter requires importing the full registry
- Two scraper runs produce duplicate entries because the registry was not cleared between invocations

**How to avoid:**
1. **Add industry tags to the adapter interface.** Each `ScraperAdapter` should declare which industries it serves: `industries: string[]`.
2. **Replace the global Map with per-invocation adapter lists.** The pipeline function should accept an adapter list parameter, not rely on the global registry.
3. **Create factory functions per industry:** `getHVACAdapters()`, `getRoofingAdapters()`, etc. The cron dispatcher calls the appropriate factory.
4. **Alternatively, use a declarative registry** (a static array of adapter configs) instead of imperative `registerAdapter()` calls. This eliminates mutable state.
5. **Ensure `clearAdapters()` is called BEFORE `initializeAdapters()`**, not just after. Or better, eliminate the mutable registry entirely.

**Phase to address:** Scraper architecture redesign -- restructure the registry before adding new industry adapters.

**Confidence:** HIGH -- the mutable Map pattern, hard-coded adapter list, and cron handler are directly visible in the codebase at `registry.ts`, `adapters/index.ts`, and `api/cron/scrape/route.ts`.

---

## Moderate Pitfalls

Mistakes that cause bugs, degraded UX, or rework but are recoverable without data loss.

---

### Pitfall 11: Hash-Based Dedup Migration Conflicts with Existing Proximity-Based Dedup

**Severity:** MODERATE

**What goes wrong:** The current dedup system in `dedup.ts` uses proximity + text similarity (Haversine distance < 0.1 miles AND Dice coefficient > 0.7). Switching to hash-based dedup (e.g., SHA-256 of normalized address + title + source) creates a dual-system problem:

1. **Existing leads were deduped by proximity.** Two leads 0.05 miles apart with similar titles were merged. A hash-based system would not merge them (different addresses produce different hashes).
2. **Hash collisions are rare but catastrophic.** If two genuinely different leads produce the same hash, one is silently discarded.
3. **The transition period creates inconsistency:** Old leads deduped by proximity, new leads deduped by hash. Cross-source dedup between old and new leads fails because they use different strategies.

**Warning signs:**
- After switching to hash dedup, the same real-world project appears as 2-3 separate leads
- Lead counts spike after the switch (duplicates that proximity-dedup would have caught)
- The `deduplicateNewLeads()` function returns `{ merged: 0, kept: N }` for every batch

**How to avoid:**
1. **Keep proximity-based dedup as the cross-source dedup strategy.** It solves the "same project, different sources" problem that hash-based dedup cannot.
2. Use hash-based dedup ONLY for same-source dedup (preventing the same scraper from inserting the same record twice). This is already handled by the unique indexes on `(source_id, permit_number)` and `(source_id, source_url)`.
3. If adding a content hash column, make it supplementary: check hash first (fast, O(1) lookup), fall back to proximity dedup only when the hash does not match.
4. Do not retroactively re-dedup existing leads with the new strategy -- it will create more problems than it solves.

**Phase to address:** Dedup enhancement -- should be a targeted improvement to the existing system, not a wholesale replacement.

**Confidence:** HIGH -- the current dedup strategy is directly visible in `dedup.ts` and replacing it would orphan the existing dedup logic.

---

### Pitfall 12: Multi-Step Onboarding Wizard State Loss on Browser Back/Refresh

**Severity:** MODERATE

**What goes wrong:** The current onboarding wizard stores all state in `react-hook-form` in memory (via `useState` for `currentStep`). Expanding from 3 steps to 5-7 steps (industry selection, service categories, location, radius, notification preferences, etc.) increases the chance that a user:

1. **Refreshes the browser mid-wizard:** All form state is lost. The user returns to step 1.
2. **Clicks browser back:** The wizard does not track history state. Back navigates away from onboarding entirely, potentially triggering the auth redirect loop.
3. **Session expires mid-wizard:** On slow connections or long onboarding, the Better Auth session could expire. The submit action fails with an auth error, and all entered data is lost.
4. **Mobile keyboard dismissal:** On iOS, dismissing the keyboard sometimes triggers a scroll that causes the user to accidentally tap "Back" on the wizard.

**Warning signs:**
- Users start onboarding but never complete it (check `company_profiles` table for orgs without `onboardingCompleted = true`)
- Support requests about "I entered my info but it disappeared"
- Analytics showing high drop-off between steps 3 and 4

**How to avoid:**
1. **Persist wizard state to `sessionStorage`** on every step transition. On page load, restore from `sessionStorage` if available. Clear on successful completion.
2. **Use URL searchParams for the current step** (e.g., `/onboarding?step=3`). This makes browser back/forward work correctly with the wizard steps.
3. **Add a `beforeunload` event listener** that warns the user before navigating away with unsaved data.
4. **Validate and save partial profiles.** Instead of a single `completeOnboarding` action at the end, save each step's data to a `draft_profiles` table or to `company_profiles` with `onboardingCompleted = false`. This way, refreshing the page can resume from the last saved step.
5. **Keep the Enter key prevention** from the current wizard (already implemented at `wizard-shell.tsx` line 117-124).

**Phase to address:** Onboarding wizard redesign -- state persistence should be part of the initial wizard implementation, not bolted on later.

**Confidence:** HIGH -- the current `useState` for `currentStep` at `wizard-shell.tsx` line 33 is the vulnerability; all state is in-memory only.

---

### Pitfall 13: PostGIS on Neon Requires Manual Extension Creation and Drizzle Schema Alignment

**Severity:** MODERATE

**What goes wrong:** Neon supports PostGIS, and Drizzle has built-in `geometry()` column types. But the integration has several gotchas:

1. **Drizzle does NOT auto-create extensions.** You must run `CREATE EXTENSION IF NOT EXISTS postgis;` manually on the Neon database before using geometry columns. The migration generator does not include this.
2. **The `geometry` column type uses different storage than the current `real` columns.** Migrating from `lat REAL, lng REAL` to a `location GEOMETRY(Point, 4326)` requires a data migration that converts every existing lead's coordinates.
3. **GiST spatial indexes have different performance characteristics** than B-tree indexes on real columns. The current bounding-box query (`lat BETWEEN x AND y AND lng BETWEEN a AND b`) works with B-tree indexes. Switching to `ST_DWithin()` requires a GiST index.
4. **Drizzle's `neon-http` driver may have limitations with PostGIS binary types.** The current setup uses `drizzle-orm/neon-http` which goes through Neon's HTTP proxy. Complex PostGIS operations may require the WebSocket driver instead.

**Warning signs:**
- Migration fails with `ERROR: type "geometry" does not exist` (extension not created)
- Existing leads lose coordinate data during the column type migration
- Spatial queries return incorrect results due to SRID mismatch (4326 vs default)
- Performance degrades because the GiST index was not created

**How to avoid:**
1. **Phase the PostGIS migration.** Phase 1: Keep `lat REAL, lng REAL` columns but add a `location GEOMETRY(Point, 4326)` column alongside them. Populate it from existing lat/lng data. Phase 2: Migrate queries to use `ST_DWithin()`. Phase 3: Drop the old lat/lng columns after all queries are migrated.
2. Create the extension manually: `CREATE EXTENSION IF NOT EXISTS postgis;` -- add this as the first line of the first migration.
3. Create a backfill migration: `UPDATE leads SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat IS NOT NULL AND lng IS NOT NULL;`
4. Add GiST index: `CREATE INDEX leads_location_idx ON leads USING GIST (location);`
5. Verify the Neon HTTP driver supports PostGIS by testing a simple `ST_Distance()` query before committing to the migration.
6. **Alternative: Skip PostGIS entirely for now.** The current Haversine-on-REAL-columns approach works for < 100K leads. PostGIS is only needed if spatial query performance becomes a bottleneck.

**Phase to address:** Geospatial query optimization -- should be a dedicated phase after the basic multi-industry schema is working, not part of the initial expansion.

**Confidence:** HIGH -- Neon PostGIS support confirmed by Neon docs; Drizzle PostGIS schema support confirmed by Drizzle docs; the manual extension creation requirement is explicitly documented.

---

### Pitfall 14: CAN-SPAM Violations from Lead Notification Emails

**Severity:** MODERATE

**What goes wrong:** The email digest system sends commercial emails to users with lead recommendations. CAN-SPAM compliance requires:

1. **Physical mailing address** in every commercial email. The current `send-digest.ts` does not include one.
2. **Functional unsubscribe link** that works within 10 business days. The current digest system has `isDigestEnabled` per saved search, but there is no one-click unsubscribe link in the email itself.
3. **Non-deceptive subject lines.** Subject lines like "New leads in your area!" are fine. "URGENT: Action required" would be non-compliant.
4. **Clear identification as advertisement** if the email contains promotional content.
5. **Penalties are $51,744 per violating email** (2025 adjusted amount).

**Why it happens:** Transactional emails (password reset, email verification) are exempt from CAN-SPAM. But lead digest emails are commercial -- they promote the value of the paid service. The boundary between transactional and commercial is the presence of any promotional content. Even adding "Upgrade to see more leads" to a transactional email makes the entire email commercial.

**Warning signs:**
- Emails do not include a physical mailing address
- There is no unsubscribe link in the email template
- The unsubscribe mechanism requires logging into the app (must be one-click or reply-to-unsubscribe)

**How to avoid:**
1. **Add a physical mailing address** to every commercial email template (can be a PO Box or registered agent address).
2. **Add a one-click unsubscribe link** using `List-Unsubscribe` email header AND an in-body unsubscribe link. The link should work without requiring login.
3. Implement an unsubscribe endpoint: `GET /api/unsubscribe?token=...` that sets `isDigestEnabled = false` for all of the user's saved searches.
4. Use signed tokens in the unsubscribe link to prevent abuse (someone unsubscribing other users).
5. Keep transactional emails (password reset, email verification) strictly transactional. No upsell copy, no promotional content.
6. Process unsubscribe requests immediately (not the 10-day maximum).

**Phase to address:** Email notification system -- CAN-SPAM compliance must be part of the initial email template design, not retrofitted.

**Confidence:** HIGH -- FTC CAN-SPAM compliance guide is unambiguous; penalties are per-email; the current digest system has no unsubscribe mechanism.

---

### Pitfall 15: React Email Templates Break at Build Time or Render Incorrectly

**Severity:** MODERATE

**What goes wrong:** The current app already uses React Email for the password reset template (`PasswordResetEmail`). Expanding to multiple templates (digest, verification, storm alert, welcome) introduces:

1. **Build-time failures:** React Email components that import browser-only code (CSS-in-JS libraries, React hooks) fail during `next build` because email templates are rendered server-side during the Resend send call.
2. **Email client rendering inconsistency:** React Email renders to HTML that works in modern email clients but can break in Outlook (which uses Word's rendering engine). Tables, inline styles, and specific CSS properties behave differently across Gmail, Outlook, Apple Mail, and mobile clients.
3. **Dynamic imports in auth config:** The current `auth.ts` uses `await import("resend")` inside `sendResetPassword`. Adding more email templates increases the number of dynamic imports in the auth config, which is a hot path. Each dynamic import adds cold start latency.
4. **Template prop mismatches:** If the template expects `userName: string` but the caller passes `userName: null`, the email renders with "null" as text instead of a fallback.

**Warning signs:**
- `next build` fails with errors referencing email component files
- Emails look correct in Gmail but are garbled in Outlook
- Cold start time for auth routes increases after adding email templates
- Email body contains the literal string "null" or "undefined"

**How to avoid:**
1. **Keep email templates in a separate directory** (`src/components/emails/`) that is not imported at module level by hot paths. Use dynamic imports (`await import(...)`) only when sending.
2. **Use only React Email's built-in components** (`<Html>`, `<Body>`, `<Text>`, `<Button>`, `<Section>`, etc.). Do not use custom CSS frameworks, Tailwind CSS classes, or `<style>` tags in emails.
3. **Test every email template** with the React Email dev server (`npx email dev`) to preview rendering before deploying.
4. **Default all template props:** `userName ?? "there"`, `address ?? "your service area"`. Never render nullable fields without a fallback.
5. **Move Resend initialization out of auth.ts.** Create a shared `sendEmail()` utility that handles Resend client creation, env var trimming, and error handling. Import it from auth config and digest generator.

**Phase to address:** Email template system -- establish the template architecture and testing workflow before creating individual templates.

**Confidence:** MEDIUM -- the current single template works, but scaling to 5+ templates introduces the rendering and import issues documented above.

---

### Pitfall 16: Map Component (Mapbox/Leaflet) Crashes SSR and Bloats Bundle

**Severity:** MODERATE

**What goes wrong:** Both Mapbox GL JS and Leaflet/React-Leaflet depend on browser APIs (`window`, `document`, `navigator`) that do not exist during server-side rendering. Importing a map component at the top level of a page or layout crashes the build or produces hydration errors. Additionally:

1. **Mapbox GL JS is ~230 KB gzipped.** On a SaaS app where most page loads are the lead feed (not the map), this bloats the initial bundle for every page.
2. **Leaflet is ~39 KB gzipped** but requires CSS loaded separately, and React-Leaflet adds another layer of abstraction.
3. **Service area visualization requires tile layers** that make external network requests. On slow connections, the map renders as a gray box for several seconds.

**Why it happens:** Both libraries make direct DOM calls on import. This is a fundamental architecture issue, not a configuration problem. The standard workaround is `next/dynamic` with `ssr: false`, but this must be applied correctly.

**Warning signs:**
- `next build` fails with `ReferenceError: window is not defined`
- Hydration mismatch errors in the browser console
- Bundle analyzer shows map library in the main chunk instead of a lazy-loaded chunk
- The map component renders as a blank white rectangle on first paint

**How to avoid:**
1. **Use `next/dynamic` with `ssr: false`** for the map component. It must be a client component loaded dynamically:
   ```tsx
   const ServiceAreaMap = dynamic(() => import("@/components/maps/service-area-map"), { ssr: false });
   ```
2. **Use Leaflet, not Mapbox,** for this use case. Leaflet is 6x smaller, free, and sufficient for showing a service radius circle on a map. Mapbox's advanced features (3D terrain, custom styles) are not needed for a service area visualization.
3. **Lazy-load the map component** so it is not in the initial bundle. Only load when the user navigates to the settings/profile page where the map is shown.
4. **Provide a meaningful loading state** (not just a spinner) -- show the address text and radius value while the map loads.
5. **Use Leaflet with OpenStreetMap tiles** (free, no API key) for the initial implementation. Switch to Mapbox only if custom styling is needed later.

**Phase to address:** Service area map component -- use Leaflet with dynamic import as the default choice.

**Confidence:** HIGH -- SSR incompatibility of both libraries is well-documented; bundle sizes verified by bundlephobia.

---

### Pitfall 17: Cross-Industry Lead Relevance Creates Unbounded Query Complexity

**Severity:** MODERATE

**What goes wrong:** When a user's organization serves multiple industries (e.g., an equipment rental company serving both heavy construction and solar installation), the lead query must filter across multiple industry-specific criteria simultaneously. The current scoring engine has three factors (equipment 50%, distance 30%, value 20%). Adding industry-specific factors creates a combinatorial explosion:

1. The equipment inference (`inferEquipmentNeeds`) is hard-coded for heavy equipment keywords. HVAC leads need a different keyword set. Solar needs another. Maintaining N keyword sets in a single function becomes unmaintainable.
2. Scoring weights should differ per industry. An HVAC contractor cares more about project type than distance. A roofer cares more about weather events than equipment match.
3. If the query returns leads from all 5 industries and scores them with a single formula, industry-specific leads get drowned out by the majority industry.

**Warning signs:**
- HVAC leads all score 0 because `inferEquipmentNeeds` does not recognize HVAC equipment
- One industry dominates the feed because it has more leads in the database
- Users manually filtering by industry see very different results than the "all industries" view

**How to avoid:**
1. **Score per industry, then merge.** For each industry the user subscribes to, run scoring with that industry's weights and keyword set. Then interleave results so each industry gets fair representation.
2. **Create industry-specific scoring profiles** as data (not code): a JSON config per industry defining equipment keywords, scoring weights, and relevance signals. Do not hard-code.
3. **Allow users to set per-industry priorities** in their profile (e.g., "I care more about HVAC than solar"). Use this to weight the interleaving.
4. **Start simple:** For v3.0, each organization has ONE primary industry. Multi-industry support comes later. This avoids the complexity of cross-industry scoring entirely.

**Phase to address:** Scoring engine redesign -- start with single-industry-per-org, expand to multi-industry later.

**Confidence:** MEDIUM -- the current scoring engine is visible in `scoring.ts` and `equipment-inference.ts`; the complexity of multi-industry scoring is a design decision, not a technical limitation.

---

## Minor Pitfalls

Issues that cause friction or tech debt but are not immediately dangerous.

---

### Pitfall 18: Vercel Env Var Trailing Newline Breaks New API Keys

**Severity:** LOW (but has caused production incidents before)

**What goes wrong:** This project has a documented history of trailing `\n` in Vercel dashboard environment variables breaking API clients. When adding new API keys for government APIs (NOAA, FEMA, EIA), Mapbox, or additional Resend domains, the same issue will recur.

**How to avoid:** Every env var access must use `.trim()`. The existing pattern `(process.env.X ?? "").trim()` is established in `auth.ts` and `cron/scrape/route.ts`. Enforce this as a project convention for every new env var access.

**Phase to address:** All phases -- enforce as a code review convention.

**Confidence:** HIGH -- documented past incident.

---

### Pitfall 19: `drizzle-kit push` Still Used in CI or Local Workflows

**Severity:** LOW

**What goes wrong:** The project notes say `npx drizzle-kit push` is needed for the `leads_source_url_dedup_idx` index. If this workflow persists into v3.0, it will bypass migration files and create drift between the migration history and the actual database schema. Future `drizzle-kit generate` will produce incorrect diffs because the journal does not know about the push-applied changes.

**How to avoid:** Before v3.0 development begins, reconcile the current production schema with the migration history. Run `drizzle-kit introspect` to capture the actual schema, then create a baseline migration that matches production. From this point forward, only use `generate` + `migrate`.

**Phase to address:** Schema migration setup -- reconcile schema before starting expansion work.

**Confidence:** HIGH -- the known issue is documented in project notes.

---

### Pitfall 20: Bundle Size Creep from Multi-Industry UI Components

**Severity:** LOW

**What goes wrong:** Adding industry-specific icons, color themes, category selectors, and map components across 5 industries increases the client-side bundle. If each industry has a custom icon set (e.g., HVAC has AC units, roofing has house icons, solar has panel icons), these add up. Combined with a map library, the initial page load can exceed Vercel's recommended 200 KB gzipped threshold.

**How to avoid:** Use Lucide icons (already likely in the project via shadcn) which are tree-shakeable. Lazy-load industry-specific components. Use `next/dynamic` for anything not needed on initial render. Monitor bundle size with `@next/bundle-analyzer`.

**Phase to address:** UI implementation phases -- track bundle size from the start.

**Confidence:** MEDIUM.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `drizzle-kit push` for production | Faster schema changes | Schema drift, migration history becomes unreliable | Never for v3.0 |
| Store industry config in TypeScript constants | Easy to type, fast to implement | Requires code deploy to add/modify industries | MVP only; move to database config by v3.1 |
| In-memory scoring for all leads | Simple, works for small datasets | O(n) per page load, memory pressure at 50K+ leads | Acceptable until 10K leads, then must migrate to SQL |
| Single scoring formula for all industries | One function, easy to maintain | Industry-specific relevance is poor | MVP only; add per-industry weights before launch |
| One cron job for all industries | Simple scheduling, no concurrency issues | 5-minute timeout constrains total scraping time | Acceptable until scraping exceeds 4 minutes |
| Hard-coded adapter list in `initializeAdapters()` | Simple registration, clear code | Must modify code to add/remove adapters | Never for v3.0; use declarative registry |

## Integration Gotchas

Common mistakes when connecting to external services relevant to this expansion.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SAM.gov API | Exceeding 1,000 requests/day, getting key blocked | Rate limit to 40 requests/hour max; cache responses for 6 hours |
| NOAA Weather API | Not handling 503 rate limit responses | Retry with 5-second backoff; cache weather data for 4 hours |
| FEMA OpenFEMA | Fetching only first page (1,000 records) | Implement cursor-based pagination; FEMA uses `$skip` parameter |
| Neon PostGIS | Assuming `CREATE EXTENSION` runs automatically | Must manually create extension via SQL console before using geometry types |
| Resend (email) | Using `onboarding@resend.dev` for commercial emails | Configure custom domain with SPF/DKIM/DMARC before CAN-SPAM emails |
| Mapbox/Leaflet | Importing at top level of server component | Use `next/dynamic` with `ssr: false`; never import in server components |
| Stripe (existing) | Changing checkout params during expansion | Do not modify `buildCheckoutSessionParams`; add new plans additively |
| Vercel Cron | Assuming cron runs exactly on schedule on Hobby | Hobby plan has +/- 59 minute precision; Pro plan required for precise scheduling |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetch ALL leads then paginate in memory | Slow dashboard, high memory | Move scoring to SQL, use database pagination | > 10,000 leads |
| Haversine in SQL WHERE without spatial index | Full table scan on every query | Add PostGIS with GiST index, or add B-tree on (lat, lng) | > 50,000 leads |
| N+1 profile lookups in digest generator | Digest cron timeouts | Batch profile lookup before user loop | > 50 users with digests |
| Sequential adapter execution in pipeline | Pipeline exceeds 5-minute timeout | Parallelize independent adapters with `Promise.allSettled()` | > 15 adapters total |
| In-memory equipment inference per lead | CPU-bound enrichment | Cache inference results, or move keywords to database | > 20,000 leads per request |
| Single `leads` table for all industries | Query performance degrades | Add industry column with B-tree index; consider partitioning | > 200,000 leads |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unsubscribe link without signed token | Anyone can unsubscribe anyone else | Use HMAC-signed tokens in unsubscribe URLs |
| Exposing lead coordinates in API response | Competitor can scrape your lead database | Rate-limit API endpoints; omit precise coordinates from list view |
| Government API key in client-side bundle | Key is visible in browser DevTools | Keep all API keys server-side; use API routes as proxy |
| No org-scoping on lead queries | User A can see User B's bookmarks/statuses | Always include `organizationId` in WHERE clauses (already done) |
| Cursor tokens containing raw database IDs | Information leakage about record counts | Encode cursors as opaque base64 strings with HMAC signature |

## UX Pitfalls

Common user experience mistakes relevant to this expansion.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forcing existing users through re-onboarding | Users lose trust, think data was deleted | Show "Update your profile" banner instead |
| Industry-specific jargon in generic UI | HVAC contractor confused by "equipment types" | Use industry-appropriate labels (e.g., "Service types" for HVAC) |
| Empty state when new industry has no leads yet | Users think the product is broken | Show "We're building coverage for [industry] in your area" with a timeline |
| Map loads before address is entered | Blank gray rectangle confuses users | Only show map after geocoding succeeds |
| All 5 industries shown to single-industry users | Information overload, irrelevant content | Show only subscribed industries; hide others |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Schema migration:** Looks done after `drizzle-kit generate` -- verify migration SQL does NOT contain `DROP COLUMN`, test on a Neon branch
- [ ] **Email verification:** Looks done after adding `requireEmailVerification` -- verify existing users have `email_verified = true` in production database
- [ ] **Onboarding wizard:** Looks done after new steps render -- verify existing users are NOT redirected to re-onboard, verify state persists on refresh
- [ ] **CAN-SPAM compliance:** Looks done after adding unsubscribe link -- verify physical address is in email, verify one-click unsubscribe works without login
- [ ] **PostGIS migration:** Looks done after schema change -- verify `CREATE EXTENSION postgis` was run on production Neon, verify backfill populated geometry column
- [ ] **Cron expansion:** Looks done after adding vercel.json crons -- verify Hobby/Pro plan supports the frequency, verify no concurrent execution conflicts
- [ ] **Government API integration:** Looks done after adapter returns data -- verify rate limiting is configured per-source, verify error handling for 503/429/maintenance
- [ ] **Cursor pagination:** Looks done after page navigation works -- verify cursors survive lead insertion (new scrape), verify backward navigation, verify cursor invalidation returns to page 1
- [ ] **Industry-specific scoring:** Looks done after scores appear -- verify HVAC/roofing/solar leads get non-zero scores, verify industry keywords are configured
- [ ] **Map component:** Looks done after map renders -- verify `ssr: false` is set, verify bundle size increase is < 50 KB gzipped, verify map does not flash/reload on parent re-render

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Column data dropped by migration | HIGH | Restore from Neon point-in-time backup; replay migration correctly |
| Existing users locked out by email verification | LOW | Revert deploy; run UPDATE to set email_verified = true |
| Leads missing industry association | MEDIUM | Run backfill migration; default all to 'heavy_equipment' |
| Cron jobs running concurrently | MEDIUM | Add distributed lock; deduplicate affected leads |
| Government API key burned for the day | LOW | Wait 24 hours; reduce rate limit configuration |
| Onboarding redirect loop | LOW | Fix the guard logic; existing users unaffected if profile data preserved |
| CAN-SPAM violation reported | HIGH | Immediately add unsubscribe to all templates; contact FTC counsel |
| PostGIS extension not created | LOW | Run `CREATE EXTENSION postgis;` manually on Neon console |
| Bundle size exceeds threshold | LOW | Add `next/dynamic` lazy loading; move map to separate route |
| Hash dedup over-merges leads | MEDIUM | Revert to proximity dedup; re-scrape affected sources |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: Column drop on rename | Schema migration | Review every generated SQL file for DROP COLUMN |
| P2: Deploy/migration desync | Schema migration | Deploy migration BEFORE code; test in Neon branch |
| P3: Missing industry on existing leads | Schema migration | Query `SELECT COUNT(*) FROM leads WHERE industry_id IS NULL` = 0 |
| P4: Onboarding breaks existing users | Onboarding wizard | Log in as admin account on preview deploy |
| P5: Email verification lockout | Auth enhancements | Sign in as existing user on preview deploy |
| P6: Cron concurrency/limits | Cron architecture | Review vercel.json against plan limits; test concurrent execution |
| P7: Query-time scoring at scale | Scoring engine | Load test with 10K+ synthetic leads; measure response time |
| P8: Unstable cursor pagination | Pagination redesign | Navigate pages, insert new leads, verify no duplicates |
| P9: Government API failures | Scraper development | Test each API with real keys; verify rate limiting logs |
| P10: Scraper registry coupling | Scraper architecture | Test single-industry scraper run without loading all adapters |
| P11: Hash dedup conflicts | Dedup enhancement | Compare lead counts before/after dedup run |
| P12: Wizard state loss | Onboarding wizard | Refresh browser mid-wizard; verify state persists |
| P13: PostGIS setup | Geospatial optimization | Run `SELECT PostGIS_version();` on production Neon |
| P14: CAN-SPAM compliance | Email system | Audit every email template for address + unsubscribe link |
| P15: Email template builds | Email system | Run `next build` after adding each new template |
| P16: Map SSR crash | UI components | Run `next build`; check bundle analyzer output |
| P17: Cross-industry scoring | Scoring engine | Verify non-zero scores for each industry's test leads |

## Production Safety Checklist

Given this project's incident history, every v3.0 change must pass these checks:

- [ ] **No module-level side effects on critical paths.** The env.ts lesson: validate at usage points, not import time. Never add new imports to `db/index.ts`, `auth.ts`, or `stripe.ts` without explicit justification.
- [ ] **Schema migrations tested on Neon branch.** Create a Neon branch, apply migration, verify data integrity, then apply to production.
- [ ] **Expand-then-contract for schema changes.** New columns are nullable with defaults. Old columns are not removed until all code paths are migrated.
- [ ] **Build AND runtime verification.** `next build` passing is necessary but not sufficient. Think through Vercel serverless cold start behavior for every code path.
- [ ] **Env var `.trim()` on every new access.** The trailing newline incident must not repeat.
- [ ] **Preview deploy testing.** Every PR tested on Vercel preview before merging to main. Test with existing admin account.
- [ ] **Backward compatibility.** All API changes are additive. Existing endpoints continue to work for current users during the transition.
- [ ] **Database migrations before code deploys.** Migration lands and is verified, then code that depends on it ships.

---

## Sources

- [Drizzle ORM Migrations Docs](https://orm.drizzle.team/docs/migrations) -- generate vs push vs migrate; strict mode for renames
- [Drizzle ORM PostGIS Geometry Guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point) -- schema definition, spatial queries, manual extension creation
- [Drizzle ORM PostgreSQL Extensions](https://orm.drizzle.team/docs/extensions/pg) -- PostGIS and pgvector support; extension management
- [Neon Schema Migration with Drizzle](https://neon.com/docs/guides/drizzle-migrations) -- Neon-specific migration workflow
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Hobby: daily only; Pro: per-minute; 100 crons per project
- [Vercel Function Duration Limits](https://vercel.com/docs/functions/configuring-functions/duration) -- Hobby: max 300s; Pro: max 800s with fluid compute
- [SAM.gov API Rate Limits](https://api.sam.gov/docs/rate-limits/) -- 1,000 requests/day limit
- [NOAA Weather API Documentation](https://www.weather.gov/documentation/services-web-api) -- rate limiting behavior, 503 responses
- [FEMA OpenFEMA API Documentation](https://www.fema.gov/about/openfema/api) -- 1,000 records/call limit, pagination required
- [Better Auth Email & Password Docs](https://better-auth.com/docs/authentication/email-password) -- requireEmailVerification behavior, sendOnSignIn option
- [FTC CAN-SPAM Act Compliance Guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) -- requirements, $51,744 penalty per email
- [Cursor-Based Pagination Best Practices](https://embedded.gusto.com/blog/api-pagination/) -- cursor validity, migration from offset
- [Drizzle ORM Releases](https://github.com/drizzle-team/drizzle-orm/releases) -- strict mode, migration rollback discussions
- [Vercel Limits Documentation](https://vercel.com/docs/limits) -- function concurrency, plan-specific limits
- Project incident history: env.ts production 500, Stripe double-nesting, geocoding 0,0, build-vs-runtime failures

---
*Pitfalls research for: LeadForge v3.0 Multi-Industry Platform Expansion*
*Researched: 2026-03-16*
