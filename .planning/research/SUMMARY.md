# Project Research Summary

**Project:** LeadForge v3.0 Multi-Industry Expansion
**Domain:** Multi-tenant B2B SaaS lead generation — heavy equipment, HVAC, roofing, solar, electrical verticals
**Researched:** 2026-03-16
**Confidence:** HIGH (verified against 40+ source files, official API docs, Drizzle/Vercel/Neon docs)

## Executive Summary

LeadForge v3.0 is an expansion of a live production SaaS platform from a single heavy-equipment vertical to five blue-collar contractor verticals. The existing stack (Next.js 16.1.6, Drizzle ORM, Neon PostgreSQL, Better Auth, Stripe, Crawlee, Resend) is sound and unchanged. All new capabilities layer on top of this foundation: three new npm packages (`p-queue`, `papaparse`, `@types/papaparse`), three new free government APIs (NWS Alerts, FEMA OpenFEMA, EIA electricity), two new env vars (`EIA_API_KEY`, `NREL_API_KEY`), one existing unconfigured var that now must be set (`SAM_GOV_API_KEY`), and a PostGIS database extension. The central challenge is not technology — it is schema evolution on a live system and ensuring existing heavy-equipment users are never disrupted during the expansion.

The recommended build order is strict: schema foundation first, then onboarding redesign, then scoring engine, then new data-source adapters, then intelligence and alerting features. This order is dictated by a hard dependency chain: scoring requires industry profile data, industry profile data requires schema expansion, and all new vertical features require scoring to work. Shortcuts in this order — for example, adding storm alert adapters before the schema is ready — produce either silent failures or broken feeds for existing users. The expand-then-contract migration discipline must be enforced from day one: every schema change must be additive with defaults and backfills before any code ships.

The primary risks are: (1) Drizzle silently dropping instead of renaming the `company_profiles` table during migration, destroying existing user profile data; (2) existing heavy-equipment users seeing 0 leads if industry-aware queries ship before the `heavy_equipment` backfill runs; (3) the cron architecture hitting Vercel Hobby plan limits when scaling from 1 to 10 scheduled jobs; and (4) in-memory scoring collapsing at 50K+ leads if the scoring rewrite is attempted simultaneously with the industry expansion instead of as a dedicated later phase. All four risks have clear mitigations documented in PITFALLS.md and are achievable without production downtime.

---

## Key Findings

### Recommended Stack

The existing stack handles all new capabilities without major additions. Only three new npm dependencies are needed: `p-queue` (rate-limiting 7+ external API queues), `papaparse` (streaming NOAA gzipped CSV parsing), and `@types/papaparse`. PostGIS is a Postgres extension enabled via a single SQL statement — no npm package. Drizzle's built-in `geometry()` column type handles all serialization natively since v0.31. All government APIs use plain `fetch()` following the existing adapter pattern already established by `SamGovBidsAdapter` and `AustinPermitsAdapter`.

**Core new technologies:**
- `p-queue@^8.1.0`: Per-API sliding-window rate limiting with concurrency control — eliminates the need for custom rate-limiting logic across 7 external APIs; ESM-only, compatible with Next.js App Router
- `papaparse@^5.5.2`: Streaming CSV parsing for NOAA Storm Events bulk data (50MB+ gzipped files); Node.js built-in `zlib.createGunzip()` handles decompression
- PostGIS extension on Neon: Enables `ST_DWithin()` spatial radius queries with GiST indexes — dramatically faster than Haversine at multi-industry lead volumes; Drizzle `geometry()` type handles serialization
- NWS Alerts API (`api.weather.gov/alerts/active`): Free, no API key, real-time storm alerts by state/severity — the upstream source HailTrace itself consumes
- FEMA OpenFEMA API (`fema.gov/api/open/v2/DisasterDeclarationsSummaries`): Free, OData query syntax, disaster declarations triggering demand signals for roofing/HVAC/electrical
- EIA API v2 (`api.eia.gov/v2/electricity/retail-sales/data`): Monthly utility rate data for solar ROI context — NREL Utility Rates v3 is deprecated (2012 data only, do not use)
- Node.js built-in `crypto`: SHA-256 content hashing for fast dedup pre-filter — no new dependency

