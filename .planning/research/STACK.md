# Stack Research: GroundPulse v4.0 Nationwide Expansion

**Domain:** B2B SaaS lead generation -- nationwide public data aggregation, scoring engine fix, multi-source pipeline
**Researched:** 2026-03-19
**Confidence:** HIGH (Socrata Discovery API verified live, scoring engine code audited, all key APIs documented)

> This file covers ONLY new additions/changes needed for v4.0. The existing validated stack
> (Next.js 16, React 19, Drizzle ORM, Neon PostgreSQL, Better Auth, Stripe, Tailwind CSS 4,
> shadcn/ui, Resend, Crawlee, RSS Parser, react-leaflet, p-queue ^9.1.0, string-similarity,
> Zod v4) is NOT re-documented here.

---

## 1. Socrata Discovery API (Dynamic Nationwide Dataset Discovery)

**The single most important new capability.** Instead of hardcoding 3 city adapters (Austin, Dallas, Atlanta),
discover permit and violation datasets dynamically across all Socrata-powered government portals nationwide.

### How It Works

The Socrata Catalog API at `https://api.us.socrata.com/api/catalog/v1` returns a searchable
index of every public dataset across all Socrata domains. **Verified live** -- a query for
`?q=building+permits&only=datasets` returns **486 datasets** with full column metadata.

**Response structure per result (verified):**
```
resource.id          -> "ydr8-5enu" (the datasetId for SODA queries)
resource.name        -> "Building Permits"
resource.columns_field_name -> ["permit_number", "issue_date", "address", ...]
resource.columns_datatype   -> ["Text", "Calendar date", "Text", ...]
resource.data_updated_at    -> timestamp
metadata.domain      -> "data.cityofchicago.org"
classification.categories   -> ["Permits & Licenses"]
classification.domain_tags  -> ["building", "permits", "construction"]
```

**Key API parameters:**
| Parameter | Purpose | Example |
|-----------|---------|---------|
| `q=` | Keyword search | `q=building+permits` |
| `domains=` | Limit to specific domain | `domains=data.austintexas.gov` |
| `only=` | Filter asset type | `only=datasets` (exclude charts/maps/stories) |
| `categories=` | Filter by category | `categories=Permits` |
| `tags=` | Filter by tags | `tags=construction` |
| `limit=` / `offset=` | Pagination | `limit=100&offset=0` |

**No authentication required** for discovery. A SOCRATA_APP_TOKEN is only needed for high-volume
SODA data queries (already have this env var optional in codebase).

### Architecture: Discovery + Heuristic Field Mapping

The current `SocrataPermitAdapter` base class already handles SODA3/SODA2 queries with configurable
`SocrataConfig` objects. The missing piece is discovering those configs at runtime instead of
hardcoding them.

**What to build (no new packages):**

A `SocrataDiscoveryService` that:
1. Queries `api.us.socrata.com/api/catalog/v1` for permit/violation/inspection datasets
2. Inspects `columns_field_name` arrays to identify datasets with permit-like schemas
   (look for fields like `permit_number`, `permit_no`, `address`, `issue_date`, `estimated_cost`)
3. Stores discovered datasets in a new `data_sources` table with cached field mappings
4. Dynamically instantiates `SocrataPermitAdapter` from stored configs (the adapter already
   accepts `SocrataConfig` objects -- no code changes to the adapter itself)
5. Runs weekly via Vercel cron to refresh the discovery cache

**Why this works:** The existing `SocrataPermitAdapter.scrape()` method already accepts any
`{domain, datasetId, fieldMap}` configuration. Discovery just automates finding those configs.

**Confidence: HIGH** -- API verified live, response schema documented, existing adapter supports dynamic config.

---

## 2. ArcGIS Hub Search API (Non-Socrata Municipal Data)

Many cities publish permits through ArcGIS Hub instead of Socrata (e.g., Atlanta, Raleigh,
Charlotte, San Diego). The existing `AtlantaPermitsAdapter` already consumes ArcGIS GeoJSON.

### API Details

