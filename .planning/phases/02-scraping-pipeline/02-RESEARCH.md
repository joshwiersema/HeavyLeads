# Phase 2: Scraping Pipeline - Research

**Researched:** 2026-03-13
**Domain:** Web scraping, open data APIs, geocoding, PostgreSQL spatial queries
**Confidence:** HIGH

## Summary

Phase 2 builds an automated scraping pipeline that collects building permit data from U.S. city open data portals, geocodes the results, and stores structured lead records in PostgreSQL. The primary data sources are Socrata-powered open data APIs (Austin, Dallas) and CKAN portals, which provide structured JSON endpoints -- meaning most "scraping" is actually API consumption via HTTP, not HTML parsing. Crawlee (CheerioCrawler) provides the framework scaffolding for request management, retries, and rate limiting, and is well-suited for both API consumption and any HTML-based scrapers needed in the future.

The existing codebase uses Drizzle ORM with Neon PostgreSQL. PostGIS is available on Neon and should be enabled to support radius-based geographic queries (required for DATA-07 and downstream Phase 3 work). The existing `geocodeAddress()` utility in `src/lib/geocoding.ts` can be reused with minor adaptation for batch processing with rate-limit awareness.

**Primary recommendation:** Build a pluggable adapter system where each jurisdiction implements a common TypeScript interface. Use Crawlee's CheerioCrawler as the execution engine. Prefer Socrata SODA API endpoints for cities that offer them (Austin, Dallas), and add a third source from a different portal type for diversity. Store leads with PostGIS geometry points for efficient spatial queries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No explicit locked decisions -- all implementation is at Claude's discretion per user request for autonomous execution.

### Claude's Discretion
All implementation decisions for this phase are at Claude's discretion. User requested autonomous execution with no consultation. The following guidelines apply:

- **Scraper framework**: Use Crawlee (Node.js) for the scraping framework -- pluggable, well-maintained, handles rate limiting and retries
- **Target jurisdictions**: Select 3-5 U.S. jurisdictions with publicly accessible online permit databases, prioritizing municipalities near heavy machinery market centers (e.g., Houston TX, Dallas TX, Phoenix AZ, Atlanta GA, Chicago IL metro areas)
- **Data storage**: Store scraped leads in a tenant-agnostic `leads` table -- match to tenants at query time based on geography and equipment types (pipeline-first architecture per roadmap decision)
- **Pluggable adapter pattern**: Each jurisdiction scraper implements a common adapter interface so new sources can be added without modifying framework code
- **Scheduling**: Use node-cron or similar for daily scheduling -- simple, in-process, no external infrastructure needed for MVP
- **Geocoding**: Reuse the Google Maps Geocoding API already configured in Phase 1 for address-to-coordinates conversion on each lead
- **Freshness tracking**: Each lead record carries `scrapedAt` timestamp and `sourceUrl` for attribution
- **Deduplication**: Basic dedup within a single source by permit number/ID -- cross-source dedup is Phase 4
- **Error handling**: Log scraper failures per jurisdiction, continue with remaining sources -- don't let one failing source block the entire pipeline
- **Data model**: Lead records include: permit number, project description, address, lat/lng, project type, estimated value (if available), applicant/contractor name, permit date, source jurisdiction, scraped timestamp

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | System scrapes building permit data from city/county databases for target jurisdictions | Crawlee + Socrata SODA API adapters for Austin (3syk-w9eu), Dallas (e7gq-4sah), plus one HTML-based source; pluggable adapter interface pattern |
| DATA-05 | System runs scraping pipeline on a daily schedule and marks data with freshness timestamps | node-cron for in-process daily scheduling; `scrapedAt` timestamp column on leads table |
| DATA-07 | System geocodes lead locations for radius-based geographic filtering | Reuse existing `geocodeAddress()` utility with batch processing; PostGIS geometry point column + GiST index for radius queries via `ST_DWithin` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crawlee | ^3.16.0 | Scraper framework with request management, retries, rate limiting | Industry-standard Node.js scraping framework; handles anti-bot, queuing, concurrency |
| node-cron | ^3.0.0 | In-process cron-style task scheduling | Lightweight, zero infrastructure, familiar cron syntax, timezone support |
| drizzle-orm | ^0.45.1 (existing) | Database ORM for leads table schema | Already in project; schema-first, TypeScript-native |
| @neondatabase/serverless | ^1.0.2 (existing) | PostgreSQL client for Neon | Already in project |
| zod | ^4.3.6 (existing) | Validation of scraped data before DB insertion | Already in project; ensures data quality at ingestion boundary |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostGIS (pg extension) | N/A | Spatial queries (radius filtering) | Enable via `CREATE EXTENSION postgis;` on Neon -- needed for geometry columns and `ST_DWithin` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Crawlee CheerioCrawler | Plain fetch + cheerio | Crawlee adds retry logic, concurrency control, request queuing, and anti-detection headers out of the box; plain fetch requires building all of this manually |
| node-cron | Vercel Cron / external scheduler | node-cron is simpler for MVP, no infrastructure dependency; Vercel Cron better for production serverless but adds complexity |
| PostGIS geometry | Plain lat/lng with Haversine SQL | PostGIS is available on Neon, provides indexed spatial queries, and is the correct tool; Haversine works but doesn't use spatial indexes |
| soda-js (Socrata client) | Direct fetch to SODA endpoints | soda-js is 8 years old and unmaintained; direct fetch with typed responses is simpler and more maintainable |

