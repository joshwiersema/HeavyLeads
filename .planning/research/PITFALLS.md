# Pitfalls Research: GroundPulse v4.0 Nationwide Scaling

**Domain:** Scaling a lead generation SaaS from 3-city scraping to 50-state coverage, fixing broken scoring, integrating dozens of heterogeneous data sources, all on Vercel Hobby + Neon free tier
**Researched:** 2026-03-19
**Confidence:** HIGH (verified against codebase analysis, Vercel official docs, Neon official docs, Socrata API docs, Google Maps pricing docs, and legal case law)

**CRITICAL CONTEXT:** This is a 100x scale increase (3 cities to all 50 states) on infrastructure with hard limits. The scoring engine currently produces identical scores for every lead. The existing adapter pattern hardcodes per-city field mappings. Every cron job runs daily on Vercel Hobby. The database is Neon free tier with 0.5 GB storage and 100 CU-hours/month. Geocoding uses Google Maps API ($5/1,000 requests after 10K free). These constraints interact in ways that compound failure risk.

---

## Critical Pitfalls

Mistakes that cause production outages, data corruption, cost explosions, or require architectural rework.

---

### Pitfall 1: Vercel Hobby 300-Second Function Timeout vs Nationwide Scraping

**What goes wrong:**
Each per-industry cron job currently runs all adapters sequentially in a single function invocation (see `src/app/api/cron/scrape/[industry]/route.ts` with `maxDuration = 300`). With 3 city adapters plus a handful of national sources, this fits within 300 seconds. Scaling to 50+ Socrata permit adapters per industry -- each making HTTP requests with rate limiting (8 req/min for Socrata) -- means a single industry scrape could need 50+ sequential API calls at 7.5 seconds each = 375+ seconds minimum. The function times out with a 504 error, no leads are stored from that run, and the pipeline_runs table records "failed."

**Why it happens:**
The current architecture runs adapters sequentially in `runPipeline()` (line 36-43 of pipeline.ts: `for (const adapter of adapters)`). With 3 adapters this takes ~30 seconds. At 50+ adapters with rate limiting, the sequential loop cannot complete within the 300-second hard ceiling.

**How to avoid:**
- Split nationwide scraping into multiple function invocations. Instead of one cron → one function → all adapters, use a fan-out pattern: one orchestrator cron triggers individual per-region or per-batch function calls via fetch.
- Group Socrata adapters into batches of 5-10 per function invocation. Each batch completes within 60-90 seconds.
- Use Vercel's Fluid Compute (already available on Hobby, confirmed max 300s). The 300s ceiling is hard -- you cannot increase it without upgrading to Pro ($20/month, max 800s).
- Consider moving heavy scraping to an external job runner (Inngest, Trigger.dev, or a simple external cron hitting your API routes) that can run for minutes without timeout.

**Warning signs:**
- Pipeline runs completing with "failed" status and FUNCTION_INVOCATION_TIMEOUT errors in Vercel logs
- Adapter count per industry exceeding 15-20
- Socrata rate limiter queue backing up (visible as long p-queue wait times)

**Phase to address:** Phase 1 (Scraper Architecture) -- must be solved before adding more than ~10 adapters per industry.

---

### Pitfall 2: Scoring Engine Produces Identical Scores (The 30/100 Problem)

**What goes wrong:**
Every lead gets roughly the same score (around 30/100), making the feed useless for prioritization. Users see a wall of identically-scored leads with no way to tell which ones matter. This is the single biggest product failure -- the core value proposition ("personalized, scored leads") is broken.

**Why it happens (root cause analysis from codebase):**
The scoring engine has 5 dimensions totaling 100 points. The problem is that most leads share the same inputs:

