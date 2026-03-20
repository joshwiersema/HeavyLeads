# Architecture Patterns: GroundPulse v4.0 Nationwide Scaling

**Domain:** B2B SaaS lead intelligence platform scaling from 3 cities to 50 states
**Researched:** 2026-03-19
**Confidence:** HIGH (based on existing codebase analysis + official API documentation)

---

## Executive Summary

The current architecture has solid foundations (adapter pattern, pipeline orchestration, query-time scoring, dedup) but three structural problems prevent scaling: (1) hardcoded city adapters requiring a new file per Socrata/ArcGIS portal, (2) a scoring engine that produces identical scores because most leads lack the data fields that create variance, and (3) a pipeline that runs all adapters sequentially in a single 300-second Vercel function.

This document specifies the exact architectural changes needed, identifies every integration point with existing code, and provides a dependency-ordered build sequence.

---

## Current Architecture Analysis

### What Works Well (Keep)

| Component | Location | Assessment |
|-----------|----------|------------|
| `ScraperAdapter` interface | `src/lib/scraper/adapters/base-adapter.ts` | Clean contract, keep as-is |
| `rawLeadSchema` (Zod validation) | `src/lib/scraper/adapters/base-adapter.ts` | Source-agnostic, extensible |
| `runPipeline()` orchestrator | `src/lib/scraper/pipeline.ts` | Error isolation per adapter, dedup post-step |
| `SocrataPermitAdapter` base class | `src/lib/scraper/adapters/socrata-permit-adapter.ts` | SODA3/SODA2 fallback pattern |
| Per-org scoring context | `src/lib/scoring/engine.ts` | 5-dimension design is correct |
| Rate limiter queues | `src/lib/scraper/api-rate-limiter.ts` | p-queue pattern is sound |
| Content hash dedup | `src/lib/scraper/content-hash.ts` | Prevents exact duplicates |
| Health monitoring | `src/lib/scraper/health.ts` | Consecutive failure tracking |

### What Must Change

| Problem | Root Cause | Impact |
|---------|-----------|--------|
| 3 hardcoded city adapters | Each city needs a new `.ts` file with `mapRecords()` | Cannot scale to hundreds of portals |
| Identical scores (30/100 for all) | Most leads have null `estimatedValue`, empty `applicableIndustries`, no `severity`/`deadline`, and the enrichment step tags ALL industries when keywords do not match | Every lead scores identically on 4/5 dimensions |
| Pipeline timeout at scale | Sequential adapter execution in single 300s function | 50+ adapters will exceed Vercel function timeout |
| No geographic discovery | `getAdaptersForIndustry()` returns hardcoded list | Cannot add portals without code changes |
| Feed query pulls ALL leads in radius | `getFilteredLeadsWithCount` fetches unbounded rows, enriches in JS | 100K+ leads in radius = OOM on Vercel |

---

## Recommended Architecture

### Component Diagram

```
                         Vercel Cron (daily)
                               |
                    +----------+----------+
                    |                     |
              /api/cron/discover    /api/cron/scrape/:batch
                    |                     |
            Portal Registry         Batch Pipeline Runner
            (discover portals)      (adapters in batches of N)
                    |                     |
             data_portals table     Generic Socrata Adapter
                    |               (config-driven, no subclass)
                    |                     |
                    +----------+----------+
                               |
                         leads table
                               |
                    +----------+----------+
                    |                     |
              Enrichment Cron       Lead Feed Query
              (industry, value,     (PostGIS spatial,
               severity tagging)     DB-side scoring)
                    |                     |
                    +------> scored leads to UI
```

### Component Boundaries

| Component | Responsibility | Communicates With | Status |
|-----------|---------------|-------------------|--------|
| Portal Registry | Discover and store Socrata/ArcGIS portal configs | `data_portals` table, Socrata Discovery API, ArcGIS Hub API | NEW |
| Generic Socrata Adapter | Config-driven scraping, no subclass per city | Portal Registry, Pipeline | NEW (replaces city-specific adapters) |
| Generic ArcGIS Adapter | Config-driven Feature Service scraping | Portal Registry, Pipeline | NEW |
| Batch Pipeline Runner | Splits adapters into batches, runs in separate function calls | Pipeline, Vercel Cron | NEW (wraps existing `runPipeline`) |
| Enrichment Engine (enhanced) | Tags industries, value tier, severity, project phase | `leads` table, `enrichment.ts` | MODIFIED |
| Scoring Engine (fixed) | Produces differentiated 0-100 scores per org | `src/lib/scoring/` | MODIFIED |
| Lead Feed Query (optimized) | PostGIS spatial query + DB-side pre-scoring | `src/lib/leads/queries.ts` | MODIFIED |

---

## Architecture Change 1: Dynamic Portal Discovery

### Problem

The current `adapters/index.ts` hardcodes adapter instantiation:

```typescript
// Current: hardcoded in getAdaptersForIndustry()
case "heavy_equipment":
  return [
    new AustinPermitsAdapter(),
    new DallasPermitsAdapter(),
    new AtlantaPermitsAdapter(),
    // ... manually add each new city
  ];
```

Scaling to hundreds of portals would require hundreds of adapter files, each with a `mapRecords()` method doing the same field-mapping work.

### Solution: Portal Registry + Generic Adapter

**New DB table: `data_portals`**

```typescript
// src/lib/db/schema/data-portals.ts (NEW FILE)
export const dataPortals = pgTable("data_portals", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),          // "socrata" | "arcgis" | "ckan"
  domain: text("domain").notNull(),              // "data.austintexas.gov"
  datasetId: text("dataset_id").notNull(),       // "3syk-w9eu"
  sourceType: text("source_type").notNull(),     // "permit" | "violation" | ...
  jurisdiction: text("jurisdiction").notNull(),  // "Austin, TX"
  state: text("state").notNull(),                // "TX"
  fieldMap: text("field_map").notNull(),          // JSON string of column mappings
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  lastScrapedAt: timestamp("last_scraped_at"),
  lastRecordCount: integer("last_record_count"),
  enabled: boolean("enabled").default(true).notNull(),
  confidence: text("confidence").default("auto"),  // "verified" | "auto" | "low"
  // Dedup: one portal config per domain+datasetId
}, (table) => [
  uniqueIndex("data_portals_domain_dataset_idx").on(table.domain, table.datasetId),
  index("data_portals_state_idx").on(table.state),
  index("data_portals_platform_idx").on(table.platform),
]);
```