**Installation:**
```bash
npm install crawlee node-cron
npm install -D @types/node-cron
```

Note: Crawlee pulls in cheerio, got-scraping, and other dependencies automatically. The `crawlee` package is a meta-package that includes CheerioCrawler.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    scraper/
      adapters/                  # Jurisdiction-specific adapters
        base-adapter.ts          # Abstract base class / interface
        austin-permits.ts        # Austin TX Socrata SODA adapter
        dallas-permits.ts        # Dallas TX Socrata SODA adapter
        [third-source].ts        # Third jurisdiction adapter
      pipeline.ts                # Orchestrator: runs all adapters, handles errors
      scheduler.ts               # node-cron scheduling setup
      types.ts                   # Shared types (RawPermitData, LeadRecord, etc.)
    db/
      schema/
        leads.ts                 # Leads table schema with PostGIS geometry
      migrations/                # Drizzle migrations (existing dir)
    geocoding.ts                 # Existing -- reuse for lead geocoding
```

### Pattern 1: Pluggable Adapter Interface
**What:** Each jurisdiction scraper implements a common interface. The pipeline iterates over registered adapters, runs each, collects results, and stores them.
**When to use:** Always -- this is the core extensibility pattern required by the success criteria.
**Example:**
```typescript
// src/lib/scraper/adapters/base-adapter.ts
import { z } from 'zod';

export const rawPermitSchema = z.object({
  permitNumber: z.string(),
  description: z.string().optional(),
  address: z.string(),
  projectType: z.string().optional(),
  estimatedValue: z.number().optional(),
  applicantName: z.string().optional(),
  permitDate: z.date().optional(),
  sourceUrl: z.string(),
});

export type RawPermitData = z.infer<typeof rawPermitSchema>;

export interface ScraperAdapter {
  /** Unique identifier for this source */
  readonly sourceId: string;
  /** Human-readable name */
  readonly sourceName: string;
  /** Jurisdiction (city/county) */
  readonly jurisdiction: string;
  /** Fetch permits from this source, returning validated records */
  scrape(): Promise<RawPermitData[]>;
}
```

### Pattern 2: Socrata SODA API Adapter
**What:** For cities using Socrata, fetch permit data via JSON API with SoQL filtering -- no HTML scraping needed.
**When to use:** Austin TX, Dallas TX, and many other U.S. cities with Socrata-powered portals.
**Example:**
```typescript
// src/lib/scraper/adapters/austin-permits.ts
import type { ScraperAdapter, RawPermitData } from './base-adapter';

export class AustinPermitsAdapter implements ScraperAdapter {
  readonly sourceId = 'austin-tx-permits';
  readonly sourceName = 'City of Austin Issued Construction Permits';
  readonly jurisdiction = 'Austin, TX';

  private readonly endpoint = 'https://data.austintexas.gov/resource/3syk-w9eu.json';