| Aspect | Detail |
|--------|--------|
| Search endpoint | `https://hub.arcgis.com/api/v3/datasets` (JSON:API standard) |
| Data download | `https://[hub-domain]/api/v3/datasets/[id]/downloads/data?format=geojson` |
| Authentication | None required for public datasets |
| Advantage | GeoJSON responses include coordinates in geometry -- skip geocoding |

### What to Build

An `ArcGISDiscoveryService` similar to the Socrata one:
1. Search Hub for building permit datasets by keyword
2. Cache discovered datasets in the same `data_sources` table
3. Dynamically create adapters using the pattern from `AtlantaPermitsAdapter`

**No new npm packages needed.** Native `fetch` + JSON parsing.

**Confidence: HIGH** -- Atlanta adapter proves the pattern; Hub search API documented.

---

## 3. New Federal/National Data Source APIs

### 3a. USAspending API (Federal Contract Awards)

Complements the existing SAM.gov adapter. SAM.gov shows **open opportunities**; USAspending shows
**awarded contracts** -- meaning confirmed construction activity with known contractors and locations.

| Aspect | Detail |
|--------|--------|
| Endpoint | `POST https://api.usaspending.gov/api/v2/search/spending_by_award/` |
| Auth | **None required** -- explicitly documented as no authorization needed |
| NAICS filter | Construction sector codes 236xxx, 237xxx, 238xxx |
| Data returned | Award amount, recipient name/location, agency, dates, PSC codes |
| Rate limit | Not documented; use conservative 30 req/min |
| New source type | `"contract-award"` |

**No new npm packages needed.** Plain `fetch` POST with JSON body.

**Confidence: HIGH** -- API verified via official docs, open source on GitHub.

### 3b. DOL OSHA Enforcement API (Construction Safety Inspections)

Construction inspections indicate active worksites. Violations indicate contractors who may need
equipment/services for remediation.

| Aspect | Detail |
|--------|--------|
| Endpoint | `GET https://data.dol.gov/get/inspection` |
| Auth | API key required (`X-API-KEY` header) -- **free** registration at dataportal.dol.gov |
| Filter syntax | JSON: `{"field":"naics_code","operator":"eq","value":"23"}` |
| Data | ~90,000 inspections/year: company name, address, NAICS, violation details |
| Rate limit | Not explicitly documented; use p-queue at 10 req/min |
| New source type | `"inspection"` |
| Fallback | Bulk CSV download at osha.gov/data if API is unreliable |

**Confidence: MEDIUM** -- API exists but DOL portal was recently restructured/redirected. Bulk
CSV is a reliable fallback.

### 3c. HUD Residential Construction Permits (County-Level Aggregate)

County-level permit volume data from the Census Bureau's Building Permits Survey.

| Aspect | Detail |
|--------|--------|
| Endpoint | HUD ArcGIS Open Data: `hudgis-hud.opendata.arcgis.com` |
| Auth | None |
| Format | CSV, GeoJSON via ArcGIS API |
| Data | County-level permit counts (total units, single-family, multi-family) by year |
| Use case | Market intelligence signal for scoring, not individual leads |

**Confidence: HIGH** -- Available via ArcGIS, same pattern as Atlanta adapter.

### 3d. Existing Adapters (Expand, Don't Rebuild)

These already work and just need expanded geographic coverage:

| Adapter | Current Coverage | v4.0 Target | Changes Needed |
|---------|-----------------|-------------|----------------|
| FEMA Disasters | All states | All states | None -- already nationwide |
| NWS Storm Alerts | All NWS zones | All NWS zones | None -- already nationwide |
| EIA Utility Rates | All states | All states | None -- already nationwide |
| SAM.gov Bids | All federal | All federal | None -- already nationwide |
| News (ENR, CDive, PRNewsWire) | All | All | None -- already nationwide |

The adapters that need expansion are the **permit and violation adapters**, which are currently
limited to Austin/Dallas/Atlanta/Houston. Socrata/ArcGIS discovery solves this.

---

## 4. New Source Types for Schema

The existing `sourceTypes` array:
```typescript
["permit", "bid", "news", "deep-web", "storm", "disaster", "violation"]
```

**Add these:**

| New Type | Source | Why |
|----------|--------|-----|
| `"inspection"` | OSHA enforcement API | Active worksites, safety violations |
| `"contract-award"` | USAspending API | Confirmed construction with known contractors |

