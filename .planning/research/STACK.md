# Stack Research: LeadForge v3.0 Multi-Industry Expansion

**Domain:** Multi-industry B2B lead generation platform (heavy equipment, HVAC, roofing, solar, electrical)
**Researched:** 2026-03-16
**Confidence:** HIGH (majority verified against official docs and existing codebase patterns)

## Context

This is a SUBSEQUENT MILESTONE research for LeadForge v3.0. The existing validated stack (Next.js 16.1.6, Drizzle 0.45.1, Neon PostgreSQL, Better Auth 1.5.5, Stripe 20.4.1, Crawlee 3.16.0, Resend 6.9.3, @vis.gl/react-google-maps 1.7.1, Zod 4.3.6, shadcn/ui) is NOT re-researched. This document covers ONLY the new capabilities needed for the multi-industry expansion.

---

## 1. External Data Source APIs (No New Libraries Required)

All government/public APIs below are accessed via plain `fetch()` -- the same pattern used by the existing `SamGovBidsAdapter` and `AustinPermitsAdapter`. No HTTP client library is needed because the existing adapter architecture handles retries, validation, and error isolation at the pipeline level.

### 1A. NOAA Weather/Storm Data

**Confidence:** HIGH (verified against official NWS API docs and OpenAPI spec)

There is NO dedicated Storm Events API. The Storm Events database is only available as bulk CSV downloads (updated monthly). However, the **NWS Alerts API** provides real-time active weather alerts which is more valuable for the storm alert notification feature.

| Property | Value |
|----------|-------|
| **Endpoint** | `https://api.weather.gov/alerts/active` |
| **Auth** | None required (free, no API key) |
| **Rate limit** | Not formally documented; requires `User-Agent` header with app name and contact |
| **Format** | GeoJSON (default) or JSON-LD |
| **Key params** | `area` (state code), `event` (event type), `severity`, `urgency`, `certainty`, `zone` |
| **Update frequency** | Real-time (alerts are live as they are issued/cancelled) |
| **Example** | `GET https://api.weather.gov/alerts/active?area=TX&severity=Extreme,Severe` |

**Storm Events historical data** (for seeding/backfill):

| Property | Value |
|----------|-------|
| **URL** | `https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/` |
| **Format** | Gzipped CSV files, one per year per file type |
| **File types** | `StormEvents_details`, `StormEvents_fatalities`, `StormEvents_locations` |
| **Auth** | None (public HTTP directory listing) |
| **Integration** | Download CSV, parse with built-in Node.js csv parsing, no library needed |

**Recommendation:** Use the NWS Alerts API for real-time storm alert notifications. Use the Storm Events CSV data for historical enrichment (e.g., "this area had 12 hail events in the past year"). Fetch CSVs via `fetch()` and parse with a lightweight CSV parser.

**New env vars needed:** None (no API key required). Set `User-Agent` header to `LeadForge/1.0 (contact@leadforge.com)`.

### 1B. FEMA OpenFEMA Disaster Declarations

**Confidence:** HIGH (verified against official OpenFEMA API docs)

| Property | Value |
|----------|-------|
| **Endpoint** | `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries` |
| **Auth** | None required (free, no API key, no subscription) |
| **Rate limit** | Not formally documented |
| **Default records** | 1,000 per request (max 10,000 with `$top`) |
| **Pagination** | `$skip` + `$top` (offset-based) |
| **Format** | JSON (default), CSV, GeoJSON, Parquet |
| **Key params** | `$filter` (OData-style: `state eq 'Texas'`), `$select`, `$orderby`, `$count` |
| **Geospatial** | Supports `geo.intersects()` for location-based queries |
| **Example** | `GET /api/open/v2/DisasterDeclarationsSummaries?$filter=state eq 'Texas' and declarationType eq 'DR'&$orderby=declarationDate desc&$top=100` |

**Key fields returned:** `disasterNumber`, `state`, `declarationType` (DR=major disaster, EM=emergency, FM=fire), `declarationDate`, `incidentType` (Hurricane, Severe Storm, Flood, Fire, etc.), `designatedArea`, `fipsStateCode`, `fipsCountyCode`.