  async scrape(): Promise<RawPermitData[]> {
    // Fetch recent permits using SoQL $where filter
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const url = new URL(this.endpoint);
    url.searchParams.set('$where', `issue_date > '${dateStr}'`);
    url.searchParams.set('$limit', '1000');
    url.searchParams.set('$order', 'issue_date DESC');

    const response = await fetch(url.toString());
    const data = await response.json();

    return data.map((record: Record<string, unknown>) => ({
      permitNumber: record.permit_number as string,
      description: record.description as string,
      address: record.permit_location as string,
      projectType: record.permit_type_desc as string,
      applicantName: undefined, // Not in this dataset
      permitDate: record.issue_date ? new Date(record.issue_date as string) : undefined,
      estimatedValue: undefined, // Not in this dataset
      sourceUrl: `${this.endpoint}?permit_number=${record.permit_number}`,
    }));
  }
}
```

### Pattern 3: Pipeline Orchestrator with Error Isolation
**What:** Run each adapter independently, catch errors per-adapter, aggregate results, and geocode + store.
**When to use:** Always -- ensures one failing source does not block others.
**Example:**
```typescript
// src/lib/scraper/pipeline.ts
import type { ScraperAdapter, RawPermitData } from './adapters/base-adapter';

interface PipelineResult {
  sourceId: string;
  recordsProcessed: number;
  errors: string[];
}

