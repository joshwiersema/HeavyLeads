# Phase 16: Cron & Scraper Architecture - Research

**Researched:** 2026-03-16
**Domain:** Scraper pipeline refactoring, cron scheduling, rate limiting, content-hash dedup, Socrata SODA3, SAM.gov multi-industry
**Confidence:** HIGH

## Summary

Phase 16 refactors the existing scraper infrastructure from a monolithic single-cron pipeline to a per-industry architecture with proper rate limiting, content-hash deduplication, and health monitoring. The existing codebase has a solid foundation -- `pipeline.ts` already accepts adapters as arguments (not from the registry), `scraper_runs` table already exists in the schema, and the `contentHash` column is already on the leads table with a partial unique index. The primary work is (1) replacing the mutable global Map registry with a factory pattern, (2) creating per-industry cron routes, (3) integrating p-queue for API rate limiting, (4) migrating the Austin permits adapter to SODA3, (5) implementing SHA-256 content hashing in the pipeline, and (6) wiring scraper_runs tracking into the pipeline execution.

The critical finding is that Vercel cron jobs do NOT have concurrency protection built in -- if multiple crons fire at the same time, they all execute as independent serverless function invocations. This means per-industry crons scheduled at the same time will run concurrently with no built-in coordination. This is actually desirable for our use case (independent industry pipelines), but requires that shared resources like SAM.gov's 1,000 req/day limit be allocated statically across industries rather than dynamically competed for. The Vercel Pro plan supports up to 100 crons per project with per-minute scheduling precision, which is more than sufficient.

**Primary recommendation:** Replace the global Map registry with industry-keyed factory functions, introduce p-queue for per-API rate limiting, add SHA-256 content hashing as a pre-insert dedup fast path (supplementary to existing proximity dedup), migrate Austin permits to SODA3, and wire scraper_runs recording into each adapter execution within pipeline.ts.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-01 | Scraper registry maps industries to adapter sets via factory pattern | Factory pattern replaces mutable global Map; per-industry functions return adapter arrays; pipeline.ts already accepts adapters as args |
| SCRP-02 | Content-hash deduplication (SHA-256) for primary dedup | leads.contentHash column + unique index already exist; compute SHA-256 of normalized (title + address + sourceId) before insert; use as fast-path pre-filter before proximity dedup |
| SCRP-03 | Rate limiter using p-queue with per-API concurrency and interval controls | p-queue ^8.1.0 ESM-only; use dynamic import or serverExternalPackages; per-API queue instances with intervalCap + interval config |
| SCRP-04 | Permit scraper factory generalized for Socrata/SODA3 multi-city support | SODA3 endpoint: /api/v3/views/IDENTIFIER/query.json; POST with SoQL; requires X-App-Token header; create SocrataPermitAdapter base class |
| SCRP-05 | SAM.gov adapter expanded with per-industry NAICS code filtering | Existing adapter loops through NAICS codes; expand to industry-specific lists; 1000 req/day limit requires static budget allocation across industries |
| CRON-01 | Per-industry scrape crons (parameterized route) | Vercel supports dynamic route crons; /api/cron/scrape/[industry]/route.ts; 5 separate entries in vercel.json with staggered schedules |
| CRON-03 | Lead enrichment cron (runs after scraping) | Enrichment computes applicableIndustries, valueTier, severity from lead data; runs as post-pipeline step or separate cron |
| CRON-04 | Lead expiration cron (mark stale leads) | Leads older than 90 days (permits) or past deadline (bids) marked as expired; batch UPDATE with WHERE clause |
| CRON-07 | Scraper health monitoring cron | Query scraper_runs for recent failures, alert thresholds; circuit breaker pattern for 3 consecutive failures |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| p-queue | ^8.1.0 | Per-API rate limiting with concurrency + interval controls | Industry standard for sliding-window rate limiting in Node.js; ESM-only, compatible with Next.js App Router server-side code via dynamic import |
| Node.js crypto | built-in | SHA-256 content hashing | Zero-dependency, built into Node.js runtime; `createHash('sha256').update(str).digest('hex')` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 (existing) | Database operations for scraper_runs tracking | Already in stack; use for all DB operations |
| zod | ^4.3.6 (existing) | Response validation for external APIs | Use `.passthrough()` to prevent unexpected fields from rejecting valid records |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-queue | bottleneck | bottleneck is more full-featured but 3x larger, unmaintained since 2020; p-queue is actively maintained |
| p-queue | Custom rate limiter | Existing codebase has no rate limiting for external APIs; p-queue handles edge cases (sliding windows, backpressure) that are easy to get wrong |
| SHA-256 content hash | xxhash/murmurhash | SHA-256 is fast enough for our volume (<5K leads/day) and built-in; no dependency needed |