**Why this matters for LeadForge:** Disaster declarations create immediate demand for roofing, HVAC, and electrical contractors in affected areas. Cross-reference with user service areas to push targeted alerts.

**New env vars needed:** None.

### 1C. SAM.gov API Expansion (Multi-NAICS)

**Confidence:** HIGH (verified against existing `SamGovBidsAdapter` code + GSA open.gsa.gov docs)

The existing adapter already queries NAICS codes `236`, `237`, `238`. For multi-industry support, expand to industry-specific NAICS codes:

| Industry | NAICS Codes | Description |
|----------|-------------|-------------|
| Heavy Equipment | `236` (Building Construction), `237` (Heavy/Civil), `238` (Specialty Trade) | Already implemented |
| HVAC | `238220` (Plumbing/Heating/AC Contractors) | Subset of existing 238 |
| Roofing | `238160` (Roofing Contractors) | Subset of existing 238 |
| Solar | `238210` (Electrical/Wiring Installation), `221114` (Solar Electric Power Gen) | 238210 overlaps with Electrical |
| Electrical | `238210` (Electrical Contractors), `238290` (Other Building Equipment) | 238210 is the primary code |

**Implementation:** Modify `SamGovBidsAdapter` to accept a configurable NAICS code list per industry vertical. The API endpoint (`https://api.sam.gov/opportunities/v2/search`), authentication pattern, and response parsing remain identical. The `ncode` parameter already accepts 3-digit or 6-digit codes.

**Important:** The SAM.gov API only accepts one `ncode` per request, so multi-NAICS queries require multiple sequential API calls (same pattern already used -- the existing adapter loops over `this.naicsCodes`).

**New env vars needed:** None (uses existing `SAM_GOV_API_KEY`).

### 1D. Socrata SODA API (Generalized Permits)

**Confidence:** HIGH (verified against existing `AustinPermitsAdapter` code + Socrata dev docs)

The existing Austin permits adapter uses Socrata's SODA API. The pattern generalizes to any city with a Socrata-powered open data portal.

**SODA3 migration note:** Socrata released SODA3 in late 2025, changing the endpoint from `/resource/IDENTIFIER.json` to `/api/v3/views/IDENTIFIER/query.json`. SODA3 now requires either an app token or authentication. The existing Austin adapter uses the legacy `/resource/` endpoint and will need updating.

| City | Portal Domain | Dataset ID | Key Fields |
|------|---------------|-----------|------------|
| Austin, TX | `data.austintexas.gov` | `3syk-w9eu` | Already implemented |
| Chicago, IL | `data.cityofchicago.org` | `ydr8-5enu` | permit_number, work_description, reported_cost |
| Houston, TX | `data.houstontx.gov` | Discoverable via SODA Discovery API | Various permit types |
| Seattle, WA | `data.seattle.gov` | `76t5-zqzr` | permit_type, description, value |
| San Francisco, CA | `data.sfgov.org` | `k2ra-p3nq` | permit_type, description, estimated_cost |
| NYC | `data.cityofnewyork.us` | Multiple datasets | DOB permits, filing types |

**Discovery endpoint for finding new cities:** `http://api.us.socrata.com/api/catalog/v1/domains` lists all Socrata-powered portals. Use `http://api.us.socrata.com/api/catalog/v1?q=building+permits` to search across all portals.

**Implementation:** Create a `SocrataPermitsAdapter` factory that accepts `{ domain, datasetId, fieldMapping }` to generate city-specific adapters without writing new adapter classes for each city.

**New env vars needed:** `SOCRATA_APP_TOKEN` -- required for SODA3 API. Free to register at dev.socrata.com.

### 1E. DSIRE Incentive Database

**Confidence:** LOW (API is behind a paid subscription; could not verify endpoints)

The DSIRE API (dsireusa.org/dsire-api) provides real-time access to 2,500+ renewable energy and efficiency incentive programs across 124 energy technologies. However, it is a **paid subscription API** -- not freely available.