**Critical version and configuration notes:**
- NREL AFDC API domain migrates from `developer.nrel.gov` to `developer.nlr.gov` by April 30, 2026 — use new domain from the start
- Socrata SODA3 (released late 2025) requires an app token; existing Austin adapter uses legacy `/resource/` endpoint and must be updated
- SAM.gov API accepts only one `ncode` per request; multi-NAICS queries require sequential calls — the existing adapter already loops, just needs broader NAICS list
- DSIRE API is a paid subscription with opaque pricing — use manual curation of top 15 state solar incentive programs as the MVP alternative; covers 80% of value at 10% of cost
- PostGIS extension must be created manually with `CREATE EXTENSION IF NOT EXISTS postgis;` — Drizzle migration generator does not include this automatically

**New env vars required:**

| Variable | Source | Free |
|----------|--------|------|
| `EIA_API_KEY` | eia.gov/opendata | Yes |
| `NREL_API_KEY` | developer.nlr.gov | Yes |
| `SOCRATA_APP_TOKEN` | dev.socrata.com | Yes |
| `SAM_GOV_API_KEY` | Already exists, not configured | Yes |

### Expected Features

**Must have (table stakes — v3.0 launch):**
- Industry selection as onboarding Step 0 — gates all other configuration; without it the platform cannot differentiate users across verticals
- Industry-specific onboarding for all 5 verticals — each vertical collects different profile data (HVAC: system types + service categories; roofing: materials + storm restoration flag; solar: residential/commercial focus + certifications; electrical: EV/solar specializations)
- Company profile schema expansion — `industryType` on `organization` table, expanded `organization_profiles` with `specializations`, `serviceTypes`, `certifications`; backfill existing users as `heavy_equipment`
- Industry-aware scoring engine — per-vertical scoring dispatch with appropriate weights (storm urgency 25% for roofing; seasonal relevance 10% for HVAC; incentive value 20% for solar; EV growth signal 10% for electrical)
- Cross-industry lead tagging (`applicableIndustries text[]` on leads) — a commercial permit is relevant to HVAC, electrical, AND roofing simultaneously; each vertical's feed filters by this array
- Industry inference rules — extend existing `inferEquipmentNeeds()` to `inferIndustryRelevance()` mapping project types to applicable industries at enrichment time
- Source type filter in lead feed — permit/bid/news/storm/violation badges on lead cards; `sourceTypeFilter` and `projectCategory` facets in filter panel
- SAM.gov NAICS expansion — HVAC: 238220; roofing: 238160; solar: 221114 + 238220; electrical: 238210
- CRM-lite pipeline status upgrade — add `quoted` and `in_progress` to existing `new/viewed/contacted/won/lost` statuses
- Industry-specific email digest templates — one layout per vertical with relevant content hierarchy and urgency indicators

**Should have (competitive — v3.1, after first non-heavy-equipment subscriber):**
- NWS storm alert system for roofing — cron polls `/alerts/active` every 30 min, matches alert geometry to service areas, fires immediate email + in-app banner; storm leads get 25pt urgency boost; first mover to a storm area captures 50-78% of work
- Code violation scraper adapters — start with 2-3 Socrata cities (Austin, NYC, Boston); violation-to-industry mapping (roof violations → roofing; electrical violations → electrical; HVAC violations → HVAC)
- Urgent notification preferences — per-source-type thresholds (immediate vs. digest); storm leads default to immediate for roofers
- Solar incentive lookup table — manually curate top 15 state programs; show applicable incentives on solar lead detail pages; update quarterly
- Cross-industry lead intelligence annotations — "This commercial build will need HVAC + electrical + roofing" on lead detail pages

**Defer to v3.2+:**
- Energy benchmarking data as HVAC leads — NYC/Boston/Chicago mandatory disclosure APIs; high complexity, limited city coverage, defer until HVAC vertical shows traction
- EV charging infrastructure leads — NEVI program tracking + AFDC API; niche within electrical vertical, validate demand first
- Permit cross-referencing for upsell signals — "Recent roofing permit = solar installer warm lead"; requires permit completion tracking infrastructure
- DSIRE API integration — only if solar vertical grows significantly and quarterly manual curation becomes unmanageable
- ServiceTitan/Housecall Pro CRM integrations — after product-market fit across multiple verticals
- Geographic exclusivity zones — premium tier feature, premature before multi-vertical traction established

### Architecture Approach

