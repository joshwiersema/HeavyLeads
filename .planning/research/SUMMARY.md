# Project Research Summary

**Project:** GroundPulse v4.0 Nationwide Expansion
**Domain:** B2B SaaS construction lead intelligence — scaling from 3-city scraping to all 50 states
**Researched:** 2026-03-19
**Confidence:** HIGH (all four research files rated HIGH; Socrata Discovery API verified live, scoring engine code audited, Vercel/Neon limits confirmed against official docs)

## Executive Summary

GroundPulse v4.0 is a scale expansion of an existing, functioning construction lead platform — not a greenfield build. The core data pipeline (Socrata permit adapters, scoring engine, enrichment, dedup, cron orchestration) is already in production at 3-city scale. The v4.0 challenge is scaling three structurally broken components: (1) a hardcoded 3-city adapter system that requires a new TypeScript file per city and cannot grow without code deployments, (2) a scoring engine that gives virtually every lead the same score (~30-35/100) because most leads have null `estimatedValue`, all-5-industry enrichment tags, and no deadline, and (3) a sequential cron pipeline that will timeout when adapter count crosses ~15 per run.

The recommended approach centers on dynamic portal discovery. The Socrata Catalog API (verified live, returning 486 permit datasets) and ArcGIS Hub Search API allow the platform to find and configure new city data sources at runtime, storing configs in a `data_portals` database table rather than TypeScript files. This single architectural shift unlocks 200-400 Socrata portals and 100-300 ArcGIS portals without ongoing code changes per city. Alongside this, the scoring fix is a pure TypeScript change requiring zero new packages — it replaces the flat "low-confidence = +5 points" enrichment fallback with keyword-to-project-type matching, and adds value estimation heuristics for leads with null `estimatedValue`. Only one net-new npm package is required for all of v4.0: `cheerio@^1.2.0`.

The three highest-risk items are infrastructure constraints that must be resolved in Phase 1 before adding any new data volume: Vercel Hobby's 300-second function timeout (requires a fan-out batch cron pattern), Google Maps Geocoding costs at $5/1,000 after 10K free per month (requires a geocoding cache table and Nominatim fallback), and Neon's 0.5 GB free storage ceiling (requires aggressive 45-day lead expiration). All three have clear mitigations. None require paid tier upgrades if addressed proactively.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, React 19, Drizzle ORM, Neon PostgreSQL, Better Auth, Stripe, Tailwind CSS 4, shadcn/ui, Resend, Crawlee, RSS Parser, p-queue v9.1.0) needs only one new production dependency.

**New dependency:**
- `cheerio@^1.2.0`: Static HTML parsing for non-API sources. 40x faster than jsdom. Built-in TypeScript types. No `@types/cheerio` needed. Dual ESM/CJS.

**New free API integrations (no packages, plain `fetch`):**
- Socrata Discovery API (`api.us.socrata.com/api/catalog/v1`): Dynamic permit and violation dataset discovery. No auth required for discovery. 486 datasets verified live.
- ArcGIS Hub Search API (`hub.arcgis.com/api/v3/datasets`): Discovery for non-Socrata municipalities. GeoJSON includes coordinates, eliminating geocoding for those sources.
- USAspending API (`api.usaspending.gov/api/v2/`): Federal awarded construction contracts. No auth required.
- Nominatim (`nominatim.openstreetmap.org/search`): Free geocoding overflow beyond Google's 10K/month. Rate: 1 req/sec.

**New environment variables:**
- `SOCRATA_APP_TOKEN` (free registration at dev.socrata.com — enables higher rate limits)
- `DOL_API_KEY` (free registration at dataportal.dol.gov — required for OSHA inspection data)
- `NOMINATIM_USER_AGENT` (required by Nominatim ToS — set to `GroundPulse/1.0 (contact@email)`)

**New database table:** `data_portals` — caches discovered Socrata and ArcGIS dataset configs with JSONB field mappings. One row per portal replaces one TypeScript file per city.