| Property | Value |
|----------|-------|
| **API docs** | `https://docs.dsireusa.org/` (requires subscription login) |
| **Auth** | Subscription-based (contact dsire-admin@ncsu.edu for pricing) |
| **Data** | State/local incentives, rebates, tax credits, loan programs for solar, wind, EV, efficiency |
| **Relevance** | Solar and HVAC verticals (IRA tax credits, state rebates, utility incentives) |

**Alternative approach (no subscription needed):** The NREL Energy Incentives API v2 was deprecated but provided similar data. The DSIRE public website (`programs.dsireusa.org/system/program`) can be scraped with Crawlee (already in stack) for public program listings. Each program page has structured data (state, technology, program type, implementing sector).

**Recommendation:** Start with Crawlee-based scraping of the public DSIRE program listings. If the product gains traction in the solar/HVAC verticals, evaluate the paid DSIRE API subscription for real-time data. The public listings are sufficient for MVP.

**New env vars needed:** None for scraping approach. `DSIRE_API_KEY` if paid subscription is pursued later.

### 1F. NEVI Program / EV Charging Station Data

**Confidence:** HIGH (verified against NREL AFDC API docs)

NEVI program data is available through the **NREL Alternative Fuel Station Locator API**, which includes a `funding_sources` field identifying NEVI-funded stations.

| Property | Value |
|----------|-------|
| **Endpoint** | `https://developer.nrel.gov/api/alt-fuel-stations/v1.json` |
| **Auth** | API key required (free, register at developer.nrel.gov) |
| **Rate limit** | 1,000 requests/hour |
| **Key params** | `fuel_type=ELEC`, `ev_network`, `state`, `zip`, `radius`, `latitude`, `longitude` |
| **NEVI filter** | Filter response by `funding_sources` containing "NEVI" |
| **Relevance** | Electrical contractors vertical -- EV charging station installation opportunities |

**Note on domain migration:** NREL is migrating from `developer.nrel.gov` to `developer.nlr.gov` by April 30, 2026. Use the new domain from the start.

**New env vars needed:** `NREL_API_KEY`.

### 1G. EIA Electricity Rate Data

**Confidence:** HIGH (verified against official EIA API v2 docs)

The EIA API v2 provides current utility rate data (updated monthly). This replaces the NREL Utility Rates API v3 which contains **data from 2012 only** and will not be updated.

| Property | Value |
|----------|-------|
| **Endpoint** | `https://api.eia.gov/v2/electricity/retail-sales/data` |
| **Auth** | API key required (free, register at eia.gov/opendata) |
| **Rate limit** | Dynamic per key; throttle to ~1 req/sec to be safe |
| **Max records** | 5,000 per request (JSON) |
| **Pagination** | `offset` + `length` params |
| **Key params** | `data[]=price`, `facets[stateid][]=TX`, `facets[sectorid][]=RES`, `frequency=monthly` |
| **Sectors** | `RES` (residential), `COM` (commercial), `IND` (industrial) |
| **Data fields** | `price` (cents/kWh), `revenue` ($M), `sales` (M kWh), `customers` (count) |
| **Frequency** | `monthly`, `quarterly`, `annual` |

**Why this matters for LeadForge:** Electricity rates drive solar installation ROI calculations. Higher rates = stronger solar lead signals. Show users "average residential rate in [service area]: $X.XX/kWh" to contextualize solar leads.

**New env vars needed:** `EIA_API_KEY`.

---

## 2. PostGIS for Geospatial Queries

**Confidence:** HIGH (verified against Neon PostGIS docs + Drizzle ORM PostGIS guide)

### Why PostGIS Now

The existing codebase uses raw `real` columns for `lat`/`lng` with Haversine SQL expressions inlined into queries. The schema comment in `leads.ts` already notes: "PostGIS upgrade path: Once Neon serverless driver compatibility with PostGIS geometry types is verified, add a `geometry(Point, 4326)` column."