**Do NOT add yet (defer to v5):**

| Deferred Type | Why Defer |
|---------------|-----------|
| `"property-transfer"` | No free nationwide API; ATTOM/ICE cost $500+/mo; county-level scraping is 3,100 different systems |
| `"planning"` | Zoning/planning boards publish PDFs and meeting minutes; no standardized API |
| `"court-filing"` | PACER costs $0.10/page; CourtListener (free alternative) has partial coverage; liens are county-level, not federal |
| `"real-estate"` | MLS APIs (Zillow, ATTOM) are paid ($500+/mo) with restrictive ToS prohibiting competing products |
| `"contractor-license"` | 50 different state systems with no unified API; high maintenance for low ROI |

---

## 5. Scoring Engine Fix (Algorithmic, No New Packages)

### Root Cause Analysis (from code audit)

The scoring engine architecture is sound (5 dimensions, query-time, per-org context). The problem
is that most code paths converge to the same scores:

| Dimension | Max | What Most Leads Get | Why |
|-----------|-----|---------------------|-----|
| Distance (25) | 25 | **0** | Most leads lack lat/lng; `null` distance = 0 points |
| Relevance (30) | 30 | **5** | Low-confidence enrichment tags all 5 industries; gives 5 pts for "uncertain match" |
| Value (20) | 20 | **10** | `estimatedValue` is null for most leads; null = 10 pts. No target range = 10 pts |
| Freshness (15) | 15 | **12-15** | Leads scraped in same batch get identical freshness |
| Urgency (10) | 10 | **5** | Every permit gets 5 pts for "Active building permit" |

**Result: Most leads score 32-35 out of 100. No differentiation.**

### Fixes (Pure TypeScript, No Dependencies)

| Fix | What Changes | Score Impact |
|-----|--------------|-------------|
| **Geocoding coverage** | Ensure more leads get coordinates; fallback to city centroid | Distance dimension activates (0-25 range instead of flat 0) |
| **Keyword-count relevance** | Count matching industry keywords in description; scale 0-15 bonus | Relevance spreads from 5-30 instead of clustering at 5 |
| **Value estimation heuristics** | Infer value from project type ("new commercial" > "residential repair") when estimatedValue is null | Value dimension spreads across 0-20 |
| **Source-type freshness curves** | Storms decay in hours, bids in days, permits in weeks | Freshness differentiates within same batch |
| **Graduated urgency** | Within permits: commercial > residential; high-value > low-value; inspection/violation > standard permit | Urgency spreads 0-10 instead of flat 5 |
| **Confidence weighting** | Score enrichment confidence; penalize "all industries" tagged leads more aggressively | Forces relevance scoring to differentiate |

**Add to `LeadScoringInput`:**
```typescript
sourceConfidence: "high" | "medium" | "low";  // from industry inference
keywordMatchCount: number;                      // count of matching keywords
```

**No new packages needed.** All changes are to the pure TypeScript functions in `src/lib/scoring/`.

---

## 6. Geocoding Strategy

### Problem

Google Maps Geocoding API pricing changed March 1, 2025:
- Old: $200/month free credit (~40,000 free geocodes)
- New: 10,000 free monthly requests per SKU, then $5/1,000 requests

With hundreds of Socrata datasets potentially producing thousands of leads daily, 10,000/month
will be insufficient.

### Solution: Tiered Geocoding

| Tier | When | Cost |
|------|------|------|
| **1. Source-provided coordinates** | Socrata/ArcGIS datasets that include lat/lng | Free |
| **2. Google Maps** | First 10,000/month for leads without coordinates | Free (within quota) |
| **3. Nominatim (OpenStreetMap)** | Overflow beyond Google quota | Free (1 req/sec on public API) |

**Nominatim is a REST API -- no npm package needed:**
```
GET https://nominatim.openstreetmap.org/search?q=ADDRESS&format=json&limit=1
```

**Requirements:** Set a `User-Agent` header with app name + contact email (Nominatim ToS).