1. **Distance (25 pts):** Most leads within service radius score 10-15 pts. Reasonable spread.
2. **Relevance (30 pts):** Most leads have `applicableIndustries` set to ALL 5 industries (low confidence). The enrichment in `equipment-inference.ts` (line 68-69) defaults unmatched leads to all industries. This triggers the `isLowConfidence` path in `relevance.ts` (line 80-83), giving +5 points instead of +10. Most leads get the same 5 pts.
3. **Value (20 pts):** Most permit records lack `estimatedValue` (it's null). The value scorer gives null values 10 pts (line 38-40 of value.ts). Most leads get exactly 10 pts.
4. **Freshness (15 pts):** All leads scraped in the same daily batch get the same freshness score (15 if today, 12 if 1-3 days old). No differentiation within a batch.
5. **Urgency (10 pts):** All permits get exactly 5 pts ("Active building permit" in urgency.ts line 77-79). Bids without deadlines get 0 pts.

**Typical calculation:** Distance 10 + Relevance 5 + Value 10 + Freshness 12-15 + Urgency 5 = **42-45** (or ~30 with the old scoring engine in `leads/scoring.ts` which is also still called from `queries.ts`).

The real problem: there are TWO scoring systems (old in `src/lib/leads/scoring.ts` and new in `src/lib/scoring/engine.ts`), and different code paths use different ones. The old system scores on equipment match, distance, and value only. The new system scores on distance, relevance, value, freshness, and urgency. Neither produces meaningful differentiation because the INPUT DATA lacks variance -- most permits have no estimated value, no specific industry classification, and no deadline.

**How to avoid:**
- Fix the data first: ensure scrapers extract estimated values, project types, and deadlines from source data. Many Socrata datasets have these fields but the current adapters don't always map them.
- Fix the relevance scoring: the "all 5 industries" default should give 0 pts, not 5 pts. Only high-confidence industry matches should score points.
- Add variance sources: contractor reputation signals, project size signals from permit type (residential vs commercial), repeat contractor detection.
- Remove the old scoring engine (`src/lib/leads/scoring.ts`) and consolidate on the new 5-dimension engine. Having two systems is a maintenance trap.
- Add scoring unit tests with realistic data distributions to verify score variance.

**Warning signs:**
- Histogram of lead scores shows a single spike (no bell curve)
- Standard deviation of scores across a feed is less than 5 points
- Users never scroll past page 1 because all scores look the same

**Phase to address:** Phase 2 (Scoring Engine Fix) -- must be fixed independently of scraper scaling, but depends on having better input data from Phase 1.

---

### Pitfall 3: Geocoding Cost Explosion at Nationwide Scale

**What goes wrong:**
Google Maps Geocoding API costs $5 per 1,000 requests after 10,000 free monthly requests. Currently, Dallas permits require geocoding (no lat/lng in dataset), while Austin and Atlanta include coordinates. At nationwide scale with potentially 200+ cities, many Socrata datasets lack coordinates. If 50,000 permits/month need geocoding = 50,000 API calls = $200/month just for geocoding. If the pipeline runs daily and re-processes records (the current upsert pattern), the same addresses get geocoded repeatedly, multiplying costs.

**Why it happens:**
The current `geocodeBatch()` in `pipeline.ts` (lines 402-454) geocodes every record without coordinates on every pipeline run. There is no geocoding cache -- if the same address appears in tomorrow's scrape, it gets geocoded again. The 25ms throttle between requests (line 13: `GEOCODE_THROTTLE_MS = 25`) prevents rate limiting but doesn't prevent cost accumulation.

**How to avoid:**
- Implement a geocoding cache table: `geocoding_cache(address_hash, lat, lng, formatted_address, cached_at)`. Check cache before calling Google. This alone could reduce API calls by 80-90%.
- Use free geocoding for bulk/batch processing: Nominatim (OpenStreetMap) handles most US addresses adequately. Reserve Google Maps for fallback when Nominatim returns no result or low confidence.
- Many Socrata datasets already include lat/lng -- prioritize datasets that include coordinates over those that don't.
- Set a Google Maps API budget cap in the Google Cloud Console to prevent runaway costs ($50/month cap = hard limit).
- Skip geocoding for leads that already have city/state (distance can be approximated from city center coordinates stored in a lookup table).

**Warning signs:**
- Google Cloud billing alerts exceeding $50/month
- Geocoding function taking longer than expected (indicates high volume)
- Same addresses appearing in geocoding logs on consecutive days

**Phase to address:** Phase 1 (Scraper Architecture) -- must implement geocoding cache before adding nationwide adapters.

---

### Pitfall 4: Neon Free Tier Storage Limit (0.5 GB) at Nationwide Scale

**What goes wrong:**
Neon free tier allows 0.5 GB per project. The current leads table schema stores 20+ columns per lead including text fields (title, description, address, formatted_address). At 1 KB average per row, 500,000 leads = 500 MB. With nationwide scraping producing 5,000-10,000 new leads daily, the 0.5 GB limit is hit within 2-3 months, possibly sooner with indexes. When storage is exhausted, INSERT operations fail silently or with errors, and the scraping pipeline breaks without clear diagnostics.

**Why it happens:**
The current expiration cron (`/api/cron/expire`) exists but its aggressiveness determines storage trajectory. If leads are kept indefinitely (or for 90+ days), storage fills. PostgreSQL indexes, TOAST storage for large text fields, and the dead tuple overhead from frequent upserts all consume storage beyond the raw row data.

**How to avoid:**
- Implement aggressive lead expiration: leads older than 30-45 days with no user interaction (no bookmark, no status change) should be deleted, not just marked expired.
- Monitor storage usage via Neon dashboard and set alerts at 70% (350 MB).
- Consider upgrading to Neon Launch plan ($19/month, 10 GB storage) when approaching the limit. This is a predictable, planned cost -- not an emergency.
- Vacuum the database regularly (Neon auto-vacuums, but verify it's running after bulk deletes).
- Avoid storing full HTML/description text -- truncate descriptions to 500 chars at ingest time.
- Use `VACUUM FULL` periodically via Neon SQL editor to reclaim space from dead tuples.

**Warning signs:**
- Neon dashboard showing storage above 400 MB
- INSERT operations returning errors or taking unusually long
- Pipeline runs completing with 0 records stored despite adapters finding records

**Phase to address:** Phase 1 -- must implement storage monitoring and expiration before scaling scraping volume.

---

### Pitfall 5: Neon Free Tier Compute Hours (100 CU-hours/month) Exhaustion

**What goes wrong:**
Neon free tier provides 100 CU-hours per month. With auto-scaling to 2 CU and a 5-minute idle timeout, the compute budget is consumed by: (a) scraping pipeline crons running 11 jobs daily, each keeping the database active for 2-5 minutes, (b) user dashboard queries running Haversine distance calculations on every page load, (c) enrichment cron processing 500 leads per run. At scale, more frequent scraping + more users = more active compute time. If compute hours are exhausted, the database becomes unavailable until the next billing cycle.

**Why it happens:**
The `getFilteredLeadsWithCount()` query (line 483-638 of queries.ts) fetches ALL within-radius leads with no SQL LIMIT, computes Haversine in SQL for every row, enriches in-memory, then sorts and paginates. With 50,000+ leads in the database, this is expensive. Each page load triggers this query. 100 daily active users x 5 page loads x 2-second query = 1,000 seconds of active compute per day = ~17 CU-hours/month just from user queries.

**How to avoid:**
- Add SQL-level LIMIT to the "fetch all" query -- the comment says "Haversine WHERE already limits results" but with nationwide data, a 200-mile radius could return 50,000 leads.
- Implement result caching (short TTL, 5-10 minutes) for feed queries to avoid re-computing scores on every page load.
- Pre-compute distance at ingest time for known org HQ locations instead of computing Haversine on every query.
- Monitor CU-hour consumption weekly via Neon dashboard.
- If approaching limits, upgrade to Neon Launch ($19/month, 300 CU-hours) before hitting the wall.

**Warning signs:**
- Neon dashboard showing >70% of CU-hours consumed by day 20 of the month
- Dashboard queries taking >3 seconds (indicates high compute load)
- Neon auto-suspending compute mid-session during low-traffic hours

**Phase to address:** Phase 3 (Performance Optimization) -- after scraping scales, before user count grows.

---

### Pitfall 6: Socrata Schema Inconsistency Across Cities

**What goes wrong:**
The current adapter pattern (see `SocrataConfig.fieldMap` in `socrata-permit-adapter.ts`) requires hardcoding field names for each city. Austin uses `permit_number`, `issue_date`, `permit_location`. Dallas uses `permit_number`, `issued_date`, `street_address`. Every city uses different field names for the same concepts. Building 200+ individual adapter classes is unsustainable and creates a maintenance nightmare -- when a city changes its schema, the corresponding adapter silently returns empty results or crashes.

**Why it happens:**
Socrata does not enforce a standard schema across municipalities. Each city defines its own column names, data types, and available fields. Some cities include lat/lng, some don't. Some have `estimated_value`, others have `project_cost` or `valuation` or no value field at all. Some use `permit_date`, others `issue_date`, `issued_date`, `date_issued`, or `approval_date`.

**How to avoid:**
- Build a dynamic Socrata discovery system instead of per-city adapter classes. Store schema mappings in a configuration table (database or JSON config file), not in TypeScript code.
- Create a field name normalizer that maps common variants: `{issued_date, issue_date, date_issued, approval_date} -> permitDate`.
- Use Socrata's metadata API (`/api/views/{datasetId}.json`) to auto-discover column names and types before scraping. Match columns to expected fields using fuzzy name matching.
- Add a "schema validation" step that logs warnings when expected fields are missing from a dataset, rather than silently producing malformed leads.
- Start with the top 50 cities by population (covers ~60% of US construction activity) rather than trying to discover every Socrata portal at once.

**Warning signs:**
- Adapter returning 0 results for a city that should have data
- Field values appearing in wrong columns (e.g., address in description field)
- Growing number of "N records failed validation" warnings in pipeline logs

**Phase to address:** Phase 1 (Scraper Architecture) -- the core architectural decision of "per-city classes vs dynamic config" must be made before adding any new cities.

---

### Pitfall 7: Vercel Hobby Cron Limitation -- Daily Only, No Sub-Daily Scraping

**What goes wrong:**
Vercel Hobby plan restricts cron jobs to once-per-day execution (confirmed: expressions that run more frequently fail deployment with error "Hobby accounts are limited to daily cron jobs"). The current `vercel.json` has 11 cron entries running at different times each day. With nationwide scraping, you might want to stagger scraping across the day (morning batch for East Coast, afternoon for West Coast) or run enrichment/geocoding hourly. This is impossible on Hobby.

Additionally, Vercel's timing precision on Hobby is hourly (+/- 59 minutes). A cron set for `0 6 * * *` (6:00 AM) may fire anywhere between 6:00 AM and 6:59 AM. If two crons are set 3 minutes apart (as in the current config: `0 6`, `3 6`, `6 6`, `9 6`, `12 6`), they may all fire simultaneously, causing concurrent function invocations that overwhelm rate limiters and database connections.

**Why it happens:**
Vercel Hobby is designed for side projects and personal use, not production SaaS with complex scheduling needs.

**How to avoid:**
- Accept the daily-only constraint and design the scraping pipeline to be efficient within a single daily run per industry.
- Use the fan-out pattern: one daily cron triggers an orchestrator function that sequentially (or with controlled concurrency) invokes individual scraping batch functions via HTTP.
- If sub-daily scraping becomes necessary, upgrade to Vercel Pro ($20/month) for per-minute cron precision.
- Alternatively, use an external cron service (cron-job.org, EasyCron, or GitHub Actions scheduled workflows) to call your API routes on any schedule, bypassing Vercel's cron limitations entirely.
- The 11 cron entries in vercel.json should be consolidated -- on Hobby, spacing them 3 minutes apart is meaningless because they may all fire in the same window.

**Warning signs:**
- Deployment failures mentioning "cron expression would run more than once per day"
- Multiple pipeline runs starting within the same minute (visible in pipeline_runs table)
- Rate limiter errors from concurrent Socrata or SAM.gov requests

**Phase to address:** Phase 1 -- acknowledge and design around this constraint from the start.

---

### Pitfall 8: Legal Risk of Scraping Beyond Public APIs

**What goes wrong:**
The current adapters include `GoogleDorkingAdapter` (search engine scraping) and RSS-based news adapters. Scaling nationwide will likely involve scraping municipality websites that don't have Socrata/API endpoints, scraping ArcGIS map services, or crawling permit board HTML pages. This crosses from "using public APIs" to "web scraping" territory, which carries legal risk.

**Why it happens:**
While the 2022 Ninth Circuit ruling in hiQ v. LinkedIn established that scraping publicly accessible data likely does not violate the CFAA, terms-of-service violations can still be enforced as breach of contract (see Meta v. Bright Data, 2024). Google's ToS explicitly prohibit automated access. News sites have copyright on their content. Some permit portals have ToS restricting automated data collection.

**How to avoid:**
- Prioritize official APIs (Socrata, ArcGIS REST endpoints, SAM.gov API) over HTML scraping. These are designed for programmatic access and typically have permissive terms.
- Respect robots.txt on all scraped sites. The current codebase references this in constraints (PROJECT.md line 79) but it must be enforced in code.
- Remove or rethink `GoogleDorkingAdapter` -- Google's ToS prohibit automated queries. The legal risk is disproportionate to the value.
- For news sources, use official RSS feeds (which are explicitly published for consumption) rather than HTML scraping.
- Keep a registry of data source ToS and review annually. Document the legal basis for accessing each source.
- Never store copyrighted content verbatim -- extract structured data (title, date, location) and link to the source.

**Warning signs:**
- Cease-and-desist letters from data providers
- IP blocks or CAPTCHAs from scraped sites
- Google blocking the server's IP address

**Phase to address:** Phase 1 -- audit all adapters before scaling, remove legally risky ones.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding per-city adapter classes | Quick to add Austin, Dallas, Atlanta | Unmaintainable at 200+ cities, every schema change requires code deployment | Never for v4.0 -- must use dynamic config |
| Two scoring systems coexisting | Old system still works for some views | Inconsistent scores shown to users, double maintenance burden, confusion about which is "correct" | Never -- consolidate immediately |
| Fetching ALL leads in `getFilteredLeadsWithCount` (no SQL LIMIT) | Accurate pagination count | O(n) memory and compute per page load, compute hour exhaustion at scale | Only when total lead count is < 5,000 |
| Using Google Maps for all geocoding | High accuracy, simple code | Cost explosion at nationwide scale | Only for fallback after free tier geocoding fails |
| Daily `GEOCODE_THROTTLE_MS = 25` with no cache | Simple implementation | Same address geocoded repeatedly, wasting API calls and money | Never at scale -- implement cache first |
| Storing all lead fields as text (no normalization) | Flexible schema, quick iteration | Storage bloat on Neon free tier, slow full-text queries | Acceptable for MVP, must normalize by v4.0 |
| `FETCH_MULTIPLIER = 4` in feed queries | Ensures good results after filtering | 4x the data fetched, processed, and discarded -- wasteful at scale | Acceptable until lead volume > 10,000 per radius |

---

## Integration Gotchas

Common mistakes when connecting to external services in this specific project.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Socrata API (SODA3) | Assuming all cities support SODA3 POST queries | Always implement SODA2 GET fallback (already done, but verify for new cities). Some older Socrata deployments only support SODA2. |
| Socrata API (rate limits) | Using 1000 req/hr as a hard limit across all cities | The 1000 req/hr limit is per app token, not per city. If hitting 50 cities with one token, you have 1000 total, not 50,000. Budget 20 req/city/run. |
| Socrata API (app token) | Not registering an app token, relying on unauthenticated access | Unauthenticated Socrata requests are throttled at a much lower rate (IP-based). SODA3 requires authentication. Always use an app token. |
| SAM.gov API | Assuming 10 requests/second rate limit | SAM.gov public tier is actually 10 requests/DAY for unregistered, 1000/day for registered entities. The current code treats it as 10/min. Verify your tier. |
| Google Maps Geocoding | Not setting a billing budget cap | Always set a budget cap in Google Cloud Console. $50/month cap prevents surprise bills. A runaway loop could cost hundreds in minutes. |
| Google Maps Geocoding | Geocoding addresses with city-level precision | Some addresses from Socrata are just city names or partial addresses. Google charges the same for imprecise geocoding. Skip obviously city-level-only addresses. |
| Neon PostgreSQL | Opening new connections per function invocation | Use the `@neondatabase/serverless` driver with connection pooling. Each cold start creates a new connection; without pooling, you'll hit the 1,024 file descriptor limit quickly. |
| Neon PostgreSQL | Running large transactions during scraping | Bulk inserts in a single transaction lock the database and consume CU-hours. Insert in batches of 100, not 1,000. |
| Vercel Cron | Setting `maxDuration` above 300s on Hobby plan | Vercel silently caps at 300s for Hobby. The `maxDuration = 300` in the current code is already at the maximum. Setting it higher does nothing. |
| RSS feeds (news) | Assuming RSS feeds are always available and structured | Some news sites change RSS URLs, remove feeds, or add paywalls. Always handle 404/403 gracefully and log missing feeds. |

---

## Performance Traps

Patterns that work at 3-city scale but fail at nationwide scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `getFilteredLeadsWithCount` fetches all leads within radius (no SQL LIMIT) | Dashboard takes 5-10+ seconds to load, Neon CU-hours spike | Add SQL-level LIMIT or use cursor-based pagination (the `getFilteredLeadsCursor` function exists but may not be used everywhere) | > 10,000 leads within any user's service radius |
| Sequential adapter execution in `runPipeline()` | Function timeouts at 300s, incomplete scraping runs | Fan-out to parallel function invocations, batch adapters | > 15 adapters per industry per scrape run |
| Haversine computed in SQL for every query | CPU-intensive math on every row, O(n) per page load | Pre-compute and store distance per org/lead pair, or use PostGIS spatial index (the `location` column exists but isn't used for queries) | > 50,000 leads in database |
| In-memory scoring of all results before pagination | Memory usage scales linearly with lead count | Push scoring into SQL (materialized scores) or compute only for the page being viewed | > 20,000 leads per query result set |
| No query result caching | Every page load triggers full query + score computation | Add short-TTL cache (5 min) at the API route level, invalidate on new scrape | > 50 concurrent users |
| Content hash computed per-record in pipeline | Blocking computation during bulk insert loop | Pre-compute hashes in batch before insert loop | > 5,000 records per pipeline run |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys (Socrata app token, Google Maps key, SAM.gov key) in client-accessible code | Keys leaked via browser network tab, used by competitors or malicious actors | Keep all API keys server-side only. The current geocoding.ts correctly uses server-side only, but verify all new adapters follow the same pattern. |
| CRON_SECRET exposed or weak | Anyone can trigger scraping pipelines, causing DoS against data sources and exhausting rate limits | Use a strong, random CRON_SECRET (32+ chars). The current auth check in the cron route is correct but verify it's applied to all new cron endpoints. |
| Scraping personally identifiable information (PII) | GDPR/CCPA liability if storing names, phone numbers, or emails from permit data | Strip PII at ingest time. Permits may contain applicant phone numbers or email addresses -- exclude these fields from storage. Store only applicant/contractor names (public record). |
| SQL injection via Socrata field names | If field names from Socrata metadata are interpolated into SQL queries without sanitization, injection is possible | Always use parameterized queries (Drizzle ORM handles this, but raw SQL in queries.ts uses template literals -- verify all interpolations are safe). |

---

## UX Pitfalls

Common user experience mistakes when scaling a lead generation platform.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing users leads from states they don't operate in | Noise drowns out signal, users lose trust in the feed | Filter by org's service area strictly. The distance filter already exists, but nationwide data means more irrelevant leads slip through fuzzy matching. |
| All leads scoring 30/100 (the current state) | Users cannot prioritize, the scored feed is perceived as random | Fix scoring variance to produce a meaningful distribution (10-90 range). Users need clear "hot leads" (80+) vs "cold leads" (20-). |
| Showing "0 leads found" during scraper ramp-up for new regions | Users in newly covered states see empty dashboards for days | Pre-populate with historical permit data (many Socrata datasets have years of history). Show the most recent 30 days on first load. |
| No indication of data freshness per source | Users don't know if Austin data is from today but Denver data is from last week | Show "last updated" per data source on the dashboard. The `scraper_runs` table already tracks this. |
| Overwhelming users with too many lead types | A roofing contractor doesn't care about utility rate changes | Make lead type filtering prominent. The onboarding already captures preferred lead types (`serviceTypes`), but ensure the feed respects this strictly. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces when scaling.

- [ ] **Dynamic Socrata discovery:** Often missing error handling for cities with retired or moved datasets -- verify datasets still exist before adding to config
- [ ] **Scoring engine fix:** Often missing edge case testing -- verify scores produce different outputs for leads with different characteristics, not just different inputs
- [ ] **Geocoding cache:** Often missing cache invalidation -- addresses can change (new construction), cache should expire after 90 days
- [ ] **Nationwide coverage claim:** Often missing coverage gap detection -- verify which states actually have functioning Socrata portals vs which are "covered" but returning 0 results
- [ ] **Rate limiting:** Often missing cross-function coordination -- p-queue instances are per-cold-start (singletons within one invocation). Two concurrent function invocations get separate queues and double the request rate
- [ ] **Lead deduplication:** Often missing cross-source dedup for nationwide data -- the same permit may appear on both a city and county Socrata portal with different field names
- [ ] **Storage monitoring:** Often missing automated alerts -- Neon doesn't notify you when approaching 0.5 GB limit on free tier
- [ ] **Scraper health check:** Often missing differentiation between "adapter found 0 results (legitimate)" and "adapter is broken/blocked (needs attention)"

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Function timeout on scraping | LOW | Immediately split the failing cron into smaller batches. No data loss -- partial results from completed adapters are already stored. |
| Scoring all identical | MEDIUM | Requires scoring algorithm refactoring + data enrichment backfill. Can be done incrementally -- fix one dimension at a time, deploy, measure variance. |
| Geocoding cost explosion | LOW | Set Google Cloud budget cap immediately. Switch to Nominatim for bulk processing. Backfill geocoding cache from existing lead coordinates. |
| Neon storage exhausted | MEDIUM | Run aggressive expiration immediately (delete leads > 30 days old with no user interaction). Vacuum database. If unrecoverable, upgrade to paid tier ($19/month). |
| Neon compute hours exhausted | HIGH | Database becomes unavailable until next billing cycle. Immediate fix: upgrade to paid tier. Preventive: add query-level caching and SQL LIMIT before this happens. |
| Socrata schema change breaks adapter | LOW | Pipeline has error isolation (adapter failures don't crash the pipeline). Fix the field mapping in config and re-run. |
| Legal cease-and-desist | HIGH | Immediately disable the flagged adapter. Review all adapters against source ToS. Consult legal counsel. May need to remove data already scraped from that source. |
| Rate limit ban from data source | MEDIUM | IP may be blocked. Wait for cooldown period. Reduce request rate. Register for app tokens if not already done. May need to switch to a different IP via Vercel region change. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Function timeout at scale | Phase 1: Scraper Architecture | Pipeline completes with 50+ adapters without 504 errors |
| Identical scoring (30/100 problem) | Phase 2: Scoring Engine Fix | Score histogram shows standard deviation > 15 across a sample of 1,000 leads |
| Geocoding cost explosion | Phase 1: Scraper Architecture | Geocoding cache hit rate > 80% after second pipeline run on same cities |
| Neon storage exhaustion (0.5 GB) | Phase 1: Infrastructure | Storage monitor dashboard shows usage with 30-day projection. Expiration policy deletes leads > 45 days |
| Neon compute hour exhaustion | Phase 3: Performance | CU-hour burn rate stays below 3 CU-hours/day (90/month, 10% headroom) |
| Socrata schema inconsistency | Phase 1: Scraper Architecture | Dynamic schema mapping handles 90% of top-50 city datasets without per-city adapter code |
| Daily-only cron limitation | Phase 1: Scraper Architecture | All scraping completes within daily window. Fan-out pattern tested with 50+ cities |
| Legal scraping risks | Phase 1: Scraper Architecture | All adapters audited, Google dorking removed or replaced, ToS registry created |
| Two scoring systems coexisting | Phase 2: Scoring Engine Fix | Only one scoring system exists in codebase. Old `leads/scoring.ts` removed or deprecated |
| Dashboard query performance at scale | Phase 3: Performance | Dashboard loads in < 2 seconds with 50,000+ leads in database |
| Cross-function rate limiter coordination | Phase 1: Scraper Architecture | Rate limiting works correctly even when multiple function invocations run concurrently |

---

## Sources

- [Vercel Hobby Plan Limits](https://vercel.com/docs/plans/hobby) -- official docs, confirmed 300s max function duration, daily-only cron
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) -- official docs, confirmed 300s max with Fluid Compute on Hobby, 2 GB memory
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- official docs, confirmed 100 crons/project, daily minimum interval for Hobby
- [Neon Free Plan](https://neon.com/docs/introduction/plans) -- official docs, confirmed 100 CU-hours/month, 0.5 GB storage, 5-min idle timeout
- [Neon Connection Latency](https://neon.com/docs/connect/connection-latency) -- official docs, cold start 500ms-few seconds
- [Socrata App Tokens](https://dev.socrata.com/docs/app-tokens.html) -- official docs, confirmed 1000 req/hr with app token
- [Google Maps Geocoding Pricing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing) -- official docs, confirmed 10K free/month, $5/1K after
- [SAM.gov Opportunities API](https://open.gsa.gov/api/get-opportunities-public-api/) -- official docs, rate limits by account tier
- [SAM.gov API Rate Limits Reality](https://govconapi.com/sam-gov-rate-limits-reality) -- third-party analysis of actual rate limits (10/day public, 1000/day registered)
- [hiQ v. LinkedIn (Ninth Circuit, 2022)](https://www.eff.org/deeplinks/2022/04/scraping-public-websites-still-isnt-crime-court-appeals-declares) -- CFAA does not apply to public data
- [Web Scraping Legal Analysis 2025](https://mccarthylg.com/is-web-scraping-legal-a-2025-breakdown-of-what-you-need-to-know/) -- ToS violations remain enforceable as breach of contract
- Codebase analysis: `src/lib/scraper/pipeline.ts`, `src/lib/scoring/engine.ts`, `src/lib/leads/queries.ts`, `src/lib/geocoding.ts`, `vercel.json`

---
*Pitfalls research for: GroundPulse v4.0 Nationwide Scaling*
*Researched: 2026-03-19*