Neon now fully supports PostGIS. The multi-industry expansion will increase lead volume (5x more verticals, more cities), making the bounding-box + Haversine approach increasingly expensive. PostGIS with GiST spatial indexes provides:

- `ST_DWithin()` for radius queries (uses spatial index, dramatically faster than Haversine on `real` columns)
- `ST_Distance()` for distance calculation
- `ST_MakePoint()` for point creation
- `ST_Within()` / `ST_MakeEnvelope()` for bounding box queries
- `ST_Intersects()` for polygon-based service area matching

### Drizzle ORM Native Support

Drizzle ORM now has a built-in `geometry` column type with PostGIS support:

```typescript
import { geometry, index, pgTable, serial, text } from 'drizzle-orm/pg-core';

export const leads = pgTable('leads', {
  // ... existing columns ...
  location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }),
}, (t) => [
  index('leads_location_gist_idx').using('gist', t.location),
]);
```

**Insert pattern:**
```typescript
await db.insert(leads).values({
  // ... other fields ...
  location: { x: lng, y: lat }, // x=longitude, y=latitude
});
```

**Query pattern (radius search):**
```typescript
const sqlPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
await db.select()
  .from(leads)
  .where(sql`ST_DWithin(${leads.location}::geography, ${sqlPoint}::geography, ${radiusMeters})`)
  .orderBy(sql`${leads.location} <-> ${sqlPoint}`);
```

### Migration Strategy

Do NOT remove the existing `lat`/`lng` real columns immediately. Add the `geometry` column alongside them, populate via migration script, then switch queries to use PostGIS. This allows rollback if issues arise.

**Enable PostGIS on Neon:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### No New npm Dependencies

PostGIS is a Postgres extension, not an npm package. Drizzle's built-in `geometry` type handles serialization/deserialization. No additional libraries needed.

---

## 3. Rate Limiting for External APIs

**Confidence:** HIGH

### New Dependency: p-queue

The existing rate-limit system (`src/lib/scraper/rate-limit.ts`) only limits per-org pipeline runs (1 run/hour). It does NOT rate-limit individual API calls to external services. With 7+ external APIs, each with different rate limits, a proper API-call-level rate limiter is needed.

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `p-queue` | `^8.1.0` | Per-API rate limiting with concurrency control | Mature, well-maintained (sindresorhus), supports `intervalCap` + `interval` for sliding window rate limits, zero dependencies |

**Why p-queue over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| `p-limit` | Concurrency only, no time-window rate limiting |
| `p-throttle` | Rate limiting only, no queue -- requests are rejected, not queued |
| `bottleneck` | Heavier, cluster support we don't need, last published 2019 |
| `p-ratelimit` | Less maintained, smaller community |
| Custom implementation | The sliding-window algorithm with queue management is non-trivial to get right |

**Configuration per API:**

| API | Rate Limit | p-queue Config |
|-----|-----------|----------------|
| NWS Alerts | ~30 req/min (undocumented, conservative) | `{ intervalCap: 30, interval: 60000, concurrency: 2 }` |
| FEMA OpenFEMA | No documented limit (conservative: 60/min) | `{ intervalCap: 60, interval: 60000, concurrency: 3 }` |
| SAM.gov | Undocumented (conservative: 30/min) | `{ intervalCap: 30, interval: 60000, concurrency: 1 }` |
| Socrata SODA | 1,000/hr with app token | `{ intervalCap: 15, interval: 60000, concurrency: 2 }` |
| NREL AFDC | 1,000/hr | `{ intervalCap: 15, interval: 60000, concurrency: 2 }` |
| EIA | Dynamic, ~60/min safe | `{ intervalCap: 60, interval: 60000, concurrency: 2 }` |
| Google Geocoding | 50 req/sec (paid tier) | `{ intervalCap: 40, interval: 1000, concurrency: 5 }` |

**Integration pattern:**
```typescript
import PQueue from 'p-queue';

const nwsQueue = new PQueue({ intervalCap: 30, interval: 60_000, concurrency: 2 });

// In adapter:
const response = await nwsQueue.add(() => fetch(url, { headers }));
```