**Installation:**
```bash
npm install p-queue
```

**ESM Import Note:** p-queue is ESM-only. In Next.js App Router server code (route handlers, server actions), use dynamic import:
```typescript
const { default: PQueue } = await import('p-queue');
```
Alternatively, add `p-queue` to `serverExternalPackages` in `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['p-queue'],
};
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/scraper/
  adapters/
    base-adapter.ts          # Existing -- add contentHash to RawLeadData
    socrata-permit-adapter.ts # NEW -- base class for Socrata/SODA3 cities
    austin-permits.ts         # MODIFY -- extend SocrataPermitAdapter
    dallas-permits.ts         # MODIFY -- extend SocrataPermitAdapter
    atlanta-permits.ts        # Existing (ArcGIS, not Socrata)
    sam-gov-bids.ts           # MODIFY -- add per-industry NAICS
    enr-news.ts               # Existing
    construction-dive-news.ts # Existing
    prnewswire-news.ts        # Existing
    google-dorking.ts         # Existing
    utils.ts                  # Existing
    index.ts                  # REWRITE -- factory functions replace initializeAdapters
  pipeline.ts               # MODIFY -- integrate content hash + scraper_runs
  registry.ts               # DELETE or deprecate -- replaced by factory
  dedup.ts                  # Existing proximity dedup (unchanged)
  rate-limit.ts             # Existing per-org rate limit (unchanged)
  api-rate-limiter.ts       # NEW -- p-queue wrappers per external API
  content-hash.ts           # NEW -- SHA-256 hash computation
  types.ts                  # MODIFY -- add industry to PipelineResult
  health.ts                 # NEW -- scraper health monitoring logic
src/app/api/cron/
  scrape/
    [industry]/
      route.ts              # NEW -- parameterized per-industry cron
    route.ts                # MODIFY -- becomes redirect or backward compat
  enrich/
    route.ts                # NEW -- lead enrichment cron
  expire/
    route.ts                # NEW -- lead expiration cron
  health/
    route.ts                # NEW -- scraper health monitoring cron
```

### Pattern 1: Factory Pattern Replacing Global Map Registry

**What:** Replace `registry.ts`'s mutable global `Map<string, ScraperAdapter>` with pure functions that return adapter arrays per industry.

**When to use:** Always -- the global Map has race conditions when multiple crons call `initializeAdapters()` / `clearAdapters()` simultaneously.

**Why critical:** The current `initializeAdapters()` / `getRegisteredAdapters()` / `clearAdapters()` pattern is dangerous in a multi-cron environment. If two cron invocations overlap:
1. Cron A calls `initializeAdapters()` -- registers 8 adapters
2. Cron B calls `initializeAdapters()` -- registers 8 MORE adapters (now 16 in Map)
3. Cron A calls `getRegisteredAdapters()` -- gets 16 adapters, runs duplicates
4. Cron A calls `clearAdapters()` -- clears all
5. Cron B calls `getRegisteredAdapters()` -- gets 0 adapters, runs nothing