**Field map schema (stored as JSON in `fieldMap` column):**

```typescript
// src/lib/scraper/portal-field-map.ts (NEW FILE)
import { z } from "zod";

export const portalFieldMapSchema = z.object({
  // Identity fields
  permitNumber: z.string().optional(),    // Column name for permit number
  title: z.string().optional(),           // Column name for title/description
  externalId: z.string().optional(),      // Column name for external ID

  // Core fields
  description: z.string().optional(),
  address: z.string().optional(),
  projectType: z.string().optional(),
  estimatedValue: z.string().optional(),

  // Contact fields
  applicantName: z.string().optional(),
  contractorName: z.string().optional(),

  // Date fields
  dateField: z.string(),                  // Primary date column (required)

  // Geo fields
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export type PortalFieldMap = z.infer<typeof portalFieldMapSchema>;
```

**Generic Socrata Adapter (replaces per-city subclasses):**

```typescript
// src/lib/scraper/adapters/generic-socrata-adapter.ts (NEW FILE)
// Implements ScraperAdapter using a PortalFieldMap config row
// NO abstract mapRecords() -- field mapping is data-driven

export class GenericSocrataAdapter implements ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly jurisdiction: string;

  private readonly domain: string;
  private readonly datasetId: string;
  private readonly fieldMap: PortalFieldMap;

  constructor(portal: DataPortalRow) {
    this.sourceId = `${portal.domain}-${portal.datasetId}`;
    this.sourceName = `${portal.jurisdiction} ${portal.sourceType}`;
    this.sourceType = portal.sourceType as SourceType;
    this.jurisdiction = portal.jurisdiction;
    this.domain = portal.domain;
    this.datasetId = portal.datasetId;
    this.fieldMap = JSON.parse(portal.fieldMap);
  }

  async scrape(): Promise<RawLeadData[]> {
    // Reuse existing SODA3/SODA2 fetch logic from SocrataPermitAdapter
    // But use generic field mapping instead of abstract mapRecords()
    const data = await fetchSocrataData(this.domain, this.datasetId, this.fieldMap);
    return data.map(record => mapGenericRecord(record, this.fieldMap, this.sourceType));
  }
}

function mapGenericRecord(
  record: Record<string, unknown>,
  fieldMap: PortalFieldMap,
  sourceType: SourceType
): RawLeadData {
  return {
    permitNumber: fieldMap.permitNumber ? String(record[fieldMap.permitNumber] ?? "") || undefined : undefined,
    title: fieldMap.title ? String(record[fieldMap.title] ?? "") || undefined : undefined,
    description: fieldMap.description ? String(record[fieldMap.description] ?? "") || undefined : undefined,
    address: fieldMap.address ? String(record[fieldMap.address] ?? "") || undefined : undefined,
    projectType: fieldMap.projectType ? String(record[fieldMap.projectType] ?? "") || undefined : undefined,
    estimatedValue: fieldMap.estimatedValue ? parseFloat(String(record[fieldMap.estimatedValue])) || undefined : undefined,
    applicantName: fieldMap.applicantName ? String(record[fieldMap.applicantName] ?? "") || undefined : undefined,
    permitDate: fieldMap.dateField ? new Date(String(record[fieldMap.dateField])) : undefined,
    lat: fieldMap.latitude ? parseFloat(String(record[fieldMap.latitude])) || undefined : undefined,
    lng: fieldMap.longitude ? parseFloat(String(record[fieldMap.longitude])) || undefined : undefined,
    sourceType,
    sourceUrl: `https://${fieldMap.domain}/resource/${fieldMap.datasetId}.json`,
  };
}
```

### Discovery Service (New Cron)

```
/api/cron/discover  (weekly, runs on Sunday at 2 AM)
```

Two discovery strategies:

**Strategy A: Socrata Discovery API**

```
GET http://api.us.socrata.com/api/catalog/v1?q=building+permits&limit=100&offset=0
GET http://api.us.socrata.com/api/catalog/v1?q=construction+permits&limit=100&offset=0
GET http://api.us.socrata.com/api/catalog/v1?q=code+violations&limit=100&offset=0
```

The Socrata Discovery API returns datasets with metadata including domain, dataset ID, column names, and descriptions. The discovery cron parses these results, infers field mappings from common column name patterns, and upserts into `data_portals`.

**Strategy B: ArcGIS Hub Search API**

```
GET https://hub.arcgis.com/api/v3/datasets?q=building+permits&filter[type]=any(Feature Service)&page[size]=100
```

Returns Feature Service URLs that can be scraped via ArcGIS REST API query endpoints.

**Field mapping inference (for Socrata portals):**

```typescript
// src/lib/scraper/discovery/field-mapper.ts (NEW FILE)

const PERMIT_NUMBER_PATTERNS = [
  "permit_number", "permit_no", "permitnumber", "permit_num",
  "permit_id", "permitid", "application_number", "case_number",
  "record_id", "folder_number",
];

const ADDRESS_PATTERNS = [
  "address", "location", "permit_location", "site_address",
  "street_address", "property_address", "work_location",
  "original_address", "full_address",
];

const DATE_PATTERNS = [
  "issue_date", "issued_date", "permit_date", "application_date",
  "filed_date", "date_issued", "issueddate", "date_filed",
  "status_date", "final_date",
];

const VALUE_PATTERNS = [
  "estimated_value", "project_valuation", "valuation",
  "total_valuation", "job_value", "estimated_cost",
  "construction_cost", "permit_value",
];