**Critical version note:** NREL API domain migrating from `developer.nrel.gov` to `developer.nlr.gov` by April 2026. Update before cutover or EV/solar adapter breaks.

### Expected Features

**Must have (table stakes — missing these leaves obvious geographic and lead-type gaps):**
- Dynamic Socrata permit discovery (currently 3 cities; Shovels covers 2,000+ jurisdictions)
- Dynamic ArcGIS Hub permit discovery (currently only Atlanta; adds Denver, Phoenix, Charlotte, Portland, 100+ more)
- Nationwide code violation discovery via same Socrata Discovery API (same mechanism, different search terms)
- USAspending.gov awarded federal contracts (complements existing SAM.gov bid opportunities with confirmed awards)
- Scoring engine that produces differentiated scores (current flat 30/100 is the core product failure)
- Geocoding cache preventing re-geocoding same addresses on consecutive daily runs
- 45-day lead expiration policy keeping Neon storage within free tier bounds

**Should have (competitive differentiation — no competitor aggregates all of these freely):**
- OSHA construction inspection data (~90,000 inspections/year; signals active worksites and remediation needs)
- EPA Brownfields/ACRES dataset (450,000 sites, free GeoJSON, growing solar-on-brownfield trend)
- Grants.gov federal construction grants (no API key; structured JSON; billions in annual funding)
- EPA ECHO facility compliance data (800K regulated facilities; remediation work signals)
- FERC energy infrastructure filings (pipeline, power plant, transmission construction; RSS + data portal)
- FCC antenna structure registrations (telecom tower construction; fully public bulk download)
- HUD county-level permit trend data (market intelligence signal for lead scoring, not individual leads)

**Defer to v5+ (high complexity, low free API coverage, or explicitly out of scope):**
- State DOT bid lettings (50 different systems; Bid Express scrapers; HIGH complexity)
- Planning board agenda mining (PDF-heavy, per-city setup; 3-12 month pre-permit signal but no structured API)
- Property transfer records (3,143 county systems; ATTOM costs $500+/month)
- USACE Section 404 wetland permits (PDF-heavy public notices)
- School district bond programs (election result aggregation; no structured API)
- ML/AI permit classification (out of scope per PROJECT.md; fix rule-based engine first)
- DSIRE full incentive API (paid subscription required; existing curated array is sufficient for v4)
- Mechanic's lien filing scraping (3,000+ county recorder systems; extreme complexity for low ROI)
- MLS/real estate listings (broker licensing, RESO compliance, Zillow/Realtor API restrictions)
- Paid permit APIs — ATTOM, Shovels ($500-5,000/month; destroys unit economics for a startup)

### Architecture Approach

The v4.0 architecture inserts a Portal Registry layer between Vercel Cron and the existing `runPipeline()` orchestrator. A weekly `/api/cron/discover` run queries Socrata Discovery and ArcGIS Hub APIs, infers field mappings via heuristic column-name pattern matching (e.g., `{issued_date, issue_date, date_issued, date_filed} -> dateField`), and upserts configs into `data_portals`. The daily scraping cron reads from that table, instantiates `GenericSocrataAdapter` or `GenericArcGISAdapter` from stored configs — no new TypeScript files per city — and runs them in batches of 5-10 per function invocation to stay under the 300-second Vercel timeout. Enrichment is moved upstream into the pipeline so that `valueTier`, `severity`, and `applicableIndustries` are populated at ingest using value-estimation heuristics, not at score time from null inputs.