### Installation

```bash
npm install p-queue
```

**Note:** p-queue v8 is ESM-only. Next.js App Router with `"type": "module"` in package.json handles this natively. Verify the project's module configuration supports ESM imports.

---

## 4. Hash-Based Deduplication

**Confidence:** HIGH (verified -- Node.js built-in `crypto` module)

### No New Dependencies Required

The existing dedup system uses `string-similarity` (Dice coefficient) + geographic proximity. For the multi-industry expansion, add hash-based dedup as a **fast pre-filter** before the expensive similarity comparison.

**Node.js built-in crypto:**
```typescript
import { createHash } from 'node:crypto';

function computeContentHash(record: RawLeadData): string {
  const canonical = [
    record.sourceId,
    record.sourceUrl ?? '',
    record.externalId ?? '',
    record.permitNumber ?? '',
    (record.title ?? '').toLowerCase().trim(),
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}
```

**How it integrates with existing dedup:**
1. **Hash check (fast, O(1))**: Before inserting, check if `content_hash` already exists in the DB. If exact match, skip entirely.
2. **Similarity check (expensive, existing)**: If no hash match, proceed with geographic + text similarity dedup for fuzzy/near-duplicate detection.

**Schema addition:**
```typescript
// Add to leads table:
contentHash: text("content_hash"),
// Add index:
index("leads_content_hash_idx").on(table.contentHash),
```

This is a pure performance optimization -- the existing dedup logic remains for fuzzy matching. The hash is for exact-match fast-path.

---

## 5. Interactive Map for Service Area Selection

**Confidence:** MEDIUM (DrawingManager integration with @vis.gl/react-google-maps requires custom component wiring)

### No New Dependencies Required

The existing `@vis.gl/react-google-maps@^1.7.1` supports the Google Maps Drawing Library via the `useMapsLibrary` hook. The Drawing Library allows users to draw circles, polygons, and rectangles on the map.

**Implementation approach:**

```typescript
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

function ServiceAreaDrawer() {
  const map = useMap();
  const drawing = useMapsLibrary('drawing');

  useEffect(() => {
    if (!map || !drawing) return;

    const drawingManager = new drawing.DrawingManager({
      drawingMode: drawing.OverlayType.CIRCLE,
      drawingControl: true,
      drawingControlOptions: {
        drawingModes: [
          drawing.OverlayType.CIRCLE,
          drawing.OverlayType.POLYGON,
        ],
      },
      circleOptions: {
        editable: true,
        draggable: true,
      },
    });

    drawingManager.setMap(map);
    // Handle overlay complete events to extract coordinates
  }, [map, drawing]);
}
```

**For the onboarding wizard MVP:** Use a simple radius-based approach (already in the schema as `serviceRadiusMiles`). The circle drawing tool on the map provides a visual way to set this. Polygon-based service areas can be a Phase 2 enhancement.

**Storing polygon service areas (future):** When polygon support is needed, store as PostGIS `geometry(Polygon, 4326)` in the `company_profiles` table and use `ST_Intersects()` to check if leads fall within the service area.

**Required Google Maps API library:** `drawing` (loaded dynamically via `useMapsLibrary('drawing')`, no additional npm package needed).

---

## 6. Query-Time Scoring Engine

**Confidence:** HIGH (this is architecture, not a library decision)

### No New Dependencies Required

The existing scoring function (`src/lib/leads/scoring.ts`) computes scores in-memory with three dimensions: equipment match (50pts), geographic proximity (30pts), and project value (20pts). For the multi-industry expansion, the scoring engine needs to become:

1. **Industry-aware:** Different scoring weights per industry vertical
2. **Signal-aware:** New data sources (storms, disasters, incentives, utility rates) become scoring signals
3. **Query-time computed:** Continue computing at query time (not pre-computed), because scores depend on the querying user's profile (location, industry, equipment types)

**Implementation:** Replace the current hardcoded weights with a configurable scoring profile per industry:

```typescript
interface ScoringProfile {
  industry: string;
  weights: {
    serviceMatch: number;     // equipment/service type overlap
    proximity: number;         // geographic distance
    projectValue: number;      // estimated project value
    recency: number;           // how recently scraped
    disasterSignal: number;    // active disaster declaration in area
    stormSignal: number;       // recent severe weather events
    incentiveSignal: number;   // active incentive programs (solar/HVAC)
    utilityRate: number;       // high utility rates (solar)
  };
}
```

This is a pure code architecture change -- no new libraries needed. The scoring function already runs in the `enrichLead()` pipeline.

---

## 7. Cursor-Based Pagination

**Confidence:** HIGH (verified against Drizzle ORM official docs)

### No New Dependencies Required

The v2.1 research already documented the cursor-based pagination pattern (see previous STACK.md). The implementation approach remains the same for v3.0:

- **Cursor shape:** `{ score: number, scrapedAt: string, id: string }`
- **Pattern:** Application-level cursor after in-memory scoring (not SQL-level)
- **Drizzle operators:** `gt`, `lt`, `desc`, `asc` (already imported in queries.ts)

**One refinement for v3.0:** With PostGIS, the SQL-level query becomes faster (GiST index instead of Haversine full-scan), which means the `FETCH_MULTIPLIER = 4` over-fetch pattern can potentially be reduced. However, the cursor logic remains application-level because scoring is still computed in-memory.

---

## 8. React Email Template Expansion

**Confidence:** HIGH (verified against existing email implementation)

### No New Dependencies Required

The existing setup (`resend@^6.9.3` + `@react-email/components@^1.0.9`) already supports all needed capabilities. The existing `DailyDigestEmail` component and `sendDigest()` function demonstrate the complete pattern.

**New email templates needed:**

| Template | Purpose | Trigger |
|----------|---------|---------|
| `StormAlertEmail` | "Severe weather in [area] -- [X] potential leads" | NWS alert detected in user's service area |
| `DisasterAlertEmail` | "FEMA disaster declared in [area]" | New FEMA declaration in user's service area |
| `WeeklyIndustryDigest` | Weekly summary per industry vertical | Cron job (weekly) |
| `OnboardingWelcomeEmail` | Welcome + getting started after onboarding | Onboarding completion |
| `IncentiveAlertEmail` | "New incentive program in [state] for [industry]" | New DSIRE program detected |

**Pattern reuse:** All templates follow the same pattern as `DailyDigestEmail`:
1. React component in `src/components/emails/` using `@react-email/components`
2. Send function in `src/lib/email/` using `Resend` client
3. Render via `react: TemplateComponent({ props })` in `resend.emails.send()`

---

## 9. CSV Parsing (for NOAA Storm Events bulk data)

**Confidence:** MEDIUM (need to verify best option for streaming large CSVs)

### Option A: Built-in (Recommended)

For simple CSV parsing, Node.js can handle it without a library using string splitting. However, the NOAA storm events files are gzipped and large (50MB+ uncompressed). Two lightweight options:

| Library | Version | Size | Why |
|---------|---------|------|-----|
| `papaparse` | `^5.5.2` | 30KB | Streaming CSV parser, handles large files, well-tested, works in Node.js |

**Why papaparse over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| `csv-parse` | Heavier (part of csv package ecosystem), more API surface than needed |
| `fast-csv` | Good but less popular, API is more complex |
| `d3-dsv` | Designed for browser, not ideal for streaming large files in Node.js |
| Manual string splitting | Fragile with quoted fields, embedded commas, multiline values |

**For decompression (gzipped CSVs):** Node.js built-in `zlib.createGunzip()` handles `.csv.gz` files natively. No additional package needed.

```typescript
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import Papa from 'papaparse';

async function parseStormEvents(gzippedBuffer: Buffer) {
  const decompressed = await new Promise<Buffer>((resolve, reject) => {
    zlib.gunzip(gzippedBuffer, (err, result) => err ? reject(err) : resolve(result));
  });
  const { data } = Papa.parse(decompressed.toString('utf-8'), { header: true });
  return data;
}
```