**Add to `api-rate-limiter.ts`:**
```typescript
// Nominatim: 1 req/sec on public API
nominatimQueue = new PQueueClass({
  concurrency: 1,
  intervalCap: 60,
  interval: 60_000,
});
```

**Many Socrata datasets already include coordinates.** The existing pipeline handles this:
```typescript
if (record.lat != null && record.lng != null) {
  results.push({ ...record }); // Skip geocoding
}
```

This means the geocoding load may be lower than expected once discovery is working.

**Confidence: HIGH** -- Nominatim is the standard free geocoding alternative; well-documented.

---

## 7. HTML Parsing for Non-API Sources

### Why Add cheerio

Some valuable data sources don't have APIs but publish data as HTML pages (OSHA inspection
search results, state contractor license boards, some planning board agendas). The existing
`Crawlee` dependency handles browser-based scraping but is too heavy for simple HTML parsing
on serverless:

- Crawlee launches Playwright/Puppeteer = too much memory for Vercel functions
- Static HTML pages don't need JavaScript rendering
- cheerio is 40x faster than jsdom for static HTML parsing

### Recommendation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `cheerio` | `^1.2.0` | Lightweight static HTML parsing | Fast (40x jsdom); built-in TypeScript types; jQuery-familiar API; dual ESM/CJS |

**Use cheerio for:** Parsing HTML search results, extracting structured data from static pages.
**Keep Crawlee for:** Pages that require JavaScript rendering (SPAs, dynamic content).

**Confidence: HIGH** -- cheerio 1.2.0 is current stable; ported entirely to TypeScript; no
`@types/cheerio` package needed.

---

## 8. New Database Table: `data_sources`

For caching discovered Socrata/ArcGIS datasets. This is a schema change, not a new package.

```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,            -- 'socrata' | 'arcgis'
  domain TEXT NOT NULL,              -- 'data.austintexas.gov'
  dataset_id TEXT NOT NULL,          -- '3syk-w9eu'
  name TEXT NOT NULL,                -- 'Building Permits'
  source_type TEXT NOT NULL,         -- 'permit' | 'violation' | 'inspection'
  jurisdiction TEXT,                 -- 'Austin, TX'
  state_code TEXT,                   -- 'TX' (for geographic routing)
  field_mapping JSONB NOT NULL,      -- {"permitNumber":"permit_num","address":"addr",...}
  columns_available TEXT[],          -- all available column names
  last_discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_scraped_at TIMESTAMP,
  last_record_count INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  quality_score REAL,                -- heuristic: how well fields map
  UNIQUE(platform, domain, dataset_id)
);
```

**Uses Drizzle's existing JSONB support** -- no new packages. The `field_mapping` column stores
the mapping from generic field names to dataset-specific column names.

---

## 9. Rate Limiting for Nationwide Scale

### Existing Queues (Keep As-Is)

| Queue | Config | API |
|-------|--------|-----|
| `socrataQueue` | concurrency 2, 8 req/min | Socrata SODA data queries |
| `samGovQueue` | concurrency 1, 10 req/min | SAM.gov bids |
| `nwsQueue` | concurrency 1, 5 req/min | NWS storm alerts |
| `eiaQueue` | concurrency 1, 30 req/min | EIA utility rates |

### New Queues to Add

| Queue | Config | API |
|-------|--------|-----|
| `usaSpendingQueue` | concurrency 2, 30 req/min | USAspending (no documented limit) |
| `oshaQueue` | concurrency 1, 10 req/min | DOL OSHA enforcement |
| `nominatimQueue` | concurrency 1, 60 req/min | Nominatim geocoding (1/sec) |
| `arcgisQueue` | concurrency 2, 15 req/min | ArcGIS Hub downloads |
| `discoveryQueue` | concurrency 1, 5 req/min | Socrata Discovery (infrequent) |

All use the existing `p-queue` package with the same lazy dynamic import pattern already in
`api-rate-limiter.ts`. **No new packages.**

---

## 10. Vercel Cron Strategy for Scale

### Problem

Vercel Pro serverless functions timeout at 300 seconds (5 minutes). With potentially hundreds
of datasets, a single cron run cannot scrape everything.

### Solution: Chunked Pipeline with DB-Backed Cursor