**Major components:**
1. Portal Registry (`data_portals` table + discovery service) — weekly auto-discovery replaces per-city adapter files
2. Generic Adapters (`GenericSocrataAdapter`, `GenericArcGISAdapter`) — config-driven; no subclass per city; one class handles 300+ portals
3. Batch Pipeline Runner — fan-out pattern wrapping existing `runPipeline()`; 5-10 adapters per function invocation; DB cursor tracks progress
4. Enhanced Enrichment Engine (`enrichment.ts` modified) — value estimates from project type lookup table; severity from source type; tighter industry classification using projectType keywords
5. Fixed Scoring Engine (`src/lib/scoring/` modified) — keyword-to-project-type relevance replacing flat low-confidence fallback; valueTier as value proxy when estimatedValue is null; old `src/lib/leads/scoring.ts` removed entirely (two systems is a maintenance trap)
6. Geocoding Cache (new DB table) — address hash lookup before any Google/Nominatim call; 90-day expiry; Nominatim tier activated after Google 10K/month quota
7. Optimized Feed Query (`queries.ts` modified) — SQL-level LIMIT, PostGIS spatial index on existing `location` column, short-TTL result caching

### Critical Pitfalls

1. **Vercel 300-second function timeout** — with 50+ adapters running sequentially in `runPipeline()`, a single cron invocation will fail with 504. Fan-out to batches of 5-10 adapters per function call is the required fix before adding any new portals. This is a Phase 1 blocker.

2. **Scoring engine flat 30/100 output** — two scoring systems coexist (`src/lib/leads/scoring.ts` and `src/lib/scoring/engine.ts`). Both produce nearly identical scores because most leads have null `estimatedValue` (all-5-industry tag gives flat 5/30 relevance; null value gives flat 10/20 value; all permits get flat 5/10 urgency). The fix requires both better enrichment inputs and algorithm changes. Old scoring system must be deleted. Phase 2 blocker.

3. **Geocoding cost explosion** — Google Maps changed to $5/1,000 after 10K free in March 2025. Without a geocoding cache, the same addresses are re-geocoded daily (the current pipeline has no cache). At 50,000 permits/month, costs reach $200/month just for geocoding. Cache table + Nominatim fallback must be in place before Phase 3 data volumes arrive.

4. **Neon free tier storage exhaustion (0.5 GB)** — at 5,000-10,000 new leads per day nationwide, storage fills in weeks. The pipeline must have a 45-day expiration policy for non-interacted leads and storage monitoring alerts before nationwide scraping begins.

5. **Socrata schema inconsistency across cities** — each city uses different column names for the same concepts (`permit_number` vs `permit_no` vs `PERMIT_NUM`). The generic adapter's heuristic field mapper must handle common variants; datasets that cannot be auto-mapped must be logged as warnings (not silent 0-result returns) so they can be manually reviewed.

## Implications for Roadmap

Based on combined research, the pitfall-to-phase mapping in PITFALLS.md drives a strict dependency ordering across five phases.

### Phase 1: Infrastructure Hardening

**Rationale:** Every subsequent phase adds data volume. Adding volume before infrastructure is hardened accelerates failure on all three constraint vectors (timeout, geocoding cost, storage). This phase must complete before any new data sources are activated.

**Delivers:** Fan-out cron batch pattern (5-10 adapters per invocation); geocoding cache table with Nominatim fallback tier; 45-day lead expiration policy with automated monitoring; legal adapter audit (Google Dorking adapter removed or replaced with RSS feeds); `data_portals` DB table schema deployed as the foundation for Phase 3.

**Addresses features from FEATURES.md:** Geocoding cache (prerequisite), lead expiration policy, `data_portals` schema (prerequisite for all discovery work)