**Example:**
```typescript
// src/lib/scraper/adapters/index.ts -- NEW factory pattern
import type { Industry } from '@/lib/onboarding/types';
import type { ScraperAdapter } from './base-adapter';

export function getAdaptersForIndustry(industry: Industry): ScraperAdapter[] {
  switch (industry) {
    case 'heavy_equipment':
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new AtlantaPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ['236', '237', '238'] }),
        new EnrNewsAdapter(),
        new ConstructionDiveNewsAdapter(),
        new PrNewswireNewsAdapter(),
        new GoogleDorkingAdapter(),
      ];
    case 'hvac':
      return [
        new AustinPermitsAdapter(),  // permits relevant to all trades
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ['238220'] }),
        new EnrNewsAdapter(),
      ];
    case 'roofing':
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ['238160'] }),
        new EnrNewsAdapter(),
      ];
    case 'solar':
      return [
        new SamGovBidsAdapter({ naicsCodes: ['221114', '238220'] }),
        new EnrNewsAdapter(),
      ];
    case 'electrical':
      return [
        new AustinPermitsAdapter(),
        new DallasPermitsAdapter(),
        new SamGovBidsAdapter({ naicsCodes: ['238210'] }),
        new EnrNewsAdapter(),
      ];
  }
}

/** Backward-compat: get all adapters (union of all industries, deduped by sourceId) */
export function getAllAdapters(): ScraperAdapter[] {
  const seen = new Set<string>();
  const all: ScraperAdapter[] = [];
  for (const industry of ['heavy_equipment', 'hvac', 'roofing', 'solar', 'electrical'] as const) {
    for (const adapter of getAdaptersForIndustry(industry)) {
      if (!seen.has(adapter.sourceId)) {
        seen.add(adapter.sourceId);
        all.push(adapter);
      }
    }
  }
  return all;
}
```

### Pattern 2: Per-API Rate Limiting with p-queue

**What:** Create dedicated p-queue instances for each external API with specific concurrency and interval configurations.

**When to use:** Every external API call goes through its rate limiter.

**Example:**
```typescript
// src/lib/scraper/api-rate-limiter.ts
import type PQueue from 'p-queue';

// Lazy-loaded singleton queues (one per external API)
let socrata: PQueue | null = null;
let samGov: PQueue | null = null;

async function createQueue(opts: { concurrency: number; intervalCap: number; interval: number }): Promise<PQueue> {
  const { default: PQueue } = await import('p-queue');
  return new PQueue(opts);
}

export async function getSocrataQueue(): Promise<PQueue> {
  if (!socrata) {
    // Socrata: 1000 req/hr with app token, be conservative at 500/hr
    socrata = await createQueue({ concurrency: 2, intervalCap: 8, interval: 60_000 });
  }
  return socrata;
}

export async function getSamGovQueue(): Promise<PQueue> {
  if (!samGov) {
    // SAM.gov: 1000 req/day total, budget 200/industry = 10/min safe
    samGov = await createQueue({ concurrency: 1, intervalCap: 10, interval: 60_000 });
  }
  return samGov;
}
```

### Pattern 3: Content Hash Deduplication

**What:** Compute SHA-256 of normalized key fields before insert; use `contentHash` unique index for fast conflict detection.

**When to use:** Every record processed by the pipeline, as a fast-path pre-filter BEFORE the expensive proximity-based dedup.

**Example:**
```typescript
// src/lib/scraper/content-hash.ts
import { createHash } from 'crypto';

/**
 * Compute a content hash for deduplication.
 *
 * Hash inputs vary by source type to capture the right identity:
 * - Permits: sourceId + permitNumber (already handled by unique index)
 * - Bids: sourceId + externalId + title
 * - News: sourceId + sourceUrl
 * - Deep-web: sourceUrl
 *
 * All inputs are lowercased and trimmed before hashing.
 */
export function computeContentHash(record: {
  sourceType: string;
  sourceId?: string;
  permitNumber?: string;
  externalId?: string;
  title?: string;
  sourceUrl?: string;
}): string | null {
  let input: string;

  switch (record.sourceType) {
    case 'permit':
      if (!record.permitNumber) return null;
      input = `${record.sourceId}:${record.permitNumber}`;
      break;
    case 'bid':
      input = `${record.sourceId}:${record.externalId ?? ''}:${record.title ?? ''}`;
      break;
    case 'news':
    case 'deep-web':
      if (!record.sourceUrl) return null;
      input = record.sourceUrl;
      break;
    default:
      return null;
  }

  return createHash('sha256')
    .update(input.toLowerCase().trim())
    .digest('hex');
}
```

### Pattern 4: Socrata SODA3 Base Adapter

**What:** Abstract base class for all Socrata-powered permit portals, handling SODA3 endpoint format and app token.

**When to use:** Any city that uses Socrata (Austin, Dallas, Chicago, NYC, etc.).