The v3.0 architecture extends the existing Next.js App Router + Drizzle + Neon + Better Auth system with additive-only changes. The `company_profiles` table is renamed to `organization_profiles` via safe `ALTER TABLE RENAME` (not drop+recreate). An `industry` column is added to the Better Auth-managed `organization` table. Four new tables are created: `lead_enrichments`, `lead_industries` (junction), `scraper_runs` (per-adapter tracking), and `unsubscribe_tokens`. The cron architecture moves from a single monolithic scraper to per-industry parameterized routes (`/api/cron/scrape/[industry]`), with separate weather, enrichment, digest, dedup-maintenance, and storm-alert crons — requiring Vercel Pro plan for sub-daily scheduling. The scraper registry's mutable global Map is replaced with per-invocation adapter lists passed as function arguments, eliminating both race conditions and test isolation problems.

**Major components:**
1. Schema foundation — `organization.industry` column with `heavy_equipment` backfill; `organization_profiles` rename and expansion; `leads.content_hash`, `leads.applicable_industries`; four new tables; PostGIS extension and `geometry` column alongside existing `lat/lng`
2. Onboarding wizard (useReducer state machine) — replaces `useState(0)` step counter with a proper reducer that derives visible steps from selected industry; persists draft state to `sessionStorage`; existing users with `onboardingCompleted = true` never re-enter the wizard
3. Industry-aware scoring engine — `scoreLeadForIndustry(industry, input)` dispatcher delegating to per-vertical functions with configurable weight profiles including new signals (storm urgency, seasonal relevance, incentive value)
4. Industry-inference engine — extends `inferEquipmentNeeds()` to tag leads with all applicable industries at enrichment time; declarative project-type-to-industry mapping rules
5. Per-industry scraper adapters — factory pattern (`getHVACAdapters()`, `getRoofingAdapters()`, etc.); each adapter declares `industries: string[]`; adapters passed as function arguments to the pipeline, not registered in a global Map
6. Weather/disaster cron jobs — NWS polling at 30-min intervals, FEMA declaration monitoring, storm-alert email dispatch; all via `p-queue` rate limiting
7. PostGIS spatial layer — phased migration: add `geometry(Point, 4326)` column alongside existing `lat/lng` real columns; backfill; migrate queries to `ST_DWithin()`; drop old columns only after all queries are migrated

### Critical Pitfalls

1. **Drizzle migration drops column instead of renaming it** — Enable `strict: true` in `drizzle.config.ts`; review every generated `.sql` file for `DROP COLUMN` before applying; write manual `ALTER TABLE ... RENAME COLUMN` for the `company_profiles → organization_profiles` rename; test on a Neon branch first; never use `drizzle-kit push` against production

2. **Industry-aware queries ship before backfill runs** — All existing leads must default to `heavy_equipment` and all existing `organization` rows must have `industry = 'heavy_equipment'` before any industry-filtering code deploys; run migration and verify, then deploy code; keep lead feeds defaulting to "all industries" when no filter is present

3. **Existing users forced through re-onboarding after profile schema change** — New profile fields must be nullable with defaults; the onboarding guard (`if profile.onboardingCompleted → redirect /dashboard`) stays unchanged; existing profile updates go through settings, not re-onboarding; test by logging in as admin account immediately after deploying new onboarding

4. **Single cron scales to 10 crons, hits Hobby plan limits and race conditions** — Vercel Hobby allows once-per-day only; Pro plan required for 30-minute storm cron; remove mutable global Map from registry and pass adapter lists as arguments; add distributed lock checking `pipeline_runs` for `status = 'running'` within last 15 minutes before starting

5. **Query-time in-memory scoring collapses at 50K+ leads** — Current full-fetch and in-memory sort works below ~10K leads; do NOT rewrite scoring to SQL simultaneously with the industry expansion; keep current approach for initial v3.0 launch, then migrate scoring to SQL as a dedicated later phase

6. **PostGIS extension missing when geometry migrations run** — Execute `CREATE EXTENSION IF NOT EXISTS postgis;` manually on Neon before running any migration that adds `geometry` columns; phase the migration to add `geometry` alongside existing `lat/lng` columns, not replacing them

7. **Government API silent failures at scale** — SAM.gov has a 1,000 req/day hard limit; NOAA has undocumented rate limits that return HTTP 503; configure `p-queue` per-API with conservative `intervalCap` values; add circuit breakers (3 consecutive errors → disable source for 1 hour); use Zod `.passthrough()` for response validation so unexpected new fields do not silently reject all records

---

## Implications for Roadmap

Based on the dependency chain established across all four research files, the following phase structure is recommended:

### Phase 1: Schema Foundation

**Rationale:** Everything downstream depends on the database schema. Industry cannot be scored, displayed, or scraped without `organization.industry`, `applicable_industries` on leads, and the `organization_profiles` expansion. This phase is a pure prerequisite with no user-visible changes — it is safe to deploy independently.
**Delivers:** Backward-compatible schema supporting all v3.0 features; existing users and existing heavy-equipment leads entirely unaffected; `company_profiles` renamed to `organization_profiles` with new columns; PostGIS extension enabled; four new tables created
**Addresses:** Foundation for industry selection, cross-industry tagging, CRM-lite pipeline upgrade (bookmarks table), content-hash dedup pre-filter
**Avoids:** Pitfall 1 (migration drops data — use `strict: true` and manual review), Pitfall 2 (queries break during deploy window — expand-then-contract with defaults), Pitfall 3 (existing leads disappear — backfill `heavy_equipment` in same migration), Pitfall 13 (PostGIS extension not created)
**Research flag:** Standard patterns — Drizzle migration workflow is well-documented; follow expand-then-contract strictly

### Phase 2: Industry Onboarding Redesign

**Rationale:** New users cannot configure multi-industry profiles without this. Existing users must not be disrupted. This phase gives the app the ability to collect industry-specific profile data, which the scoring engine (Phase 3) requires for correct lead ranking.
**Delivers:** 6-step industry-conditional wizard for new users using `useReducer` state machine; all 5 verticals can complete onboarding; existing users land on dashboard unchanged with `onboardingCompleted = true` guard intact; `sessionStorage` draft persistence prevents state loss on refresh
**Addresses:** Industry selection (Step 0), industry-specific onboarding questions per vertical, `profileConfig` population, company profile schema population for all verticals
**Avoids:** Pitfall 4 (existing users forced through re-onboarding — guard stays unchanged, new fields via settings), Pitfall 12 (wizard state loss on browser refresh — sessionStorage persistence required from day one)
**Research flag:** Standard patterns — useReducer wizard with react-hook-form and Zod discriminated unions are well-documented; no research phase needed

### Phase 3: Industry-Aware Scoring and Lead Feed

**Rationale:** Once profile data is being collected (Phase 2), the scoring engine can use it. This phase makes the feed industry-relevant for all 5 verticals. Without this, new HVAC/roofing/solar/electrical users would see heavy-equipment-scored leads regardless of their profile configuration.
**Delivers:** `scoreLeadForIndustry()` dispatch; `inferIndustryRelevance()` engine; `applicable_industries` tagging during enrichment pipeline; source type filter panel; cross-industry lead tagging in feed; SAM.gov NAICS expansion for all 5 verticals
**Addresses:** Industry-aware lead scoring, filter panel with source type and project category facets, cross-industry lead tagging, SAM.gov multi-NAICS expansion
**Avoids:** Pitfall 7 (scoring performance collapse — keep in-memory approach for now; do not attempt SQL scoring rewrite simultaneously with industry expansion)
**Research flag:** Standard patterns — scoring dispatch and weight configs are pure TypeScript architecture; well-understood

### Phase 4: Cron Architecture and Scraper Expansion

**Rationale:** The scraper registry must be refactored before adding per-industry adapters. Running 5-industry scraping through the current mutable global Map with a single cron route creates race conditions and makes testing impossible. This phase restructures the cron architecture, then adds new data sources per vertical.
**Delivers:** Per-industry parameterized cron routes (`/api/cron/scrape/[industry]`), immutable adapter factory pattern, `scraper_runs` per-adapter tracking, `p-queue` rate limiting for all external APIs, Socrata adapter factory for multi-city permit coverage, SODA3 migration for existing Austin adapter
**Addresses:** SAM.gov expansion (configuration change only), city permits generalization via Socrata factory, per-API rate limiting, distributed lock pattern for cron safety
**Avoids:** Pitfall 6 (Vercel plan limits — requires Pro plan, non-overlapping or isolated cron schedules), Pitfall 9 (government API silent failures — `p-queue` + circuit breakers), Pitfall 10 (mutable registry tight coupling — factory pattern replaces global Map)
**Research flag:** Needs `/gsd:research-phase` — Vercel Pro plan concurrent cron behavior needs verification; SODA3 migration for existing Austin adapter requires testing against the live endpoint; SAM.gov daily quota allocation across 5 industries needs calculation