### Installation

```bash
npm install papaparse
npm install -D @types/papaparse
```

---

## Complete Stack Changes Summary

### New Dependencies to Add

| Package | Version | Purpose | Category |
|---------|---------|---------|----------|
| `p-queue` | `^8.1.0` | Per-API rate limiting with sliding window + concurrency | Production |
| `papaparse` | `^5.5.2` | CSV parsing for NOAA Storm Events bulk data | Production |
| `@types/papaparse` | `^5.3.15` | TypeScript types for papaparse | Dev |

### Installation

```bash
# Production dependencies
npm install p-queue papaparse

# Dev dependencies
npm install -D @types/papaparse
```

### What NOT to Add

| Library | Why Not | Use Instead |
|---------|---------|-------------|
| `axios` | Existing `fetch()` works fine; adding HTTP clients is complexity without benefit | Built-in `fetch()` |
| `node-fetch` | Next.js polyfills `fetch` globally | Built-in `fetch()` |
| `bottleneck` | Last published 2019, heavier than p-queue | `p-queue` |
| `drizzle-cursor` / `drizzle-pagination` | Official Drizzle pattern is 5 lines; wrapper adds dependency for trivial logic | Manual cursor pattern |
| `@googlemaps/js-api-loader` | `@vis.gl/react-google-maps` handles map library loading via `useMapsLibrary()` | Existing library |
| `turf.js` / `@turf/turf` | PostGIS handles geospatial operations server-side; no need for client-side geo library | PostGIS extension |
| `soda-js` | Unmaintained Socrata client; plain `fetch()` with SODA query params is simpler | Built-in `fetch()` |
| `csv-parse` | Heavier than papaparse for our use case | `papaparse` |
| Any DSIRE-specific client | No public npm package exists; scrape with Crawlee (already installed) | `crawlee` (existing) |
| `wkx` | Drizzle ORM's built-in geometry type handles PostGIS serialization natively now | Drizzle `geometry()` type |

### New Environment Variables

| Variable | Source | Required | Free |
|----------|--------|----------|------|
| `EIA_API_KEY` | eia.gov/opendata | Yes (for utility rate data) | Yes |
| `NREL_API_KEY` | developer.nlr.gov | Yes (for NEVI/AFDC station data) | Yes |
| `SOCRATA_APP_TOKEN` | dev.socrata.com | Yes (for SODA3 API) | Yes |
| `SAM_GOV_API_KEY` | Already exists (not configured) | Yes | Yes |
| `DSIRE_API_KEY` | dsireusa.org | No (future, paid subscription) | No |

**Existing env vars that now need to be configured:**
- `SAM_GOV_API_KEY` -- listed as "not configured" in known issues; required for multi-industry SAM.gov queries
- `GOOGLE_MAPS_API_KEY` -- already exists; ensure Drawing Library is enabled in Google Cloud Console

### PostGIS Database Extension