**Example:**
```typescript
// src/lib/scraper/adapters/socrata-permit-adapter.ts
import type { ScraperAdapter, RawLeadData } from './base-adapter';

interface SocrataConfig {
  sourceId: string;
  sourceName: string;
  jurisdiction: string;
  /** Socrata domain (e.g., 'data.austintexas.gov') */
  domain: string;
  /** Dataset 4x4 identifier (e.g., '3syk-w9eu') */
  datasetId: string;
  /** Field mapping from Socrata columns to RawLeadData */
  fieldMap: {
    permitNumber: string;
    description?: string;
    address: string;
    projectType?: string;
    estimatedValue?: string;
    applicantName?: string;
    permitDate: string;
    latitude?: string;
    longitude?: string;
  };
}

export abstract class SocrataPermitAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType = 'permit' as const;
  readonly jurisdiction: string;

  constructor(protected readonly config: SocrataConfig) {
    this.sourceId = config.sourceId;
    this.sourceName = config.sourceName;
    this.jurisdiction = config.jurisdiction;
  }

  async scrape(): Promise<RawLeadData[]> {
    const appToken = (process.env.SOCRATA_APP_TOKEN ?? '').trim();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    // SODA3 endpoint format
    const url = `https://${this.config.domain}/api/v3/views/${this.config.datasetId}/query.json`;

    const soql = `SELECT * WHERE ${this.config.fieldMap.permitDate} > '${dateStr}' ORDER BY ${this.config.fieldMap.permitDate} DESC LIMIT 1000`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (appToken) {
      headers['X-App-Token'] = appToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: soql }),
    });

    if (!response.ok) {
      // Fallback to SODA2 if SODA3 not available on this portal
      return this.fallbackSoda2(dateStr);
    }

    const data = await response.json();
    return this.mapRecords(data.rows ?? data ?? []);
  }

  /** SODA2 fallback for portals that haven't migrated yet */
  protected async fallbackSoda2(dateStr: string): Promise<RawLeadData[]> {
    const url = new URL(
      `https://${this.config.domain}/resource/${this.config.datasetId}.json`
    );
    url.searchParams.set('$where', `${this.config.fieldMap.permitDate} > '${dateStr}'`);
    url.searchParams.set('$limit', '1000');
    url.searchParams.set('$order', `${this.config.fieldMap.permitDate} DESC`);

    const appToken = (process.env.SOCRATA_APP_TOKEN ?? '').trim();
    const headers: Record<string, string> = {};
    if (appToken) headers['X-App-Token'] = appToken;

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`Socrata API error for ${this.sourceId}: ${response.status}`);
    }

    const data = await response.json();
    return this.mapRecords(data);
  }

  protected abstract mapRecords(data: Record<string, unknown>[]): RawLeadData[];
}
```

### Pattern 5: Scraper Runs Integration

**What:** Record per-adapter execution in the `scraper_runs` table during pipeline execution.

**When to use:** Every pipeline run -- each adapter's scrape gets its own scraper_runs row.

**Example:**
```typescript
// Integration point in pipeline.ts runAdapter function
async function runAdapter(
  adapter: ScraperAdapter,
  pipelineRunId: string,
  industry?: string
): Promise<PipelineResult> {
  // Create scraper_run record at start
  const [scraperRun] = await db
    .insert(scraperRuns)
    .values({
      pipelineRunId,
      adapterId: adapter.sourceId,
      adapterName: adapter.sourceName,
      industry: industry ?? null,
      status: 'running',
    })
    .returning();

  try {
    const rawRecords = await adapter.scrape();
    // ... process records ...

    // Update scraper_run with success
    await db.update(scraperRuns).set({
      status: 'completed',
      recordsFound: rawRecords.length,
      recordsStored: storedCount,
      recordsSkipped: invalidCount,
      completedAt: new Date(),
    }).where(eq(scraperRuns.id, scraperRun.id));

    return result;
  } catch (error) {
    // Update scraper_run with failure
    await db.update(scraperRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(eq(scraperRuns.id, scraperRun.id));

    return errorResult;
  }
}
```

### Anti-Patterns to Avoid
- **Global mutable state in adapters:** The current `registry.ts` Map is the primary anti-pattern to eliminate. Never store adapter state in module-level mutable variables in a serverless environment.
- **Shared p-queue instances across cron invocations:** Each serverless function invocation gets its own runtime. Do NOT rely on singleton rate limiters persisting across invocations -- they only protect within a single invocation. For cross-invocation rate limiting (like SAM.gov daily budget), use database-tracked counts.
- **Replacing proximity dedup with content hash:** Content hash is a FAST-PATH supplement, not a replacement. Two leads from different sources about the same project will have different content hashes but should still be merged by proximity dedup.
- **Running all industry crons at the same minute:** Stagger by 2-3 minutes to avoid Neon connection pool exhaustion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API rate limiting | Custom token bucket / sliding window | p-queue with intervalCap + interval | Edge cases in sliding window math; p-queue handles backpressure, timeouts, queue draining |
| Content hashing | Custom hash function | Node.js `crypto.createHash('sha256')` | Built-in, fast, collision-resistant, zero dependencies |
| Cron concurrency locks | Custom lock table + polling | Database-level advisory locks or `scraper_runs` status check | Already have `pipeline_runs` table; check `status = 'running'` for the same industry within last 15 min |
| SODA3 query builder | Custom query string assembly | Standard SoQL strings in POST body | SoQL syntax is well-documented; no query builder library exists; string templates are fine |

**Key insight:** The main complexity in this phase is architectural (factory pattern, per-industry routing, scraper_runs wiring) rather than algorithmic. Use existing tools and focus effort on the integration points.

## Common Pitfalls

### Pitfall 1: p-queue Singleton Doesn't Persist Across Vercel Function Invocations
**What goes wrong:** Developer creates a module-level p-queue instance expecting it to enforce rate limits across multiple cron invocations. Each cold start gets a fresh queue with zero history.
**Why it happens:** Vercel serverless functions are stateless. Module-level singletons only live for the duration of a single invocation (or warm container reuse, which is unpredictable).
**How to avoid:** p-queue protects WITHIN a single pipeline run (multiple API calls in one invocation). For cross-invocation limits (SAM.gov daily budget), track call counts in the `scraper_runs` table and check before making API calls.
**Warning signs:** SAM.gov returns 429 errors; leads scraped count suddenly drops to zero.

### Pitfall 2: SODA3 Migration Breaks Austin Adapter Silently
**What goes wrong:** Austin's portal migrates to SODA3-only, the old `/resource/` endpoint returns 403, and the adapter returns zero permits with no error logged.
**Why it happens:** The current adapter swallows non-ok responses with a throw, but the pipeline catches it and continues. Zero records from a formerly-productive adapter looks like "no new permits" rather than an error.
**How to avoid:** Add a "minimum expected records" health check. If an adapter that normally returns 100+ records suddenly returns 0, log a warning and record it in scraper_runs.
**Warning signs:** scraper_runs shows `recordsFound: 0` for previously productive adapters.

### Pitfall 3: SAM.gov 1,000/Day Limit Exhausted by First Industry
**What goes wrong:** heavy_equipment cron fires first with 3 NAICS codes x 100 results each = 3 API calls. Then hvac fires and makes its call. By the time all 5 industries run, total calls exceed budget if SAM.gov counts paginated requests or retries.
**Why it happens:** SAM.gov counts every HTTP request toward the daily limit, including failed requests and retries.
**How to avoid:** Static budget allocation: 200 requests per industry per day. Track calls in scraper_runs per adapter per day. Stop making calls when budget is exhausted. With 5 industries x ~3 NAICS codes each x 1 request per NAICS = ~15 total calls/day -- well within limits. The real risk is retry loops on transient failures.
**Warning signs:** API returns 429; later industry crons get zero bid results.

### Pitfall 4: Vercel Cron Jobs Can Fire Twice (Idempotency Required)
**What goes wrong:** Vercel's event system can deliver the same cron event more than once. Two instances of the same industry cron run simultaneously, both inserting the same leads.
**Why it happens:** Documented Vercel behavior: "Vercel's event-driven system can occasionally deliver the same cron event more than once."
**How to avoid:** Check `pipeline_runs` for a run with `status = 'running'` and `industry = X` started within the last 15 minutes. If found, return early with 200 (don't error -- it's expected). Content hash dedup also provides a safety net for duplicate inserts.
**Warning signs:** Duplicate scraper_runs entries for the same industry/timestamp.

### Pitfall 5: Content Hash Conflicts with Proximity Dedup
**What goes wrong:** Same real-world project appears in two sources (permit + news). Content hashes differ because the sources have different titles/descriptions. Proximity dedup correctly identifies them as duplicates, but only after both are inserted. If content hash rejects the second insert, proximity dedup never gets a chance to merge them.
**How to avoid:** Content hash dedup uses `ON CONFLICT DO NOTHING` -- it only prevents exact duplicate inserts from the SAME source. Cross-source dedup remains the job of the existing proximity dedup in `dedup.ts`. The content hash unique index is already `WHERE content_hash IS NOT NULL`, so it only catches exact duplicates.
**Warning signs:** Leads from different sources not being merged; duplicate real-world projects in the feed.

### Pitfall 6: On-Demand Trigger Still Uses Old Registry Pattern
**What goes wrong:** The per-industry cron routes use the new factory pattern, but `/api/scraper/run` (user-triggered) still calls `initializeAdapters()` / `getRegisteredAdapters()` / `clearAdapters()`. If both fire simultaneously, the race condition remains.
**How to avoid:** Update `/api/scraper/run` to use `getAllAdapters()` from the new factory pattern. Remove all imports of `registry.ts` functions.
**Warning signs:** User-triggered scrape returns double the expected adapter count.

## Code Examples

### Per-Industry Cron Route Handler
```typescript
// src/app/api/cron/scrape/[industry]/route.ts
import type { NextRequest } from 'next/server';
import type { Industry } from '@/lib/onboarding/types';
import { getAdaptersForIndustry } from '@/lib/scraper/adapters';
import { runPipeline } from '@/lib/scraper/pipeline';
import { db } from '@/lib/db';
import { pipelineRuns } from '@/lib/db/schema/pipeline-runs';
import { eq, and, gte } from 'drizzle-orm';

export const maxDuration = 300;

const VALID_INDUSTRIES: Industry[] = [
  'heavy_equipment', 'hvac', 'roofing', 'solar', 'electrical'
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${(process.env.CRON_SECRET ?? '').trim()}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { industry } = await params;
  if (!VALID_INDUSTRIES.includes(industry as Industry)) {
    return Response.json({ error: `Invalid industry: ${industry}` }, { status: 400 });
  }

  // Idempotency: check for running pipeline for this industry
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const runningRun = await db.query.pipelineRuns.findFirst({
    where: and(
      eq(pipelineRuns.status, 'running'),
      eq(pipelineRuns.triggeredBy, `cron-${industry}`),
      gte(pipelineRuns.startedAt, fifteenMinAgo)
    ),
  });
  if (runningRun) {
    return Response.json({ skipped: true, reason: 'Already running' });
  }

  const adapters = getAdaptersForIndustry(industry as Industry);
  // ... create pipeline_run, execute, update ...
}
```

### SAM.gov NAICS Budget Per Industry
```typescript
// SAM.gov NAICS code mapping per industry
// Each NAICS code = 1 API request to SAM.gov
// Total daily budget: 1000 requests, but we only need ~15-20 per full run
export const SAM_GOV_NAICS_BY_INDUSTRY: Record<Industry, string[]> = {
  heavy_equipment: ['236', '237', '238'],   // 3 requests
  hvac: ['238220'],                          // 1 request
  roofing: ['238160'],                       // 1 request
  solar: ['221114', '238220'],               // 2 requests
  electrical: ['238210'],                    // 1 request
};
// Total per full run: 8 requests. Even running 3x/day = 24 requests << 1000 limit.
```

### Lead Enrichment Cron Logic
```typescript
// src/app/api/cron/enrich/route.ts
// Enrichment runs AFTER scraping to tag leads with cross-industry relevance

// What runs in enrichment cron vs. inline in pipeline:
// - INLINE (pipeline.ts): geocoding, content hash, basic field validation
// - ENRICHMENT CRON: applicableIndustries tagging, valueTier computation,
//   severity assessment, deadline proximity flags

// applicableIndustries inference example:
function inferApplicableIndustries(lead: Lead): string[] {
  const industries: string[] = [];
  const text = `${lead.title ?? ''} ${lead.description ?? ''} ${lead.projectType ?? ''}`.toLowerCase();

  // A commercial construction permit is relevant to MULTIPLE industries
  if (/hvac|heating|cooling|air.condition|mechanical/i.test(text)) industries.push('hvac');
  if (/roof|shingle|waterproof|membrane/i.test(text)) industries.push('roofing');
  if (/solar|photovoltaic|pv.system|renewable/i.test(text)) industries.push('solar');
  if (/electric|wiring|panel|transformer|ev.charg/i.test(text)) industries.push('electrical');
  if (/excavat|crane|loader|dozer|grading|demolit|heavy/i.test(text)) industries.push('heavy_equipment');

  // Building permits without specific keywords are relevant to heavy_equipment by default
  if (industries.length === 0 && lead.sourceType === 'permit') {
    industries.push('heavy_equipment');
  }

  return industries;
}
```

### Lead Expiration Logic
```typescript
// What makes a lead stale:
// 1. Permits: scrapedAt > 90 days ago (project likely underway or completed)
// 2. Bids: deadlineDate in the past (response window closed)
// 3. News: scrapedAt > 60 days ago (no longer "fresh" intelligence)
// 4. Deep-web: scrapedAt > 30 days ago (search results go stale fast)

const EXPIRATION_RULES: Record<string, { field: string; maxAgeDays: number }> = {
  permit: { field: 'scrapedAt', maxAgeDays: 90 },
  bid: { field: 'deadlineDate', maxAgeDays: 0 }, // expired when deadline passes
  news: { field: 'scrapedAt', maxAgeDays: 60 },
  'deep-web': { field: 'scrapedAt', maxAgeDays: 30 },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socrata SODA2 `/resource/ID.json` | SODA3 `/api/v3/views/ID/query.json` | 2025 | App token now required; POST method preferred; pagination via `page` object |
| Anonymous Socrata requests | App-token-authenticated requests | 2025 | Without token: heavily throttled by IP; with token: essentially unlimited within reason |
| Single monolithic cron | Per-industry parameterized crons | This phase | Isolation, independent schedules, per-industry health tracking |
| Global mutable adapter registry | Factory functions returning adapter arrays | This phase | Eliminates race conditions in serverless, improves test isolation |

**Deprecated/outdated:**
- `registry.ts` mutable Map pattern: Replace with factory functions
- SODA2 `/resource/` endpoint: Still available as fallback but Socrata is migrating all portals to SODA3
- `initializeAdapters()` / `clearAdapters()` lifecycle: Not needed with factory pattern

## Open Questions

1. **Socrata portal SODA3 readiness per city**
   - What we know: SODA3 was released in 2025, portals are migrating, but the old endpoint still works during transition
   - What's unclear: Whether `data.austintexas.gov` and `dallasopendata.com` have fully migrated to SODA3 yet
   - Recommendation: Implement SODA3 as primary with SODA2 fallback. Try SODA3 first; on 404/403, fall back to SODA2 endpoint. Log which mode is used per scrape.

2. **SAM.gov per-minute rate limit**
   - What we know: 1,000 requests/day hard limit. No documented per-minute limit.
   - What's unclear: Whether there is an undocumented per-second or per-minute throttle
   - Recommendation: Use p-queue with conservative `intervalCap: 10` per `interval: 60000` (10 req/min). Monitor for 429 responses.

3. **Vercel function cold start impact on cron timing**
   - What we know: Cron fires within the specified minute on Pro plan. Function cold starts add 1-3 seconds.
   - What's unclear: Whether 5 industry crons all hitting the same Neon database simultaneously causes connection pool issues
   - Recommendation: Stagger cron schedules by 3 minutes: heavy_equipment at :00, hvac at :03, roofing at :06, solar at :09, electrical at :12.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/scraper/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-01 | Factory returns correct adapters per industry | unit | `npx vitest run tests/scraper/factory.test.ts -x` | Wave 0 |
| SCRP-02 | Content hash computed correctly per source type | unit | `npx vitest run tests/scraper/content-hash.test.ts -x` | Wave 0 |
| SCRP-02 | Duplicate content hash rejected on insert | unit | `npx vitest run tests/scraper/content-hash-dedup.test.ts -x` | Wave 0 |
| SCRP-03 | p-queue enforces concurrency and interval limits | unit | `npx vitest run tests/scraper/api-rate-limiter.test.ts -x` | Wave 0 |
| SCRP-04 | SocrataPermitAdapter constructs correct SODA3 request | unit | `npx vitest run tests/scraper/socrata-adapter.test.ts -x` | Wave 0 |
| SCRP-04 | SODA3 fallback to SODA2 on 403/404 | unit | `npx vitest run tests/scraper/socrata-adapter.test.ts -x` | Wave 0 |
| SCRP-05 | SAM.gov adapter uses industry-specific NAICS codes | unit | `npx vitest run tests/scraper/sam-gov-adapter.test.ts -x` | Exists (update) |
| CRON-01 | Per-industry cron route validates industry param | unit | `npx vitest run tests/scraper/industry-cron.test.ts -x` | Wave 0 |
| CRON-01 | Per-industry cron rejects duplicate concurrent runs | unit | `npx vitest run tests/scraper/industry-cron.test.ts -x` | Wave 0 |
| CRON-03 | Enrichment cron tags leads with applicableIndustries | unit | `npx vitest run tests/scraper/enrichment.test.ts -x` | Wave 0 |
| CRON-04 | Expiration cron marks stale leads correctly per source type | unit | `npx vitest run tests/scraper/expiration.test.ts -x` | Wave 0 |
| CRON-07 | Health monitor detects consecutive adapter failures | unit | `npx vitest run tests/scraper/health.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/factory.test.ts` -- covers SCRP-01
- [ ] `tests/scraper/content-hash.test.ts` -- covers SCRP-02
- [ ] `tests/scraper/content-hash-dedup.test.ts` -- covers SCRP-02 insert behavior
- [ ] `tests/scraper/api-rate-limiter.test.ts` -- covers SCRP-03
- [ ] `tests/scraper/socrata-adapter.test.ts` -- covers SCRP-04
- [ ] `tests/scraper/industry-cron.test.ts` -- covers CRON-01
- [ ] `tests/scraper/enrichment.test.ts` -- covers CRON-03
- [ ] `tests/scraper/expiration.test.ts` -- covers CRON-04
- [ ] `tests/scraper/health.test.ts` -- covers CRON-07
- [ ] Update `tests/scraper/sam-gov-adapter.test.ts` -- covers SCRP-05 multi-NAICS

## Sources

### Primary (HIGH confidence)
- Vercel Cron Jobs docs (`vercel.com/docs/cron-jobs`) -- 100 crons/project all plans, Pro gets per-minute scheduling, no built-in concurrency protection
- Vercel Cron Management docs (`vercel.com/docs/cron-jobs/manage-cron-jobs`) -- explicit warning about overlapping runs, idempotency requirement, no retry on failure
- Vercel Cron Usage & Pricing (`vercel.com/docs/cron-jobs/usage-and-pricing`) -- Hobby: once/day only; Pro: once/minute; 100 crons/project
- Socrata SODA3 docs (`dev.socrata.com/docs/endpoints.html`) -- new endpoint format `/api/v3/views/ID/query.json`, POST method, app token required
- Socrata App Tokens docs (`dev.socrata.com/docs/app-tokens.html`) -- `X-App-Token` header, without token: throttled by IP, with token: not throttled unless abusive
- p-queue GitHub (`github.com/sindresorhus/p-queue`) -- ESM-only, `intervalCap` + `interval` for rate limiting, strict mode for sliding window
- SAM.gov rate limits (`govconapi.com/sam-gov-rate-limits-reality`) -- 1000 req/day for registered entities, daily not per-minute
- Codebase analysis -- direct inspection of pipeline.ts, registry.ts, dedup.ts, all adapter files, cron route, scraper-runs schema, leads schema

### Secondary (MEDIUM confidence)
- Socrata SODA3 query format (`dev.socrata.com/docs/queries/`) -- POST body with `query` field and `page` pagination; SoQL maintained
- SAM.gov Get Opportunities API (`open.gsa.gov/api/get-opportunities-public-api/`) -- single NAICS per request, `ncode` parameter

### Tertiary (LOW confidence)
- Individual Socrata portal SODA3 migration status (Austin, Dallas) -- not verified per-portal; fallback to SODA2 mitigates risk
- SAM.gov per-minute rate limit -- no documentation found; conservative p-queue config mitigates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - p-queue is well-documented, Node.js crypto is built-in, existing stack unchanged
- Architecture: HIGH - factory pattern replacing global Map is straightforward; pipeline.ts already accepts adapters as args; scraper_runs schema exists
- Pitfalls: HIGH - Vercel concurrency behavior documented officially; SAM.gov limits documented; content hash vs proximity dedup interaction understood from codebase analysis
- SODA3 migration: MEDIUM - endpoint format confirmed, but per-portal readiness unverified; SODA2 fallback eliminates risk

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (30 days -- stable domain, no fast-moving dependencies)