### Phase 5: Storm Alert and Notification System

**Rationale:** High-value differentiator for the roofing vertical, but depends on roofing onboarding profile (Phase 2) and the cron architecture (Phase 4). Storm alert cron must be separate and lightweight — 30-minute polling interval, no heavy scraping bundled in.
**Delivers:** NWS storm alert polling cron (`/api/cron/storm-alerts` at `*/30 * * * *`), storm-sourced leads with 25pt urgency scoring boost, in-app storm banner for roofers, immediate email alert, `StormAlertEmail` React Email template; FEMA disaster declaration monitoring as a secondary signal
**Addresses:** Storm event alerting differentiator, urgent notification preferences, FEMA-based demand signals for roofing/HVAC/electrical
**Avoids:** Pitfall 6 (separate lightweight storm cron vs. bundling into scrape cron), Pitfall 9 (NWS rate limiting with conservative `p-queue` config — ~30 req/min)
**Research flag:** NWS API patterns are standard and well-documented; in-app banner delivery approach (polling vs. SSE vs. toast on next page load) may benefit from a brief research spike

### Phase 6: Intelligence, Digests, and Polish

**Rationale:** Polish and intelligence features that sit on top of the core multi-industry platform. These improve value density but have no hard blockers beyond the previous phases being stable.
**Delivers:** Cross-industry lead intelligence annotations on lead detail pages; industry-specific email digest templates (one layout per vertical); solar incentive lookup table (manually curated top 15 state programs); code violation scraper adapters for 2-3 Socrata cities; NOAA historical Storm Events enrichment via papaparse; CRM-lite pipeline status UI (2 new kanban columns)
**Addresses:** Industry-specific digests, cross-industry intelligence differentiator, solar incentive tracking, code violation leads differentiator
**Avoids:** Pitfall 11 (hash dedup conflicts with proximity dedup — keep content hash as supplementary fast-path pre-filter only, not a replacement for geographic+text similarity dedup)
**Research flag:** Code violation Socrata dataset IDs vary by city and must be verified at implementation time using the Socrata discovery endpoint; allow time for per-city adapter discovery and field mapping

### Phase Ordering Rationale

- Schema precedes onboarding because the `completeOnboarding` server action writes to the new schema; deploying the wizard before the tables exist causes 500 errors
- Onboarding precedes scoring because scoring dispatches on `organization.industry` from the profile; without profile data the dispatch always falls back to heavy equipment scoring
- Scoring precedes scraper expansion because new adapters produce industry-tagged leads that need to be scored and filtered correctly on first scrape
- Cron refactor precedes adding new adapters because the mutable global Map creates race conditions and test isolation problems; new adapters should only be added to the clean factory pattern
- Storm alerts follow cron refactor because the storm cron requires the same parameterized, isolated architecture established in Phase 4
- Intelligence and polish have no hard blockers and can stretch across phases 4-5 opportunistically as time allows

### Research Flags

Needs `/gsd:research-phase` during planning:
- **Phase 4:** Vercel Pro plan concurrent cron execution behavior (10 crons at the same time), SODA3 migration impact on the existing Austin adapter, SAM.gov daily quota allocation across 5 industries with conservative call budgeting
- **Phase 5:** Real-time in-app storm notification delivery (Server-Sent Events vs. polling vs. toast on next page load) — brief spike recommended before implementation

Standard patterns — skip research phase:
- **Phase 1:** Drizzle expand-then-contract migrations are fully documented with official examples
- **Phase 2:** useReducer wizard, react-hook-form with Zod discriminated unions are established patterns
- **Phase 3:** Scoring dispatch with configurable weights is pure TypeScript architecture, no external dependencies
- **Phase 6:** React Email templates follow the existing `DailyDigestEmail` pattern already in the codebase

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new dependencies verified against official docs; existing stack validated against 40+ source files; only 3 new packages needed; all government APIs accessed via existing `fetch()` adapter pattern |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-researched from domain analysis; specific code violation API availability varies by city and needs per-city verification at implementation time; DSIRE API pricing cannot be assessed without contacting the vendor |
| Architecture | HIGH | Based on direct code analysis of 40+ existing source files; integration points, data flows, migration strategies, and file-level change inventory are specific and verified |
| Pitfalls | HIGH | 13 pitfalls identified, most verified against specific line numbers in the existing codebase; prior production incidents (500 from env.ts in db/index.ts, Stripe double-nesting, geocoding returning 0,0) confirm these risk categories are real for this project |