```sql
-- Run once on Neon:
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Schema Changes Required

| Table | Change | Purpose |
|-------|--------|---------|
| `leads` | Add `location geometry(Point, 4326)` column | PostGIS spatial queries |
| `leads` | Add `content_hash text` column | Fast dedup pre-filter |
| `leads` | Add GiST index on `location` | Spatial query performance |
| `leads` | Add index on `content_hash` | Hash lookup performance |
| `leads` | Add `industry text` column | Multi-industry classification |
| `company_profiles` | Add `industry text` column | User's industry vertical |
| `company_profiles` | Add `location geometry(Point, 4326)` column | PostGIS-based proximity |
| `company_profiles` | Add `service_area geometry(Polygon, 4326)` (future) | Polygon service areas |

---

## API Endpoint Reference

Quick reference for all external APIs the scraper adapters will call:

| API | Base URL | Auth | Key Param |
|-----|----------|------|-----------|
| NWS Alerts | `https://api.weather.gov/alerts/active` | User-Agent header | `area`, `severity` |
| NOAA Storm CSV | `https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/` | None | HTTP directory listing |
| FEMA OpenFEMA | `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries` | None | `$filter`, `$top` |
| SAM.gov | `https://api.sam.gov/opportunities/v2/search` | `api_key` param | `ncode`, `limit` |
| Socrata SODA | `https://{domain}/resource/{dataset_id}.json` (v2) or `/api/v3/views/{id}/query.json` (v3) | App token header | `$where`, `$limit` |
| NREL AFDC | `https://developer.nlr.gov/api/alt-fuel-stations/v1.json` | `api_key` param | `fuel_type`, `state` |
| EIA Electricity | `https://api.eia.gov/v2/electricity/retail-sales/data` | `api_key` param | `data[]`, `facets[]` |
| DSIRE (scrape) | `https://programs.dsireusa.org/system/program` | None (public pages) | Crawlee browser scraping |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `p-queue@^8.1.0` | Node.js 18+, ESM only | Next.js App Router supports ESM natively |
| `papaparse@^5.5.2` | Node.js 14+, CommonJS + ESM | Wide compatibility |
| `postgis` (extension) | Neon serverless PostgreSQL | Fully supported, enable via SQL |
| `drizzle-orm@^0.45.1` `geometry()` type | PostGIS on Neon | Native support since Drizzle 0.31 |
| `@vis.gl/react-google-maps@^1.7.1` | Google Maps Drawing Library | Use `useMapsLibrary('drawing')` |

---

## Sources

- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api) -- alerts endpoint, OpenAPI spec (HIGH confidence)
- [NWS Alerts Web Service](https://www.weather.gov/documentation/services-web-alerts) -- alert filtering (HIGH confidence)
- [NOAA Storm Events CSV Files](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/) -- bulk data download (HIGH confidence)
- [FEMA OpenFEMA API Documentation](https://www.fema.gov/about/openfema/api) -- disaster declarations, query syntax (HIGH confidence)
- [FEMA Disaster Declarations Summaries v2](https://www.fema.gov/openfema-data-page/disaster-declarations-summaries-v2) -- dataset details (HIGH confidence)
- [SAM.gov Get Opportunities Public API](https://open.gsa.gov/api/get-opportunities-public-api/) -- NAICS filtering, endpoint (HIGH confidence)
- [Socrata SODA API Developer Docs](https://dev.socrata.com/docs/endpoints.html) -- endpoint structure, SODA3 changes (HIGH confidence)
- [Socrata Discovery API](https://dev.socrata.com/docs/other/discovery) -- finding datasets across portals (MEDIUM confidence)
- [DSIRE API Page](https://www.dsireusa.org/dsire-api/) -- paid subscription required (LOW confidence on pricing/endpoints)
- [NREL Alternative Fuel Stations API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/) -- NEVI station data (HIGH confidence)
- [EIA API v2 Documentation](https://www.eia.gov/opendata/documentation.php) -- electricity retail sales endpoint (HIGH confidence)
- [NREL Utility Rates API v3](https://developer.nlr.gov/docs/electricity/utility-rates-v3/) -- DATA FROM 2012 ONLY, DO NOT USE (HIGH confidence it's outdated)
- [Neon PostGIS Extension](https://neon.com/docs/extensions/postgis) -- enabling PostGIS on Neon (HIGH confidence)
- [Drizzle ORM PostGIS Geometry Point](https://orm.drizzle.team/docs/guides/postgis-geometry-point) -- native geometry type, insert/query patterns (HIGH confidence)
- [Drizzle ORM Cursor-Based Pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) -- official guide (HIGH confidence)
- [p-queue GitHub](https://github.com/sindresorhus/p-queue) -- rate limiting library (HIGH confidence)
- [vis.gl/react-google-maps Drawing Tools](https://sudolabs.com/insights/react-google-maps-drawing-tools) -- DrawingManager integration (MEDIUM confidence)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html) -- built-in SHA-256 hashing (HIGH confidence)

---
*Stack research for: LeadForge v3.0 multi-industry expansion*
*Researched: 2026-03-16*