| Cron Route | Schedule | Purpose |
|------------|----------|---------|
| `/api/cron/discover` | Weekly (Sun 2am) | Run Socrata + ArcGIS discovery; refresh `data_sources` |
| `/api/cron/scrape-permits` | Daily 6am | Scrape batch of 50 permit datasets; track cursor in DB |
| `/api/cron/scrape-federal` | Daily 7am | SAM.gov + USAspending + OSHA |
| `/api/cron/scrape-weather` | Every 6h | NWS storms + FEMA disasters |
| `/api/cron/scrape-news` | Daily 8am | RSS feeds + Google dorking |
| `/api/cron/enrich` | Daily 9am | Enrichment on un-enriched leads |

**Each cron processes a batch**, stores its cursor position in the DB, and picks up where it
left off on the next run. A `data_sources` row's `last_scraped_at` determines which datasets
are due for scraping.

**No new packages.** This is an architectural pattern using existing tools.

---

## 11. Complete New Dependencies Summary

### Install

```bash
npm install cheerio@^1.2.0
```

**That's it. One new production package.**

### Why So Few New Packages

| Capability | Why No New Package |
|------------|-------------------|
| Socrata Discovery | Plain HTTP GET via `fetch` |
| ArcGIS Hub Discovery | Plain HTTP GET via `fetch` |
| USAspending API | Plain HTTP POST via `fetch` |
| DOL OSHA API | Plain HTTP GET via `fetch` |
| Nominatim geocoding | Plain HTTP GET via `fetch` |
| Scoring engine fix | Pure TypeScript functions |
| New source types | Schema + type changes |
| Rate limiting (new APIs) | Existing `p-queue` -- add queue instances |
| JSONB field mappings | Existing Drizzle ORM |
| DB-backed cron cursor | Existing Drizzle + Neon |

---

## 12. Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Socrata Discovery API (free) | ATTOM / Shovels (paid permit APIs) | $500+/month for data we can get free from public portals |
| Nominatim (free geocoding overflow) | HERE Maps (250k free/mo) | HERE requires account/key management; Nominatim simpler for overflow |
| cheerio ^1.2.0 (HTML parsing) | node-html-parser | cheerio has larger ecosystem, better TypeScript, jQuery-familiar API |
| Keep existing p-queue ^9.1.0 | bottleneck, limiter | p-queue works, tested in codebase, no reason to switch |
| USAspending (contract awards) | FPDS (Federal Procurement) | USAspending is newer, better documented, no auth needed |
| OSHA DOL API | Bulk CSV download only | API allows incremental daily pulls; CSV requires full re-download |
| Keep Google Maps primary geocoder | Switch entirely to Nominatim | Google is more accurate; use as primary within free quota |
| Rule-based scoring fix | ML/AI scoring | Explicitly out of scope per PROJECT.md; fix rules first |
| DB-backed cron cursor | Redis / external queue | Overkill; Neon + p-queue is sufficient at this scale |

---

## 13. What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ATTOM / Shovels (paid permit APIs) | $500+/month for data available free from Socrata | Socrata Discovery API |
| DSIRE paid API (solar incentives) | Subscription pricing, contact required | Keep curated `SOLAR_INCENTIVES` array; update manually quarterly |
| Zillow / MLS real estate APIs | $500+/mo, restrictive ToS, prohibits competing products | Not needed -- leads come from permits/bids/gov data |
| PACER / CourtListener (court filings) | PACER: $0.10/page; CourtListener: partial coverage; liens are county-level | Defer to v5 |
| Contractor license board scrapers | 50 different state systems, no unified API | Defer to v5 |
| ML/AI scoring models | Out of scope per PROJECT.md | Fix rule-based engine properly |
| Redis / external queue | Overkill at current scale | DB cursor + p-queue |
| Puppeteer/Playwright for new adapters | Too heavy for serverless; most sources have APIs or static HTML | cheerio for HTML; Crawlee only when JS rendering needed |
| GraphQL layer | No consumer needs it | Keep server actions + API routes |
| axios / node-fetch / got | Unnecessary HTTP client libraries | Built-in `fetch` (Next.js provides it globally) |
| soda-js (Socrata client) | Unmaintained; plain fetch with SODA params is simpler | Built-in `fetch` |
| turf.js / @turf/turf | PostGIS handles geospatial server-side | PostGIS (already enabled on Neon) |
| papaparse (CSV parsing) | Not needed for v4 -- no bulk CSV imports planned | If needed later, add then |