**Overall confidence:** HIGH

### Gaps to Address

- **DSIRE API pricing:** Cannot be assessed until contacting DSIRE-Admin@ncsu.edu. Manual curation is the confirmed MVP approach; revisit if solar vertical gains significant traction and quarterly updates become a burden.
- **Code violation Socrata dataset IDs:** Must be verified per city before adapter implementation. Discovery endpoint: `api.us.socrata.com/api/catalog/v1?q=code+violations`. NYC, Austin, and Boston are the highest-confidence starting cities.
- **Neon HTTP driver PostGIS compatibility:** Must run a test `ST_Distance()` query against the actual Neon project before committing to the PostGIS migration. If the HTTP driver has limitations with binary PostGIS types, the WebSocket driver may be needed, which requires auth configuration changes.
- **Vercel Pro plan concurrent cron behavior:** Plan limits are confirmed (100 crons, per-minute scheduling), but the actual concurrent execution behavior when 5 industry crons all fire at 6 AM simultaneously needs a test deploy verification before relying on it.
- **Federal solar ITC expiration (Dec 31, 2025):** The residential 30% ITC expired. Solar lead value now depends on state-level incentives. The manual incentive lookup table should prioritize states with strong programs (NY 25%, SC 25%, MA 15%, NJ SREC-II, IL Adjustable Block). This context should surface prominently on solar lead detail pages.

---

## Sources

### Primary (HIGH confidence)
- NWS API OpenAPI spec (`api.weather.gov`) — alerts endpoint, parameters, GeoJSON format
- FEMA OpenFEMA API documentation (`fema.gov/about/openfema/api`) — disaster declarations query syntax, OData filtering
- EIA API v2 documentation (`eia.gov/opendata/documentation.php`) — electricity retail sales endpoint
- NREL AFDC API documentation (`developer.nlr.gov`) — EV station data, April 2026 domain migration
- Neon PostGIS extension docs (`neon.com/docs/extensions/postgis`) — extension setup, compatibility
- Drizzle ORM PostGIS guide (`orm.drizzle.team/docs/guides/postgis-geometry-point`) — geometry column type, insert/query patterns
- Drizzle ORM cursor pagination guide (`orm.drizzle.team/docs/guides/cursor-based-pagination`) — official cursor pattern
- Vercel cron documentation — plan limits, scheduling precision, `maxDuration`
- p-queue GitHub (`github.com/sindresorhus/p-queue`) — rate limiting API, `intervalCap`, ESM compatibility
- Node.js Crypto documentation — built-in SHA-256 hashing
- SAM.gov Get Opportunities API (`open.gsa.gov/api/get-opportunities-public-api/`) — NAICS filtering, single-NAICS-per-request limitation
- Socrata SODA developer docs (`dev.socrata.com`) — SODA3 migration, app token requirement, discovery API
- NYC Open Data code violations (`data.cityofnewyork.us`) — Housing Maintenance Code Violations dataset
- Codebase analysis of 40+ source files — direct inspection of `src/lib/scraper/registry.ts`, `src/lib/leads/queries.ts`, `src/lib/leads/scoring.ts`, `src/lib/db/schema/`, `src/actions/onboarding.ts`, `src/app/api/cron/scrape/route.ts`

### Secondary (MEDIUM confidence)
- Roofing industry storm response data (PredictiveSalesAI, KnockBase) — 50-78% first-mover storm work capture, 22% storm-caused roof replacements in 2024
- Solar incentive 2026 state-by-state analysis (ACDirect, Powerlutions) — ITC expiration context, state program landscape post-federal-credit era
- NEVI program status (AFDC, Qmerit) — $885M FY2026 apportionment, EV charger contractor opportunity scope
- Competitor analysis (Shovels.ai, Construction Monitor, BuildZoom, HailTrace) — feature gap identification; LeadForge's differentiation is integrated scoring across verticals vs. raw data providers
- Code violation lead gen feasibility (Data.gov catalog, NYC Open Data) — dataset availability by city, Socrata coverage

### Tertiary (LOW confidence)
- DSIRE API pricing — contact-for-pricing, cannot be independently verified; manual curation is the de-risked alternative
- HailTrace API pricing — opaque, no public pricing; NWS is the free upstream alternative
- Socrata dataset IDs for cities beyond Austin, NYC, Boston — require per-city verification at implementation time

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