export async function runPipeline(adapters: ScraperAdapter[]): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (const adapter of adapters) {
    try {
      const records = await adapter.scrape();
      // Validate, geocode, dedup, and store each batch
      const stored = await processRecords(adapter.sourceId, records);
      results.push({ sourceId: adapter.sourceId, recordsProcessed: stored, errors: [] });
    } catch (error) {
      console.error(`[scraper] ${adapter.sourceId} failed:`, error);
      results.push({
        sourceId: adapter.sourceId,
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return results;
}
```

### Pattern 4: Leads Table with PostGIS Geometry
**What:** Store lead locations as PostGIS geometry points with a GiST spatial index for efficient radius queries.
**When to use:** Required for DATA-07 and downstream Phase 3 radius filtering.
**Example:**
```typescript
// src/lib/db/schema/leads.ts
import {
  pgTable, text, real, uuid, timestamp, index, integer,
} from 'drizzle-orm/pg-core';
import { geometry } from 'drizzle-orm/pg-core';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  permitNumber: text('permit_number').notNull(),
  description: text('description'),
  address: text('address').notNull(),
  formattedAddress: text('formatted_address'),
  location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }),
  lat: real('lat'),
  lng: real('lng'),
  projectType: text('project_type'),
  estimatedValue: integer('estimated_value'),
  applicantName: text('applicant_name'),
  permitDate: timestamp('permit_date'),
  sourceId: text('source_id').notNull(),
  sourceJurisdiction: text('source_jurisdiction').notNull(),
  sourceUrl: text('source_url'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('leads_location_idx').using('gist', t.location),
  index('leads_source_permit_idx').on(t.sourceId, t.permitNumber),
  index('leads_scraped_at_idx').on(t.scrapedAt),
]);
```

### Anti-Patterns to Avoid
- **Monolithic scraper function:** Do not put all jurisdiction logic in one file. Each source must be its own adapter implementing the interface.
- **Storing lat/lng as plain floats without PostGIS:** This works for display but forces full-table-scan Haversine calculations for radius queries. PostGIS with GiST index is the correct approach.
- **Synchronous geocoding in the scrape loop:** Geocoding API has rate limits (50 req/s, 10k free/month). Batch and throttle geocoding calls.
- **Ignoring dedup on re-runs:** Without dedup by permit number + source, daily runs create duplicates. Always upsert or check-before-insert.
- **Using soda-js:** The official Socrata JS client is 8+ years unmaintained. Use direct fetch with typed schemas instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request retries & rate limiting | Custom retry/backoff logic | Crawlee's built-in retry + maxConcurrency | Crawlee handles 3 retries by default, respects rate limits, rotates sessions |
| Anti-bot detection headers | Manual User-Agent rotation | Crawlee's got-scraping client | Automatically generates realistic browser-like headers and TLS fingerprints |
| Cron expression parsing | Custom schedule parser | node-cron with standard crontab syntax | Battle-tested, supports timezones, validates expressions |
| Spatial distance queries | Haversine formula in SQL | PostGIS `ST_DWithin` with geography cast | PostGIS uses spatial indexes, handles edge cases (date line, poles), is 10-100x faster at scale |
| Socrata API client | Custom query builder | Direct fetch with `$where`, `$limit`, `$offset` params | SODA API is simple REST; no client library needed; soda-js is abandoned |

**Key insight:** Most of the "scraping" in this phase is actually structured API consumption from Socrata SODA endpoints. True HTML scraping is only needed for jurisdictions without open data APIs. Crawlee provides the framework structure and retry management, but the actual data extraction is JSON parsing, not DOM traversal.

## Common Pitfalls

### Pitfall 1: Geocoding Rate Limits and Cost
**What goes wrong:** Calling Google Maps Geocoding API for every scraped record on every run, hitting rate limits or racking up costs.
**Why it happens:** Naive implementation geocodes every record without caching.
**How to avoid:** Only geocode records that don't already have coordinates (many Socrata datasets include lat/lng -- Austin does). For records that need geocoding, batch process with throttling (e.g., 40 req/s to stay under 50/s limit). Cache results to avoid re-geocoding on re-runs.
**Warning signs:** `OVER_QUERY_LIMIT` errors from Google API, unexpectedly high billing.

### Pitfall 2: Socrata API Pagination
**What goes wrong:** Only getting the first page of results (default 1000 records) and missing older permits.
**Why it happens:** SODA API paginates by default, returning max 50,000 per page but typically 1000 by default.
**How to avoid:** Use `$limit` and `$offset` parameters, or filter by date range with `$where` to keep result sets manageable. For daily runs, filtering to permits issued in the last 30 days keeps volumes low.
**Warning signs:** Getting exactly 1000 records every run (default page size).

### Pitfall 3: Schema Drift in Source Data
**What goes wrong:** A city changes their data portal field names or structure, breaking the adapter silently.
**Why it happens:** Open data portals update without notice.
**How to avoid:** Validate scraped data with Zod schemas before insertion. Log validation failures prominently. Make field mappings explicit in each adapter so changes are easy to identify.
**Warning signs:** Sudden zero-record scrapes, increased Zod validation errors.

### Pitfall 4: Duplicate Records on Re-runs
**What goes wrong:** Daily pipeline inserts the same permits repeatedly, creating duplicates.
**Why it happens:** No dedup check before insert; overlapping date ranges across runs.
**How to avoid:** Use composite unique constraint on `(sourceId, permitNumber)` and upsert (`ON CONFLICT DO UPDATE` or check-before-insert). The index `leads_source_permit_idx` supports this.
**Warning signs:** Lead count growing much faster than expected, identical permit numbers appearing multiple times.

### Pitfall 5: PostGIS Extension Not Enabled
**What goes wrong:** Migration fails because `geometry` type is not recognized.
**Why it happens:** PostGIS must be explicitly enabled on the Neon database before running migrations that use geometry columns.
**How to avoid:** Create a migration that runs `CREATE EXTENSION IF NOT EXISTS postgis;` before the leads table migration. Neon supports PostGIS on all plans -- it just needs to be enabled.
**Warning signs:** Migration error: `type "geometry" does not exist`.

### Pitfall 6: Crawlee Storage Defaults
**What goes wrong:** Crawlee creates a `./storage` directory in the project root with request queues and datasets.
**Why it happens:** Crawlee's default local storage is file-system based.
**How to avoid:** Since we are storing data directly in PostgreSQL (not using Crawlee's Dataset), configure Crawlee with `persistStorage: false` or use in-memory storage. Add `storage/` to `.gitignore`.
**Warning signs:** Unexpected `storage/` directory appearing in the project root.

## Code Examples

### Radius Query with PostGIS and Drizzle
```typescript
// Find leads within X miles of a point
// Source: Drizzle ORM PostGIS guide (https://orm.drizzle.team/docs/guides/postgis-geometry-point)
import { sql } from 'drizzle-orm';
import { leads } from './db/schema/leads';
import { db } from './db';