export function inferFieldMap(columns: string[]): PortalFieldMap | null {
  const normalized = columns.map(c => c.toLowerCase().replace(/[^a-z0-9_]/g, ""));

  const dateField = findMatch(normalized, columns, DATE_PATTERNS);
  if (!dateField) return null; // Cannot scrape without a date field

  return {
    permitNumber: findMatch(normalized, columns, PERMIT_NUMBER_PATTERNS),
    address: findMatch(normalized, columns, ADDRESS_PATTERNS),
    dateField,
    estimatedValue: findMatch(normalized, columns, VALUE_PATTERNS),
    // ... other field patterns
  };
}
```

### Integration Points with Existing Code

| Existing File | Change Type | What Changes |
|--------------|-------------|-------------|
| `src/lib/scraper/adapters/index.ts` | MODIFIED | `getAllAdapters()` queries `data_portals` table, instantiates `GenericSocrataAdapter` for each enabled portal, plus existing non-Socrata adapters |
| `src/lib/scraper/adapters/socrata-permit-adapter.ts` | DEPRECATED (keep for fallback) | Existing city adapters still work but are superseded by generic adapter |
| `src/lib/scraper/adapters/austin-permits.ts` | DEPRECATED | Replaced by `data_portals` row for Austin |
| `src/lib/scraper/adapters/dallas-permits.ts` | DEPRECATED | Replaced by `data_portals` row for Dallas |
| `src/lib/scraper/adapters/atlanta-permits.ts` | DEPRECATED | Replaced by `data_portals` row for Atlanta |
| `src/lib/scraper/api-rate-limiter.ts` | MODIFIED | Add dynamic rate limiter that creates queues per-domain to avoid hitting individual portal rate limits |
| `src/lib/db/schema/index.ts` | MODIFIED | Export new `dataPortals` table |
| `vercel.json` | MODIFIED | Add `/api/cron/discover` schedule |

### Seed Data: Migrate Existing Adapters

The three existing city adapter configurations should be migrated to `data_portals` rows as seed data:

```typescript
// Seed: existing Austin config -> data_portals row
{
  platform: "socrata",
  domain: "data.austintexas.gov",
  datasetId: "3syk-w9eu",
  sourceType: "permit",
  jurisdiction: "Austin, TX",
  state: "TX",
  fieldMap: JSON.stringify({
    permitNumber: "permit_number",
    description: "description",
    address: "permit_location",
    projectType: "permit_type_desc",
    dateField: "issue_date",
    latitude: "latitude",
    longitude: "longitude",
  }),
  confidence: "verified",
}
```

---

## Architecture Change 2: Scoring Engine Fix

### Root Cause Analysis: Why All Leads Score 30/100

Walking through the scoring engine with a typical permit lead:

```
Typical lead state in DB:
  - lat/lng: present (geocoded) -> distance calculated
  - applicableIndustries: ["heavy_equipment", "hvac", "roofing", "solar", "electrical"]
    (ALL 5 industries -- enrichment found no keyword match, defaulted to all)
  - estimatedValue: null (most Socrata portals don't expose valuation)
  - valueTier: null (depends on estimatedValue)
  - severity: null (only set for violations)
  - deadline: null (only set for bids/storms)
  - projectType: "Residential - New" (generic)

Score breakdown for a typical org (50mi radius, near lead):
  Distance:   15/25 (within 50mi)         -- WORKS, varies by location
  Relevance:   5/30 (low-confidence match) -- BROKEN: isLowConfidence=true
  Value:      10/20 (value unknown)        -- BROKEN: always null
  Freshness:  varies/15                    -- WORKS, varies by age
  Urgency:     5/10 (permit base score)    -- SEMI-BROKEN: all permits get 5

Result: ~35/100 for almost every lead, +/- 3-6 points from freshness/distance
```

The problem is NOT the scoring algorithm itself -- the dimension design is sound. The problem is that **most leads have insufficient enrichment data** to produce variance in 3 of 5 dimensions.

### Solution: Enhanced Enrichment + Scoring Adjustments

**Phase 1: Fix enrichment to populate more fields**

The enrichment step (`src/lib/scraper/enrichment.ts`) currently only tags `applicableIndustries` and `valueTier`. It needs to also populate:

1. **Value estimation from project type** (when `estimatedValue` is null)
2. **Severity from source type and description**
3. **Better industry classification** using project type + description together

```typescript
// src/lib/scraper/enrichment.ts -- MODIFIED

// NEW: Estimate value from project type when actual value is missing
const VALUE_ESTIMATES: Record<string, number> = {
  // Residential
  "residential - new": 350000,
  "residential - remodel": 75000,
  "residential - addition": 100000,
  "residential - repair": 25000,
  // Commercial
  "commercial - new": 2000000,
  "commercial - remodel": 500000,
  "commercial - tenant improvement": 150000,
  // Industrial
  "demolition": 50000,
  "electrical": 30000,
  "mechanical": 40000,
  "plumbing": 20000,
  "roofing": 35000,
  "sign": 10000,
  "fire alarm": 15000,
  "solar": 45000,
  "swimming pool": 60000,
};

export function estimateValueFromProjectType(
  projectType: string | null,
  description: string | null
): number | null {
  if (!projectType) return null;
  const normalized = projectType.toLowerCase().trim();

  // Direct match
  if (VALUE_ESTIMATES[normalized]) return VALUE_ESTIMATES[normalized];

  // Partial match: find the longest key that appears in projectType
  let bestMatch: string | null = null;
  let bestLength = 0;
  for (const [key, _value] of Object.entries(VALUE_ESTIMATES)) {
    if (normalized.includes(key) && key.length > bestLength) {
      bestMatch = key;
      bestLength = key.length;
    }
  }
  if (bestMatch) return VALUE_ESTIMATES[bestMatch];

  // Fallback: check description for "commercial" vs "residential" keyword
  const text = `${projectType} ${description ?? ""}`.toLowerCase();
  if (text.includes("commercial") || text.includes("industrial")) return 500000;
  if (text.includes("residential") || text.includes("single family")) return 200000;

  return null;
}
```

**Phase 2: Scoring algorithm adjustments for variance**

```typescript
// src/lib/scoring/relevance.ts -- MODIFIED
// Key change: When applicableIndustries is low-confidence (all 5 tagged),
// use projectType matching as the PRIMARY signal instead of industry match.

// Current behavior (produces identical scores):
//   isLowConfidence=true -> +5 always
//
// Fixed behavior (produces variance):
//   isLowConfidence=true -> use projectType/description keywords to score 0-20
//   Even with uncertain industry, a "Roofing Permit" should score higher
//   for a roofing company than a "Plumbing Permit"

export function scoreRelevance(
  lead: LeadScoringInput,
  org: OrgScoringContext
): ScoreDimension {
  // ... existing logic ...

  // CHANGE: When low confidence, do keyword matching against projectType
  // instead of giving flat +5
  if (industryMatch && isLowConfidence) {
    // Instead of flat +5, check if projectType keywords match the org's industry
    const industryKeywordScore = scoreProjectTypeForIndustry(
      lead.projectType,
      org.industry,
      org.specializations
    );
    raw += industryKeywordScore; // 0-15 instead of always 5
    if (industryKeywordScore > 10) {
      dim.reasons.push(`Project type likely relevant to ${org.industry}`);
    } else if (industryKeywordScore > 5) {
      dim.reasons.push("Possible match for your industry");
    } else {
      dim.reasons.push("Industry match uncertain");
    }
  }
}

// NEW function
function scoreProjectTypeForIndustry(
  projectType: string | null,
  industry: string,
  specializations: string[]
): number {
  if (!projectType) return 3; // Unknown project type -> small baseline

  const pt = projectType.toLowerCase();

  // Industry-specific keyword matching
  const INDUSTRY_KEYWORDS: Record<string, { strong: string[]; weak: string[] }> = {
    heavy_equipment: {
      strong: ["demolition", "grading", "excavation", "foundation", "structural",
               "site work", "new construction"],
      weak: ["commercial", "industrial", "multi-family", "renovation"],
    },
    hvac: {
      strong: ["mechanical", "hvac", "heating", "cooling", "air conditioning"],
      weak: ["commercial", "tenant improvement", "remodel", "new construction"],
    },
    roofing: {
      strong: ["roofing", "roof", "re-roof", "shingle", "membrane"],
      weak: ["residential", "repair", "storm damage", "insurance"],
    },
    solar: {
      strong: ["solar", "photovoltaic", "pv", "renewable", "ev charging"],
      weak: ["electrical", "residential", "commercial"],
    },
    electrical: {
      strong: ["electrical", "wiring", "panel", "service upgrade", "transformer"],
      weak: ["commercial", "residential", "tenant improvement"],
    },
  };

  const keywords = INDUSTRY_KEYWORDS[industry];
  if (!keywords) return 3;

  // Strong match = 15, weak match = 8, no match = 3
  if (keywords.strong.some(kw => pt.includes(kw))) return 15;
  if (keywords.weak.some(kw => pt.includes(kw))) return 8;

  // Check specializations too
  for (const spec of specializations) {
    if (pt.includes(spec.toLowerCase())) return 12;
  }

  return 3;
}
```

**Phase 3: Value dimension fix**

```typescript
// src/lib/scoring/value.ts -- MODIFIED
// Key change: Use estimated value from enrichment when actual value is null

// Current behavior: estimatedValue null -> score 10 ("Value unknown")
// This means EVERY permit without a dollar value scores 10/20 on this dimension.
//
// Fixed behavior: Use the enrichment-estimated value OR valueTier as proxy.
// A "Commercial - New" permit should score differently than a "Residential - Repair"

export function scoreValue(
  lead: LeadScoringInput,
  org: OrgScoringContext
): ScoreDimension {
  // ... existing setup ...

  // CHANGE: When estimatedValue is null, use valueTier as a proxy signal
  if (value == null && lead.valueTier != null) {
    const tierScores: Record<string, number> = {
      high: 18,    // High-value projects score near max
      medium: 12,  // Medium-value projects score moderately
      low: 5,      // Low-value projects score low
    };
    dim.score = tierScores[lead.valueTier] ?? 10;
    dim.reasons.push(`Estimated ${lead.valueTier} value project`);
    return dim;
  }

  // ... rest of existing logic for when estimatedValue is present ...
}
```

**Phase 4: Urgency dimension -- add more signals**

```typescript
// src/lib/scoring/urgency.ts -- MODIFIED
// Key change: Differentiate permit urgency by project type and recency

// Current behavior: ALL permits get flat 5 points
// This is 50% of all leads getting an identical urgency score.
//
// Fixed behavior: Recent permits with high-value project types get more urgency.
// A commercial new construction permit filed yesterday is more urgent than
// a residential repair permit from 3 weeks ago.

// Add these new signals:
// permit + commercial/industrial + <7 days old    = 8pts "Recent commercial permit"
// permit + residential new       + <7 days old    = 7pts "Recent residential construction"
// permit + any                   + <3 days old    = 7pts "Very recent permit"
// permit + any                   + <14 days old   = 5pts "Active building permit"
// permit + any                   + >= 14 days old = 3pts "Older permit -- may be claimed"
```

### Score Variance Analysis (Before vs After)

**Before fix:** Typical score range: 28-38 out of 100

| Dimension | Typical Range | Variance Source |
|-----------|--------------|-----------------|
| Distance | 0-25 | Only dimension with real variance |
| Relevance | 5-5 | Low-confidence flat +5 for all |
| Value | 10-10 | Always null -> always 10 |
| Freshness | 3-15 | Some variance from scrape date |
| Urgency | 5-5 | All permits -> flat 5 |

**After fix:** Expected score range: 15-85 out of 100

| Dimension | Expected Range | Variance Source |
|-----------|---------------|-----------------|
| Distance | 0-25 | Same (already works) |
| Relevance | 0-30 | projectType keyword matching per industry |
| Value | 0-20 | valueTier from enrichment-estimated values |
| Freshness | 0-15 | Same (already works) |
| Urgency | 0-10 | Recency + project type differentiation |

### Integration Points

| Existing File | Change Type | What Changes |
|--------------|-------------|-------------|
| `src/lib/scraper/enrichment.ts` | MODIFIED | Add `estimateValueFromProjectType()`, update `enrichLeads()` to set `valueTier` when `estimatedValue` is null |
| `src/lib/scoring/relevance.ts` | MODIFIED | Replace flat +5 low-confidence score with `scoreProjectTypeForIndustry()` |
| `src/lib/scoring/value.ts` | MODIFIED | Use `valueTier` as proxy when `estimatedValue` is null |
| `src/lib/scoring/urgency.ts` | MODIFIED | Differentiate permit urgency by project type + recency |
| `src/lib/scoring/types.ts` | NO CHANGE | Existing types already support all needed fields |
| `src/lib/leads/queries.ts` | NO CHANGE | Already calls `scoreLeadForOrg()` correctly |
| `src/app/api/cron/enrich/route.ts` | NO CHANGE | Already calls `enrichLeads()` |

---

## Architecture Change 3: Batch Pipeline Execution

### Problem

Current cron (`/api/cron/scrape`) runs ALL adapters sequentially in one function invocation. With `maxDuration = 300` seconds, this works for ~15 adapters but fails at 50+. The Socrata rate limiter allows 8 req/min -- 50 portals at 1 request each = 6+ minutes of waiting.

### Solution: Fan-Out Batch Pattern

```
/api/cron/scrape (orchestrator)
  |
  +-> POST /api/cron/scrape/batch?offset=0&limit=10
  +-> POST /api/cron/scrape/batch?offset=10&limit=10
  +-> POST /api/cron/scrape/batch?offset=20&limit=10
  +-> POST /api/cron/scrape/batch?offset=30&limit=10
  +-> POST /api/cron/scrape/batch?offset=40&limit=10
  ... (one request per batch of 10 adapters)
```

**Orchestrator cron (modified):**

```typescript
// src/app/api/cron/scrape/route.ts -- MODIFIED

export async function GET(request: NextRequest) {
  // ... auth check ...

  // Record pipeline run
  const [run] = await db.insert(pipelineRuns).values({ ... }).returning();

  // Get all enabled adapters from portal registry + static adapters
  const adapters = await getAllAdaptersFromRegistry();
  const BATCH_SIZE = 10;
  const batches = Math.ceil(adapters.length / BATCH_SIZE);

  // Fan out: fire batch requests in parallel
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const batchPromises = [];
  for (let i = 0; i < batches; i++) {
    batchPromises.push(
      fetch(`${baseUrl}/api/cron/scrape/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          pipelineRunId: run.id,
          offset: i * BATCH_SIZE,
          limit: BATCH_SIZE,
        }),
      })
    );
  }

  // Wait for all batches to complete (within 300s timeout)
  await Promise.allSettled(batchPromises);

  // ... update pipeline run, trigger digest ...
}
```

**Batch endpoint (new):**

```typescript
// src/app/api/cron/scrape/batch/route.ts (NEW FILE)

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // ... auth check ...
  const { pipelineRunId, offset, limit } = await request.json();

  const allAdapters = await getAllAdaptersFromRegistry();
  const batch = allAdapters.slice(offset, offset + limit);

  const result = await runPipeline(batch, { pipelineRunId });

  return Response.json({
    batchOffset: offset,
    batchSize: batch.length,
    totalScraped: result.results.reduce((s, r) => s + r.recordsScraped, 0),
    totalStored: result.results.reduce((s, r) => s + r.recordsStored, 0),
  });
}
```

### Why Not Vercel Background Functions?

The `waitUntil()` / `after()` pattern would let the orchestrator return immediately and continue processing, but it shares the same 300-second timeout. True background job processing would require an external queue (e.g., Inngest, QStash, or Upstash). For v4.0, the fan-out batch pattern stays within existing infrastructure and is simple to implement. If the pipeline grows beyond 100 adapters, consider QStash for fire-and-forget execution.

### Rate Limiting at Scale

The current rate limiter uses singleton p-queue instances per API provider. With batched execution, each batch runs in a separate function invocation, so the p-queue instances are NOT shared between batches. This is actually safer -- each batch has its own rate limiter, and the batch size (10 adapters per batch) keeps individual function execution well within the Socrata rate limit.

However, with 50+ Socrata portals across multiple batches, the global Socrata rate limit (1000 requests/hour with app token) could be hit. Mitigation: each adapter makes 1 request per scrape, so 50 portals = 50 requests per daily run -- well within the 1000/hour limit.

### Integration Points

| Existing File | Change Type | What Changes |
|--------------|-------------|-------------|
| `src/app/api/cron/scrape/route.ts` | MODIFIED | Orchestrator fans out to batch endpoint |
| `src/app/api/cron/scrape/batch/route.ts` | NEW | Batch execution endpoint |
| `src/lib/scraper/adapters/index.ts` | MODIFIED | `getAllAdapters()` queries `data_portals` + returns static adapters |
| `src/lib/scraper/pipeline.ts` | NO CHANGE | Already handles adapter arrays, error isolation |
| `vercel.json` | NO CHANGE | Only orchestrator cron needs scheduling |

---

## Architecture Change 4: Lead Feed Query Optimization

### Problem

`getFilteredLeadsWithCount()` fetches ALL leads within the Haversine radius (no SQL LIMIT), enriches them in JavaScript, sorts in memory, then paginates. At 3 cities this might be 2,000 leads. Nationwide could be 50,000-200,000 leads within a 100-mile radius of a major metro. This will OOM on Vercel (1GB default memory).

### Solution: DB-Side Filtering + PostGIS

The `leads` table already has a PostGIS `location` geometry column with a GiST index. Use it for spatial queries instead of computing Haversine in SQL on every row.

**Step 1: Populate `location` column on insert (pipeline change)**

```typescript
// src/lib/scraper/pipeline.ts -- MODIFIED
// In processRecords(), when upserting a lead with lat/lng:

const values = {
  // ... existing fields ...
  // ADD: populate PostGIS location column
  location: record.lat != null && record.lng != null
    ? sql`ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)`
    : null,
};
```

**Step 2: Use ST_DWithin for spatial queries**

```typescript
// src/lib/leads/queries.ts -- MODIFIED
// Replace Haversine WHERE clause with PostGIS ST_DWithin

// Convert miles to meters for ST_DWithin (geography cast)
const radiusMeters = radiusMiles * 1609.344;

// PostGIS spatial filter (uses GiST index)
const spatialCondition = sql`
  ST_DWithin(
    ${leads.location}::geography,
    ST_SetSRID(ST_MakePoint(${orgContext.hqLng}, ${orgContext.hqLat}), 4326)::geography,
    ${radiusMeters}
  )
`;

// Distance expression (still needed for scoring, but only computed on filtered set)
const distanceExpr = sql<number>`
  ST_DistanceSphere(
    ${leads.location},
    ST_SetSRID(ST_MakePoint(${orgContext.hqLng}, ${orgContext.hqLat}), 4326)
  ) / 1609.344
`.mapWith(Number);
```

**Step 3: Push coarse filtering into SQL**

For the primary sort, push the distance dimension into SQL so the DB can ORDER BY it. The full 5-dimension score still needs JS computation, but we can filter out clearly-irrelevant leads at the DB level:

```sql
-- SQL WHERE clause additions (not exact Drizzle syntax):
WHERE
  ST_DWithin(location::geography, hq_point::geography, radius_meters)
  AND (applicable_industries && ARRAY['heavy_equipment']::text[] OR applicable_industries = '{}')
  AND scraped_at > NOW() - INTERVAL '30 days'
ORDER BY
  ST_DistanceSphere(location, hq_point) ASC
LIMIT 200
```

This reduces the JS scoring workload from 200K leads to 200 leads.

**Step 4: Paginated scoring with cursor**

The existing `getFilteredLeadsCursor()` function already uses cursor-based pagination. Modify it to:
1. Use PostGIS `ST_DWithin` instead of Haversine WHERE
2. Add `applicableIndustries` filter at SQL level
3. Add `scrapedAt > 30 days ago` filter at SQL level
4. Limit to 200 rows per cursor batch (already uses `CURSOR_BATCH_SIZE = 50`)

### Integration Points

| Existing File | Change Type | What Changes |
|--------------|-------------|-------------|
| `src/lib/scraper/pipeline.ts` | MODIFIED | Set `location` column on insert/upsert |
| `src/lib/leads/queries.ts` | MODIFIED | Replace Haversine with PostGIS ST_DWithin, add SQL-level industry/date filters |
| `src/lib/db/schema/leads.ts` | NO CHANGE | `location` column and GiST index already exist |

### Note on Neon + PostGIS

Neon PostgreSQL supports PostGIS -- the `location` column and GiST index are already defined in the schema. ST_DWithin on a GiST-indexed geometry column is dramatically faster than computing Haversine on every row. Neon's pricing is based on compute units (CU-hours), not query count, so spatial queries don't cost more than Haversine queries -- they just use less compute time.

---

## Architecture Change 5: New Data Source Integration

### Data Source Inventory

Each source maps to an adapter type. Sources marked "Generic" use the dynamic portal discovery system. Sources marked "Custom" need dedicated adapter files.

| Source | Type | Adapter Pattern | Priority | Confidence |
|--------|------|----------------|----------|------------|
| Socrata permit portals (hundreds) | permit | Generic Socrata | P0 | HIGH |
| ArcGIS Hub permit portals (hundreds) | permit | Generic ArcGIS (NEW) | P1 | MEDIUM |
| SAM.gov federal bids | bid | Custom (exists) | P0 | HIGH |
| USAspending.gov | bid | Custom (NEW) | P2 | MEDIUM |
| NWS storm alerts | storm | Custom (exists) | P0 | HIGH |
| FEMA disasters | disaster | Custom (exists) | P0 | HIGH |
| Socrata violation portals | violation | Generic Socrata | P1 | HIGH |
| Census Building Permits Survey | permit | Custom (NEW) | P3 | MEDIUM |
| HUD residential permits by county | permit | Custom (NEW) | P3 | MEDIUM |
| State DOT bid boards | bid | Custom per state (deferred) | P4 | LOW |
| ENR / ConstructionDive news | news | Custom (exists) | P0 | HIGH |
| RSS news feeds | news | Custom (exists) | P0 | HIGH |
| EIA utility rates | utility | Custom (exists) | P0 | HIGH |
| DSIRE incentive database | incentive | Custom (NEW) | P2 | MEDIUM |
| Google dorking | deep-web | Custom (exists) | P1 | HIGH |

### New Source Types to Add to Schema

```typescript
// src/lib/scraper/adapters/base-adapter.ts -- MODIFIED
export const sourceTypes = [
  "permit", "bid", "news", "deep-web", "storm",
  "disaster", "violation",
  // NEW:
  "incentive",   // Tax credits, rebate programs (solar, EV, energy efficiency)
  "utility",     // Utility rate changes (already exists in data but not in sourceTypes)
] as const;
```

### Generic ArcGIS Adapter (New)

```typescript
// src/lib/scraper/adapters/generic-arcgis-adapter.ts (NEW FILE)

export class GenericArcGISAdapter implements ScraperAdapter {
  constructor(portal: DataPortalRow) { /* ... */ }

  async scrape(): Promise<RawLeadData[]> {
    // ArcGIS Feature Services expose a query endpoint:
    // GET https://{domain}/arcgis/rest/services/{service}/FeatureServer/0/query
    //   ?where=issue_date > DATE '2026-02-17'
    //   &outFields=*
    //   &f=json
    //   &resultRecordCount=1000
    const url = `https://${this.domain}${this.servicePath}/query`;
    const params = new URLSearchParams({
      where: `${this.fieldMap.dateField} > DATE '${thirtyDaysAgo}'`,
      outFields: "*",
      f: "json",
      resultRecordCount: "1000",
    });
    // ... fetch, map records using fieldMap ...
  }
}
```

### USAspending API Adapter (New)

```typescript
// src/lib/scraper/adapters/usaspending-adapter.ts (NEW FILE)
// Endpoint: https://api.usaspending.gov/api/v2/search/spending_by_award/
// Filters: NAICS codes for construction, date range
// Free, no API key required, rate limit is generous
```

### Integration Points for New Sources

| Existing File | Change Type | What Changes |
|--------------|-------------|-------------|
| `src/lib/scraper/adapters/base-adapter.ts` | MODIFIED | Add `"incentive"` and `"utility"` to `sourceTypes` |
| `src/lib/scraper/adapters/index.ts` | MODIFIED | Import and instantiate new adapters |
| `src/lib/scoring/relevance.ts` | MODIFIED | Add `SOURCE_TYPE_TO_LEAD_TYPE` entries for new types |
| `src/lib/scoring/urgency.ts` | NO CHANGE | Already handles incentive/storm/bid urgency |
| `src/lib/scraper/api-rate-limiter.ts` | MODIFIED | Add rate limiter for ArcGIS, USAspending |

---

## Data Flow (Before vs After)

### Before (Current)

```
Vercel Cron -> getAllAdapters() [hardcoded 15 adapters]
  -> runPipeline() [sequential, single invocation]
    -> adapter.scrape() [fetch from source]
    -> validate (Zod)
    -> geocode (if no lat/lng)
    -> upsert to leads table
    -> dedup
  -> enrichLeads() [separate cron, sets applicableIndustries]
  -> User opens dashboard
    -> getFilteredLeadsCursor() [Haversine on all rows, score in JS]
    -> Return scored leads
```

### After (v4.0)

```
Weekly: /api/cron/discover
  -> Query Socrata Discovery API for permit/violation datasets
  -> Query ArcGIS Hub Search API for Feature Services
  -> Infer field mappings from column names
  -> Upsert into data_portals table

Daily: /api/cron/scrape (orchestrator)
  -> Query data_portals for enabled portals
  -> Instantiate GenericSocrataAdapter / GenericArcGISAdapter per portal
  -> Add static adapters (SAM.gov, NWS, FEMA, news, etc.)
  -> Fan out to /api/cron/scrape/batch (batches of 10)
    -> runPipeline(batch) [existing pipeline, error-isolated]
      -> adapter.scrape()
      -> validate (Zod)
      -> geocode (if no lat/lng)
      -> upsert to leads table + populate location column
      -> dedup

Daily: /api/cron/enrich (enhanced)
  -> enrichLeads()
    -> inferApplicableIndustries() [existing]
    -> estimateValueFromProjectType() [NEW -- sets valueTier]
    -> inferSeverity() [NEW -- sets severity for violations]

User opens dashboard:
  -> getFilteredLeadsCursor()
    -> ST_DWithin spatial filter [PostGIS GiST index]
    -> SQL-level industry/date/sourceType filters
    -> Fetch 200 candidates (not all)
    -> Score in JS with fixed scoring engine [produces 15-85 range]
    -> Sort, paginate, return
```

---

## Patterns to Follow

### Pattern 1: Config-Driven Adapters

**What:** Store adapter configuration as data (DB rows) instead of code (TypeScript files). The adapter class reads config at runtime.

**When:** Any data source where the only difference between instances is field names and endpoint URLs. Socrata portals and ArcGIS Feature Services are ideal candidates.

**Example:** See Generic Socrata Adapter in Change 1 above.

**Why:** Adding a new city goes from "write a TypeScript file, import it, deploy" to "insert a DB row." The discovery cron can add cities automatically.

### Pattern 2: Fan-Out Batch Execution

**What:** An orchestrator cron splits work into batches and fires parallel HTTP requests to a batch endpoint. Each batch runs in its own serverless function invocation.

**When:** Total work exceeds a single function's timeout but each batch fits comfortably.

**Example:** See Batch Pipeline Runner in Change 3 above.

**Why:** Stays within Vercel's infrastructure. No external queue needed. Each batch gets its own 300-second timeout.

### Pattern 3: Enrichment as Inference Layer

**What:** Treat enrichment as a data inference step that fills in missing fields, not just tagging. Estimate values, infer severity, classify industries using heuristics.

**When:** Source data is sparse (most Socrata portals omit valuation, many lack project type details).

**Why:** The scoring engine can only produce variance from data that exists. If 80% of leads have null values on a scoring dimension, that dimension contributes no differentiation. Enrichment fills the gaps.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: One File Per City

**What:** Creating `phoenix-permits.ts`, `chicago-permits.ts`, `nyc-permits.ts`, etc.
**Why bad:** Maintenance nightmare at 100+ cities. Each file does the same thing with different column names. Deployment required for each new city.
**Instead:** Generic adapter + portal registry (DB-driven configuration).

### Anti-Pattern 2: Scoring in SQL

**What:** Trying to compute the full 5-dimension score as a SQL expression.
**Why bad:** The scoring function uses org-specific context (specializations, preferred lead types, industry keywords) that requires procedural logic. SQL expressions would be unmaintainable.
**Instead:** Use SQL for spatial filtering and coarse filtering. Score the filtered result set (200 rows, not 200K) in JavaScript.

### Anti-Pattern 3: Fetching All Leads for Pagination

**What:** `SELECT * FROM leads WHERE distance < radius` with no LIMIT, then paginating in JS.
**Why bad:** OOM at scale. 200K rows * 500 bytes = 100MB per request.
**Instead:** Use PostGIS ST_DWithin for spatial filtering (GiST indexed), apply SQL-level filters for industry/date/sourceType, LIMIT to 200 rows, score in JS, cursor-paginate.

### Anti-Pattern 4: Global Rate Limiter Across Batches

**What:** Trying to share a p-queue instance across serverless function invocations.
**Why bad:** Serverless functions are stateless. A singleton in one invocation is invisible to another.
**Instead:** Design batch sizes so each batch respects rate limits independently. 10 Socrata adapters per batch, each making 1 request = 10 requests per batch invocation, well within the 8 req/min limit.

---

## Scalability Considerations

| Concern | At 3 Cities (Now) | At 100 Portals | At 500 Portals |
|---------|-------------------|----------------|----------------|
| Pipeline execution time | ~30s single invocation | ~5 batches x 60s each | ~50 batches, fan-out with QStash |
| Leads in DB | ~5,000 | ~100,000 | ~500,000+ |
| Feed query (50mi radius, metro) | ~500 leads, JS scoring OK | ~5,000 leads, PostGIS + LIMIT needed | ~20,000 leads, PostGIS essential |
| Neon compute (daily scrape) | ~0.01 CU-hours | ~0.1 CU-hours | ~0.5 CU-hours |
| Geocoding API calls | ~200/day | ~2,000/day | ~10,000/day -- need free geocoder |
| Vercel function invocations | 11 crons/day | ~20 crons/day | ~60 crons/day |
| Neon storage | ~50 MB | ~500 MB | ~2 GB |

### Geocoding at Scale

At 500+ portals generating 10K+ new leads/day, the Google Maps Geocoding API ($5/1000 requests) becomes expensive. Solutions:

1. **Prefer portals that include lat/lng** -- many Socrata portals do. The discovery service should flag portals with geographic columns.
2. **Use Nominatim (OpenStreetMap)** for batch geocoding -- free, self-hosted or API with 1 req/sec limit.
3. **Geocode asynchronously** -- new leads without coordinates get geocoded by a separate cron, not blocking the pipeline.

### Neon Connection Pooling

The neon-http driver used by this project is connectionless (HTTP-based), so traditional connection pooling is not a concern. Each query is an independent HTTP request. At 500 portals with batch fan-out, the peak concurrent requests to Neon would be ~10 (one per batch), well within the 10K pooled connection limit.

---

## Suggested Build Order

Based on dependency analysis and the principle of "fix what is broken before adding more":

### Phase 1: Fix Scoring Engine (No Dependencies)

**Files to modify:**
- `src/lib/scraper/enrichment.ts` -- Add `estimateValueFromProjectType()`, update `enrichLeads()` to set `valueTier`
- `src/lib/scoring/relevance.ts` -- Replace flat low-confidence score with `scoreProjectTypeForIndustry()`
- `src/lib/scoring/value.ts` -- Use `valueTier` as proxy when `estimatedValue` is null
- `src/lib/scoring/urgency.ts` -- Differentiate permit urgency by project type + recency

**Validation:** Run enrichment on existing leads, then verify score distribution. Should see range of 15-85 instead of 28-38.

**Why first:** Scoring fix is independent of all other changes. Produces immediate visible improvement for existing leads. No schema changes needed. No risk of breaking the pipeline.

### Phase 2: Portal Registry + Generic Adapter

**Files to create:**
- `src/lib/db/schema/data-portals.ts` -- New table schema
- `src/lib/scraper/portal-field-map.ts` -- Field map Zod schema
- `src/lib/scraper/adapters/generic-socrata-adapter.ts` -- Config-driven adapter
- `src/lib/scraper/discovery/field-mapper.ts` -- Column name inference

**Files to modify:**
- `src/lib/db/schema/index.ts` -- Export `dataPortals`
- `src/lib/scraper/adapters/index.ts` -- `getAllAdapters()` reads from `data_portals` + static adapters

**Seed data:** Migrate Austin, Dallas, Atlanta configs to `data_portals` rows.

**Validation:** Run pipeline with generic adapter for Austin, verify same results as hardcoded `AustinPermitsAdapter`.

**Why second:** Enables adding portals without code changes. Prerequisite for discovery cron and nationwide expansion.

### Phase 3: PostGIS Query Optimization

**Files to modify:**
- `src/lib/scraper/pipeline.ts` -- Populate `location` column on upsert
- `src/lib/leads/queries.ts` -- Replace Haversine WHERE with ST_DWithin, add SQL-level filters

**Migration:** Backfill `location` column for existing leads: `UPDATE leads SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL`

**Validation:** Compare query results before/after. Same leads returned, faster execution.

**Why third:** Prevents feed queries from breaking when lead count grows 10-100x. Must be done before large-scale data ingestion.

### Phase 4: Batch Pipeline Execution

**Files to create:**
- `src/app/api/cron/scrape/batch/route.ts` -- Batch execution endpoint

**Files to modify:**
- `src/app/api/cron/scrape/route.ts` -- Orchestrator fans out to batch endpoint

**Validation:** Run pipeline with 20+ adapters, verify all batches complete within timeout.

**Why fourth:** Only needed once adapter count exceeds what fits in 300 seconds. With generic adapter + portal registry, this becomes necessary.

### Phase 5: Discovery Cron + Nationwide Expansion

**Files to create:**
- `src/app/api/cron/discover/route.ts` -- Weekly discovery cron
- `src/lib/scraper/discovery/socrata-discovery.ts` -- Socrata catalog API client
- `src/lib/scraper/discovery/arcgis-discovery.ts` -- ArcGIS Hub API client

**Files to modify:**
- `vercel.json` -- Add discover cron schedule

**Validation:** Run discovery, verify new portals appear in `data_portals`. Run pipeline, verify leads from new portals.

**Why fifth:** Depends on portal registry (Phase 2), batch execution (Phase 4), and query optimization (Phase 3). This is the "go nationwide" phase.

### Phase 6: New Data Source Adapters

**Files to create:**
- `src/lib/scraper/adapters/generic-arcgis-adapter.ts`
- `src/lib/scraper/adapters/usaspending-adapter.ts`
- `src/lib/scraper/adapters/dsire-incentive-adapter.ts`

**Files to modify:**
- `src/lib/scraper/adapters/base-adapter.ts` -- Add new source types
- `src/lib/scraper/adapters/index.ts` -- Register new adapters
- `src/lib/scraper/api-rate-limiter.ts` -- Add rate limiters for new APIs

**Why last:** New sources add breadth but depend on scoring (Phase 1) and query optimization (Phase 3) being in place first. Adding more leads to a broken scoring engine or an unoptimized feed query makes the problems worse.

---

## Sources

- [Socrata Discovery API documentation](https://dev.socrata.com/docs/other/discovery) - HIGH confidence
- [Socrata Discovery API Apiary docs](https://socratadiscovery.docs.apiary.io/) - HIGH confidence
- [ArcGIS Hub v3 Search API](https://gist.github.com/jgravois/1b7ec5080e992a59f65cf7a2190e4365) - MEDIUM confidence
- [Neon PostgreSQL pricing and limits](https://neon.com/pricing) - HIGH confidence
- [Vercel function duration limits](https://vercel.com/docs/functions/configuring-functions/duration) - HIGH confidence
- [Vercel cron job management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) - HIGH confidence
- [Data.gov permit datasets](https://catalog.data.gov/dataset/?tags=permits) - HIGH confidence
- [USAspending API](https://api.usaspending.gov/) - HIGH confidence
- [SAM.gov contracting API](https://sam.gov/contracting) - HIGH confidence
- Codebase analysis: `src/lib/scoring/`, `src/lib/scraper/`, `src/lib/leads/queries.ts`, `src/lib/db/schema/` - PRIMARY SOURCE