**Avoids pitfalls:** Function timeout (#1), geocoding cost explosion (#3), Neon storage exhaustion (#4), Vercel daily-cron-only constraint (#7), legal scraping risk (#8)

**Research flag:** Standard patterns. Vercel fan-out, DB cursors, geocoding cache tables are well-documented. No additional research needed.

### Phase 2: Scoring Engine Fix

**Rationale:** The scoring engine must be fixed before new data sources are added. Adding 200+ city permit datasets to a broken scoring engine makes the product 200x worse — every new lead joins the existing cluster at ~32 points. Fix scoring while data volume is still small and manageable, so improvements can be validated against a known dataset. This phase is independent of Phase 1's cron architecture — it is pure TypeScript function changes — but should follow Phase 1 so enriched input data is already flowing from improved adapters.

**Delivers:** Score standard deviation > 15 across a 1,000-lead sample; value estimation from project type lookup table for null `estimatedValue` leads; keyword-to-project-type relevance (0-15 range) replacing flat low-confidence fallback (always 5); source-type freshness curves (storm hours, bid days, permit weeks); `src/lib/leads/scoring.ts` removed; scoring unit tests verifying distribution.

**Uses from STACK.md:** Pure TypeScript, no new packages

**Implements architecture component:** Fixed Scoring Engine, Enhanced Enrichment Engine

**Avoids pitfalls:** Identical 30/100 scoring (#2), two scoring systems coexisting (maintenance trap)

**Research flag:** Fully specified in ARCHITECTURE.md with code-level detail. No additional research needed.

### Phase 3: Dynamic Portal Discovery and Nationwide Permit Coverage

**Rationale:** With stable infrastructure and working scoring, the platform can absorb the volume increase from nationwide coverage. The Portal Registry pattern means each new portal is a database row not a code deployment — this is the primary architectural unlock of v4.0.

**Delivers:** Weekly discovery cron querying Socrata Discovery API (200-400 permit portals) and ArcGIS Hub Search API (100-300 additional portals); `GenericSocrataAdapter` and `GenericArcGISAdapter` classes instantiated from `data_portals` rows; heuristic field mapper covering 90%+ of top-50-city datasets; Austin/Dallas/Atlanta migrated from hardcoded adapter files to `data_portals` seed rows (confidence: "verified"); nationwide code violation discovery using the same mechanism.

**Addresses features from FEATURES.md:** Dynamic Socrata permit discovery (#1, table stakes), Dynamic ArcGIS Hub permit discovery (#2, table stakes), Nationwide code violation discovery (#4, table stakes)

**Implements architecture component:** Portal Registry, Generic Adapters, Discovery Service cron (`/api/cron/discover`)

**Avoids pitfalls:** Socrata schema inconsistency (#6), hardcoded city adapter maintenance trap

**Research flag:** May benefit from a focused research pass on Socrata Discovery API pagination edge cases (retired datasets, non-English portals, zero-result domains) and ArcGIS Hub Feature Service authentication edge cases before building the discovery cron.

### Phase 4: Federal and Specialty Data Sources

**Rationale:** After permits and violations are flowing from hundreds of cities, add the federal and specialty sources. These are independent adapters with stable documented APIs — they do not require the dynamic discovery system. They expand the lead type diversity beyond permits and bids.

**Delivers:** USAspending.gov contract awards adapter (new source type `"contract-award"`); OSHA inspection data adapter (new source type `"inspection"`); EPA Brownfields/ACRES adapter; Grants.gov opportunities adapter; FERC energy infrastructure adapter; FCC antenna structure adapter; HUD county permit trend data as a market intelligence scoring signal. New rate limiter queues for each new API added to `api-rate-limiter.ts` using existing p-queue pattern.

**Addresses features from FEATURES.md:** Tier 1 high-value free structured APIs (#3, #6, #7, #8, #9, #10, #11)

**Implements architecture component:** New adapters implementing existing `ScraperAdapter` interface

**Avoids pitfalls:** Neon compute exhaustion (#5) must be monitored as volume increases; cross-source deduplication for leads appearing in both municipal and federal datasets (same project, different field names)

**Research flag:** DOL OSHA API stability is rated MEDIUM confidence — the data portal was recently restructured and redirects. Test the current endpoint before building the adapter; implement bulk CSV fallback as the primary strategy with API as the incremental pull mechanism.

### Phase 5: Feed Performance Optimization

**Rationale:** With 50,000+ leads in the database and multiple sources feeding it, the existing `getFilteredLeadsWithCount` query (no SQL LIMIT, Haversine computed per row for every page load, in-memory scoring of all results before pagination) causes slow dashboards and Neon compute hour exhaustion. This phase must complete before user count meaningfully grows.

**Delivers:** SQL-level LIMIT on all lead queries; PostGIS spatial index activated on the existing `location` column (the column exists but is unused for queries today); distance pre-computed at ingest time for org HQ locations; 5-10 minute API-route-level result caching; automated Neon CU-hour burn rate monitoring; `FETCH_MULTIPLIER = 4` replaced with tighter cursor-based pagination.

**Addresses features from FEATURES.md:** Data freshness indicators per source surfaced in UI (the `scraper_runs` table already tracks `last_scraped_at` — surface it on the dashboard)

**Implements architecture component:** Optimized Feed Query

**Avoids pitfalls:** Neon compute hour exhaustion (#5), Haversine O(n) performance trap at 50K+ leads, in-memory scoring at scale

**Research flag:** Standard SQL optimization and caching patterns. No additional research needed.

### Phase Ordering Rationale

- Phase 1 before all others: infrastructure failures cascade and destroy trust in all data
- Phase 2 before Phase 3: scoring must differentiate leads before 200x volume amplifies the flat-score problem
- Phase 3 before Phase 4: municipal permit/violation coverage is the table stakes core value; federal sources are differentiation
- Phase 5 after Phase 3: query performance only matters when there is enough data to stress it
- Tier 2 sources (State DOT, Planning Board, Property Transfers) deferred to v5: high scraping complexity, low structured API coverage, not worth engineering cost until Tier 1 is proven and generating revenue

### Research Flags

Phases needing deeper research during planning:
- **Phase 3:** Socrata Discovery API edge cases (retired datasets, non-English portals, datasets with schema changes mid-run). ArcGIS Hub Feature Service auth patterns for datasets that appear public but return 403. Recommended: a focused 1-hour research pass before building the discovery cron.
- **Phase 4:** DOL OSHA API current endpoint behavior after portal restructuring. Confirm `data.dol.gov` responds correctly before building the adapter; prioritize bulk CSV fallback.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Fan-out cron batching, geocoding cache, DB expiration — established patterns, implementation fully specified
- **Phase 2:** Pure TypeScript scoring changes — fully specified in ARCHITECTURE.md with code-level detail
- **Phase 5:** SQL query optimization and API-level caching — standard Next.js/PostgreSQL patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Socrata Discovery API verified live (486 datasets returned); all new API endpoints verified against official docs; Google Maps pricing change confirmed post-March 2025; cheerio 1.2.0 version confirmed stable with built-in TypeScript |
| Features | HIGH for Tier 1 (structured APIs); MEDIUM for Tier 2 (scraping-dependent) | Federal API coverage (USAspending, EPA ECHO, FERC, FCC) is well-documented and free. State DOT and planning board coverage depends on per-site scraping reliability which is inherently fragile. |
| Architecture | HIGH | Based on direct codebase audit of `pipeline.ts`, `scoring/engine.ts`, `queries.ts`, `api-rate-limiter.ts`, `enrichment.ts`. All integration points identified. Generic adapter pattern proven by existing `AtlantaPermitsAdapter` which already consumes ArcGIS GeoJSON. |
| Pitfalls | HIGH | Verified against official Vercel, Neon, Google Maps, Socrata, SAM.gov documentation. Legal risk assessment cites actual case law (hiQ v. LinkedIn 2022, Meta v. Bright Data 2024). Scoring failure root-caused to specific lines in the existing codebase. |

**Overall confidence:** HIGH

### Gaps to Address

- **SAM.gov rate limits:** Current code treats SAM.gov as 10 req/min. Third-party analysis suggests actual public tier limits may be 10 req/day (unregistered) or 1,000 req/day (registered entity). Verify current account tier before Phase 4 scraping runs to avoid unexpected blocks.
- **ArcGIS dataset authentication edge cases:** Some ArcGIS Hub datasets appear public but return 403 without a token. The generic ArcGIS adapter must handle this defensively (log warning, mark portal `enabled=false`, continue) — not crash the pipeline.
- **Neon upgrade trigger point:** Research recommends upgrading to Neon Launch ($19/month, 10 GB) at 400 MB storage. Define this as an explicit trigger condition in the roadmap so the decision is made proactively, not under pressure when writes start failing.
- **DOL OSHA API endpoint stability:** The `enforcedata.dol.gov` domain redirects to `data.dol.gov` after a recent restructuring. Test the current endpoint before building the adapter and plan bulk CSV as the primary approach.
- **Cross-source lead deduplication at scale:** The current content-hash dedup prevents exact duplicates within a source run. It does not catch the same permit appearing on both a city and county Socrata portal with slightly different field values and different column names. A fuzzy-match dedup pass (address + date + approximate value) is needed before nationwide volume makes duplicate leads visible to users.

## Sources

### Primary (HIGH confidence)
- Socrata Discovery API (`api.us.socrata.com/api/catalog/v1`) — verified live, 486 permit datasets returned, response schema documented
- Socrata Developer Docs (`dev.socrata.com/docs/other/discovery`) — Discovery API specification
- Socrata Discovery Apiary Docs (`socratadiscovery.docs.apiary.io`) — API parameter reference
- ArcGIS Hub Search API (`hub.arcgis.com/api/search/definition/`) — dataset search endpoint
- USAspending API Docs (`api.usaspending.gov/docs/endpoints`) — no auth required, NAICS filtering confirmed
- USAspending GitHub (`github.com/fedspendingtransparency/usaspending-api`) — open source API contracts
- Google Maps Geocoding Pricing — 10K free/month post-March 2025 confirmed
- Vercel Hobby Plan Limits (`vercel.com/docs/plans/hobby`) — 300s max, daily-only cron confirmed
- Vercel Functions Limitations (`vercel.com/docs/functions/limitations`) — 300s Fluid Compute on Hobby, 2 GB memory
- Neon Free Plan (`neon.com/docs/introduction/plans`) — 100 CU-hours/month, 0.5 GB storage, 5-min idle timeout
- cheerio 1.2.0 (`cheerio.js.org`) — built-in TypeScript, dual ESM/CJS, no `@types/` needed
- Nominatim (`nominatim.org`) — 1 req/sec public API, standard free geocoding alternative
- Vercel Cron Jobs (`vercel.com/docs/cron-jobs`) — schedule precision, Hobby daily minimum
- HUD Residential Permits ArcGIS Hub — county-level data confirmed available
- hiQ v. LinkedIn (Ninth Circuit, 2022) — CFAA does not apply to public data scraping
- Codebase analysis: `src/lib/scraper/pipeline.ts`, `src/lib/scoring/engine.ts`, `src/lib/leads/queries.ts`, `src/lib/leads/scoring.ts`, `src/lib/scraper/enrichment.ts`, `src/lib/geocoding.ts`, `vercel.json`

### Secondary (MEDIUM confidence)
- DOL OSHA Enforcement API (`developer.dol.gov/health-and-safety/dol-osha-enforcement/`) — API exists but portal recently restructured; bulk CSV is reliable fallback
- DOL API User Guide — auth and filter syntax
- SAM.gov rate limits (third-party analysis at govconapi.com) — actual limits may differ from documented; verify account tier
- Web Scraping Legal Analysis 2025 (`mccarthylg.com`) — ToS violations enforceable as breach of contract

### Tertiary (LOW confidence)
- State DOT bid letting systems — each state has a different portal; no unified API; deferred to v5
- Planning board agenda scraping — PDF-heavy, no standard format; deferred to v5
- Property transfer records — county-by-county, no unified free API; ATTOM $500+/month; deferred to v5

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