async function findLeadsInRadius(
  centerLat: number,
  centerLng: number,
  radiusMiles: number
) {
  const radiusMeters = radiusMiles * 1609.34;
  const centerPoint = sql`ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)`;

  return db
    .select()
    .from(leads)
    .where(
      sql`ST_DWithin(
        ${leads.location}::geography,
        ${centerPoint}::geography,
        ${radiusMeters}
      )`
    )
    .orderBy(sql`${leads.location} <-> ${centerPoint}`);
}
```

### Daily Scheduler Setup
```typescript
// src/lib/scraper/scheduler.ts
import cron from 'node-cron';
import { runPipeline } from './pipeline';
import { getRegisteredAdapters } from './adapters';

export function startScheduler() {
  // Run daily at 6:00 AM UTC
  cron.schedule('0 6 * * *', async () => {
    console.log('[scheduler] Starting daily scraping pipeline...');
    const results = await runPipeline(getRegisteredAdapters());
    for (const result of results) {
      console.log(
        `[scheduler] ${result.sourceId}: ${result.recordsProcessed} records, ${result.errors.length} errors`
      );
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[scheduler] Daily scraping pipeline scheduled at 06:00 UTC');
}
```

### Socrata SODA API Fetch with Pagination
```typescript
// Utility for fetching from Socrata SODA endpoints
async function fetchSocrataDataset(
  endpoint: string,
  whereClause: string,
  limit = 1000
): Promise<Record<string, unknown>[]> {
  const allRecords: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(endpoint);
    url.searchParams.set('$where', whereClause);
    url.searchParams.set('$limit', String(limit));
    url.searchParams.set('$offset', String(offset));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Socrata API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;

    allRecords.push(...data);
    if (data.length < limit) break; // Last page
    offset += limit;
  }

  return allRecords;
}
```

### Geocoding with Throttle for Batch Processing
```typescript
// Batch geocoding with rate limiting
import { geocodeAddress } from '../geocoding';

async function geocodeLeads(
  records: Array<{ address: string; lat?: number; lng?: number }>,
  delayMs = 25 // ~40 req/s, safely under 50/s limit
) {
  for (const record of records) {
    // Skip if coordinates already present (e.g., from Socrata dataset)
    if (record.lat && record.lng) continue;

    try {
      const result = await geocodeAddress(record.address);
      record.lat = result.lat;
      record.lng = result.lng;
    } catch (error) {
      console.warn(`[geocoding] Failed for "${record.address}":`, error);
      // Leave lat/lng as undefined -- record is still stored, just not geocoded
    }

    // Throttle to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| soda-js Socrata client | Direct fetch to SODA REST endpoints | soda-js abandoned ~2018 | Use native fetch with typed schemas |
| Puppeteer for all scraping | CheerioCrawler for API/HTML, Playwright only for JS-rendered pages | Crawlee v3 (2023) | Much faster, lower resource usage for non-JS pages |
| Plain lat/lng with Haversine | PostGIS geometry with ST_DWithin | Always available, Neon added PostGIS support | 10-100x faster radius queries with spatial index |
| Google Maps $200/month credit | Per-SKU free tiers (10k geocoding/month) | March 2025 | Plan geocoding budget; 10k free is sufficient for MVP |

**Deprecated/outdated:**
- `soda-js` npm package: Last published 8+ years ago, written in CoffeeScript. Do not use.
- Crawlee v1/v2 patterns: v3 introduced major API changes. All examples should use v3+ Router pattern.
- Google Maps $200 credit model: Replaced March 2025 with per-SKU free thresholds.

## Target Jurisdictions

### Recommended Sources (3 for MVP)

| # | City | Portal Type | API Format | Dataset ID | Confidence |
|---|------|-------------|------------|------------|------------|
| 1 | Austin, TX | Socrata | JSON REST | `3syk-w9eu` | HIGH -- verified fields: permit_number, permit_location, description, permit_type_desc, issue_date, latitude, longitude |
| 2 | Dallas, TX | Socrata | JSON REST | `e7gq-4sah` | HIGH -- verified fields: permit_number, permit_type, street_address, work_description, value, issued_date, contractor |
| 3 | Atlanta, GA | ArcGIS Open Data Hub | GeoJSON / CSV | `655f985f43cc40b4bf2ab7bc73d2169b` | MEDIUM -- building permits 2019-2024, Accela data, all statuses; needs field verification |

### Why These Three
- **Austin** and **Dallas** use Socrata with well-documented SODA APIs, making them reliable and easy to implement. Both are major Texas metros near heavy machinery markets.
- **Atlanta** uses an ArcGIS-based portal which provides a different adapter type, demonstrating the pluggable pattern. It is a major Southeast construction market.
- **Houston** was investigated but its open data portal (CKAN-based) only has a summary-level residential permits dataset (monthly/yearly aggregates, not individual permits). Not suitable for lead generation. Can be revisited if individual permit data becomes available.
- **Phoenix** has a CKAN portal with CSV-only building permit data sourced from HUD (last updated 2023). Not suitable for daily scraping.

### Key Fields Available per Source

**Austin (Socrata):**
- `permit_number`, `permit_type_desc`, `permit_class_mapped` (Commercial/Residential), `description`, `permit_location`, `latitude`, `longitude`, `issue_date`, `status_current`, `jurisdiction`

**Dallas (Socrata):**
- `permit_number`, `permit_type`, `street_address`, `work_description`, `value`, `contractor`, `issued_date`, `land_use`, `zip_code`
- Note: Dallas does NOT include lat/lng -- geocoding required for all Dallas records

**Atlanta (ArcGIS):**
- Fields need verification at implementation time. Expected: permit number, address, type, status, dates. May include coordinates from GIS system.

## Open Questions

1. **Atlanta ArcGIS API exact endpoint and field names**
   - What we know: Dataset exists at `dpcd-coaplangis.opendata.arcgis.com`, covers 2019-2024
   - What's unclear: Exact REST API endpoint format, available fields, pagination method
   - Recommendation: Verify during implementation by hitting the ArcGIS REST endpoint; if problematic, substitute with another Socrata city (e.g., Chicago, San Francisco)

2. **Crawlee storage interaction with Next.js**
   - What we know: Crawlee creates a `./storage` directory by default for request queues and datasets
   - What's unclear: Whether this conflicts with Next.js build/dev processes
   - Recommendation: Configure Crawlee to use in-memory storage or disable persistence since we store data in PostgreSQL directly. Add `storage/` to `.gitignore`.

3. **Scheduler execution context in Next.js**
   - What we know: node-cron runs in-process; Next.js is the primary process
   - What's unclear: Whether node-cron persists correctly in Next.js dev mode with hot reloading, and in production serverless deployments
   - Recommendation: For MVP, run the scheduler in a separate Node.js script invoked alongside `next start`. Provide an API route for manual triggering during development. For production, consider migrating to Vercel Cron or similar in a later phase.

4. **PostGIS `geometry` column type in Drizzle ORM**
   - What we know: Drizzle ORM v0.45+ supports `geometry()` column type with `type: 'point'`, `mode: 'xy'`, `srid: 4326`
   - What's unclear: Whether the Neon serverless driver handles PostGIS types without issues
   - Recommendation: Test with a simple insert/select during implementation; fallback is to store as plain `real` columns and add PostGIS later if issues arise

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/scraper/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Scrapes building permits from at least 3 jurisdictions | unit | `npx vitest run tests/scraper/adapters.test.ts -t "scrapes permits"` | No -- Wave 0 |
| DATA-01 | Adapter interface enforced on all scrapers | unit | `npx vitest run tests/scraper/adapters.test.ts -t "implements interface"` | No -- Wave 0 |
| DATA-01 | Scraped data validated with Zod schema | unit | `npx vitest run tests/scraper/validation.test.ts` | No -- Wave 0 |
| DATA-05 | Pipeline runs all adapters and aggregates results | unit | `npx vitest run tests/scraper/pipeline.test.ts -t "runs pipeline"` | No -- Wave 0 |
| DATA-05 | Each record carries scrapedAt timestamp | unit | `npx vitest run tests/scraper/pipeline.test.ts -t "freshness timestamp"` | No -- Wave 0 |
| DATA-05 | Scheduler configured with valid cron expression | unit | `npx vitest run tests/scraper/scheduler.test.ts` | No -- Wave 0 |
| DATA-07 | Leads geocoded to coordinates | unit | `npx vitest run tests/scraper/geocoding.test.ts` | No -- Wave 0 |
| DATA-07 | Leads table has PostGIS geometry column with GiST index | unit | `npx vitest run tests/scraper/schema.test.ts` | No -- Wave 0 |
| DATA-01 | New adapters addable without modifying framework | unit | `npx vitest run tests/scraper/adapters.test.ts -t "pluggable"` | No -- Wave 0 |
| DATA-01 | One failing adapter does not block others | unit | `npx vitest run tests/scraper/pipeline.test.ts -t "error isolation"` | No -- Wave 0 |
| DATA-01 | Dedup by permitNumber + sourceId prevents duplicates | unit | `npx vitest run tests/scraper/pipeline.test.ts -t "dedup"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/adapters.test.ts` -- covers DATA-01 adapter interface and scraping
- [ ] `tests/scraper/pipeline.test.ts` -- covers DATA-01 error isolation, DATA-05 scheduling, dedup
- [ ] `tests/scraper/validation.test.ts` -- covers DATA-01 Zod validation
- [ ] `tests/scraper/geocoding.test.ts` -- covers DATA-07 geocoding
- [ ] `tests/scraper/schema.test.ts` -- covers DATA-07 PostGIS schema
- [ ] `tests/scraper/scheduler.test.ts` -- covers DATA-05 cron scheduling
- [ ] `tests/helpers/scraper.ts` -- shared test fixtures (mock permit data, mock adapters)

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM PostGIS Guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point) -- PostGIS geometry column definition, spatial index, distance queries
- [Drizzle ORM Point Datatype Guide](https://orm.drizzle.team/docs/guides/point-datatype-psql) -- Point column modes (xy, tuple)
- [Neon PostGIS Extension Docs](https://neon.com/docs/extensions/postgis) -- PostGIS availability and enablement on Neon
- [Austin Socrata API](https://data.austintexas.gov/resource/3syk-w9eu.json) -- Verified field names and data format via live API call
- [Dallas Socrata API](https://www.dallasopendata.com/resource/e7gq-4sah.json) -- Verified field names and data format via live API call
- [Crawlee Quick Start](https://crawlee.dev/js/docs/quick-start) -- Installation, CheerioCrawler setup, basic usage
- [Crawlee CheerioCrawler Guide](https://crawlee.dev/js/docs/guides/cheerio-crawler-guide) -- Performance characteristics, configuration

### Secondary (MEDIUM confidence)
- [Socrata SODA API Docs](https://dev.socrata.com/docs/queries/) -- SoQL query syntax, pagination ($limit/$offset)
- [Google Maps Geocoding Usage & Billing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing) -- Rate limits (50 req/s), free tier (10k/month as of March 2025)
- [Atlanta Building Permits ArcGIS Hub](https://dpcd-coaplangis.opendata.arcgis.com/datasets/655f985f43cc40b4bf2ab7bc73d2169b) -- Dataset existence confirmed, field details need implementation-time verification
- [Crawlee Router API](https://crawlee.dev/js/api/core/class/Router) -- Router.create, addHandler, addDefaultHandler patterns
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- Cron syntax, timezone support, task management

### Tertiary (LOW confidence)
- [Phoenix Open Data Portal](https://www.phoenixopendata.com/dataset/phoenix-az-building-permit-data) -- CKAN portal, CSV only, HUD-sourced data last updated 2023; not suitable for daily scraping
- [Houston Open Data Portal](https://data.houstontx.gov/) -- CKAN portal, only summary-level residential permit data available; not suitable for lead generation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Crawlee, node-cron, Drizzle, PostGIS are all well-documented and verified
- Architecture: HIGH -- Pluggable adapter pattern is standard for multi-source scraping; PostGIS spatial queries are documented by Drizzle
- Data sources: HIGH for Austin/Dallas (live API verified), MEDIUM for Atlanta (dataset confirmed, fields unverified)
- Pitfalls: HIGH -- geocoding limits, pagination, dedup are well-known issues with documented solutions

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain; data portal endpoints may change without notice)