---

## 14. Environment Variables

### New for v4.0

| Variable | Required | Source | Free? |
|----------|----------|--------|-------|
| `SOCRATA_APP_TOKEN` | Recommended (higher rate limits) | dev.socrata.com registration | Yes |
| `DOL_API_KEY` | For OSHA inspection data | dataportal.dol.gov registration | Yes |
| `NOMINATIM_USER_AGENT` | If using Nominatim overflow | Set to `GroundPulse/1.0 (contact@email)` | N/A |

### Existing (No Changes Needed)

| Variable | Status |
|----------|--------|
| `GOOGLE_MAPS_API_KEY` | Keep for primary geocoding |
| `SAM_GOV_API_KEY` | Keep for SAM.gov bids |
| `EIA_API_KEY` | Keep for utility rates |
| `NREL_API_KEY` | Keep for NEVI/EV station data (note: migrate domain to nlr.gov by April 2026) |
| All Stripe, Neon, Resend, Better Auth vars | Unchanged |

---

## 15. Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| cheerio | ^1.2.0 | Node 18+, TypeScript 5.x | Built-in types; dual ESM/CJS; no @types needed |
| p-queue | ^9.1.0 (existing) | ESM only | Already using dynamic `import()` -- no issues |
| drizzle-orm | ^0.45.1 (existing) | Neon, JSONB type | JSONB column for field_mapping supported natively |
| zod | ^4.3.6 (existing) | All deps | Add new source type values to sourceTypes enum |
| PostGIS | On Neon | drizzle geometry() type | Already enabled; `location` column already exists in leads table |

---

## Sources

- [Socrata Discovery API](https://api.us.socrata.com/api/catalog/v1) -- **Verified live**: 486 permit datasets found, response schema documented (HIGH)
- [Socrata Developer Docs](https://dev.socrata.com/docs/other/discovery) -- Discovery API documentation (HIGH)
- [Socrata Discovery Apiary Docs](https://socratadiscovery.docs.apiary.io/) -- API specification (HIGH)
- [ArcGIS Hub Search API](https://hub.arcgis.com/api/search/definition/) -- Dataset search endpoint (HIGH)
- [USAspending API Docs](https://api.usaspending.gov/docs/endpoints) -- No auth, NAICS search (HIGH)
- [USAspending GitHub](https://github.com/fedspendingtransparency/usaspending-api) -- Open source API contracts (HIGH)
- [DOL OSHA Enforcement API](https://developer.dol.gov/health-and-safety/dol-osha-enforcement/) -- Inspection data (MEDIUM)
- [DOL API User Guide](https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf) -- Auth, filter syntax (MEDIUM)
- [Nominatim](https://nominatim.org/) -- Free geocoding, 1 req/s public API (HIGH)
- [Google Maps Geocoding Pricing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing) -- 10k free/month post-March 2025 (HIGH)
- [cheerio](https://cheerio.js.org/) -- v1.2.0, built-in TypeScript, 40x faster than jsdom (HIGH)
- [cheerio GitHub releases](https://github.com/cheeriojs/cheerio/releases) -- Version history (HIGH)
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) -- 300s max on Pro plan (HIGH)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- Timeout matches function limits (HIGH)
- [DSIRE API](https://www.dsireusa.org/dsire-api/) -- Paid subscription, contact required (MEDIUM)
- [NREL Developer Network](https://developer.nlr.gov/) -- Migrating domain by April 2026 (HIGH)
- [HUD Residential Permits](https://hudgis-hud.opendata.arcgis.com/datasets/HUD::residential-construction-permits-by-county/about) -- County-level data (HIGH)
- [p-queue npm](https://www.npmjs.com/package/p-queue) -- v9.1.0 latest, ESM only (HIGH)

---
*Stack research for: GroundPulse v4.0 Nationwide Expansion*
*Researched: 2026-03-19*
