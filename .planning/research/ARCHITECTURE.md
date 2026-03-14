# Architecture Research

**Domain:** Web scraping lead intelligence SaaS (heavy machinery / construction)
**Researched:** 2026-03-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

HeavyLeads is a data pipeline with a SaaS frontend. The core insight: this is NOT a typical CRUD app with scraping bolted on. It is a **data ingestion and enrichment system** that happens to have a web dashboard. Architecture must reflect that the scraping/processing pipeline is the product's engine, while the web app is the window into it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Dashboard    │  │  Onboarding  │  │  Lead Detail + Outreach  │  │
│  │  (Lead Feed)  │  │  Wizard      │  │  Suggestions             │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                │
├─────────┴─────────────────┴───────────────────────┴────────────────┤
│                          API LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              REST API (Auth, Tenant Context, Queries)        │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
├─────────────────────────────┴──────────────────────────────────────┤
│                     APPLICATION SERVICES                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │  Lead       │  │  Tenant      │  │  Geo       │  │  Auth    │ │
│  │  Service    │  │  Service     │  │  Service   │  │  Service │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └──────────┘ │
├─────────┴────────────────┴───────────────┴─────────────────────────┤
│                   DATA PROCESSING PIPELINE                         │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ Scraper   │  │  Enrichment  │  │  Dedup /    │  │  Lead     │ │
│  │ Workers   │──│  Engine      │──│  Entity     │──│  Scorer   │ │
│  │           │  │              │  │  Resolution │  │           │ │
│  └─────┬─────┘  └──────────────┘  └─────────────┘  └─────┬─────┘ │
│        │                                                  │       │
│  ┌─────┴─────┐                                     ┌──────┴─────┐ │
│  │  Job      │                                     │  Tenant    │ │
│  │  Queue    │                                     │  Matcher   │ │
│  │  (Redis)  │                                     │            │ │
│  └───────────┘                                     └────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  PostgreSQL  │  │  Redis       │  │  Raw Data Store          │ │
│  │  + PostGIS   │  │  (Cache +    │  │  (scraped HTML / JSON)   │ │
│  │  (Leads,     │  │   Queue)     │  │                          │ │
│  │   Tenants)   │  │              │  │                          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Dashboard / Lead Feed** | Display daily leads filtered by tenant preferences (equipment type, geography) | Next.js or React SPA with server-side filtering |
| **Onboarding Wizard** | Capture company HQ location, equipment types sold, service radius | Multi-step form writing to tenant config table |
| **Lead Detail View** | Show project info, contacts, estimated equipment needs, outreach suggestions | Detail page pulling enriched lead data |
| **REST API** | Tenant-scoped queries, authentication, lead CRUD (mark read, flag, dismiss) | Node.js/Express or Next.js API routes with middleware |
| **Lead Service** | Query leads scoped to tenant preferences, handle pagination/filtering | PostgreSQL queries with PostGIS radius + equipment type filters |
| **Tenant Service** | Manage company accounts, preferences, subscription status | CRUD on tenant config with row-level security |
| **Geo Service** | Convert addresses to lat/lng, compute radius matches, geocoding | PostGIS ST_DWithin + geocoding API (Google Maps or Nominatim) |
| **Auth Service** | User authentication, session management, tenant association | Standard JWT/session auth (NextAuth, Clerk, or Lucia) |
| **Scraper Workers** | Fetch data from permit sites, bid boards, news sources | Headless browser (Playwright) + HTTP fetchers per source type |
| **Enrichment Engine** | Extract structured data from raw scrapes: project name, location, equipment hints, contacts | NLP/regex parsing + optional LLM extraction for unstructured text |
| **Dedup / Entity Resolution** | Prevent duplicate leads from multiple sources describing the same project | Content hashing + fuzzy matching on project name + address |
| **Lead Scorer** | Rank leads by relevance to each tenant's equipment types and geography | Scoring algorithm based on equipment keyword matches + distance |
| **Job Queue** | Orchestrate scraping jobs, retries, scheduling, rate limiting | BullMQ on Redis with scheduled/recurring jobs |
| **Tenant Matcher** | After a lead is scored globally, determine which tenants should see it | Match lead equipment tags + location against all tenant profiles |
| **Raw Data Store** | Preserve original scraped content for reprocessing and audit | Filesystem or S3-compatible storage with source URL + timestamp |

## Recommended Project Structure

```
heavyleads/
├── apps/
│   └── web/                        # Next.js application
│       ├── app/                    # App router pages
│       │   ├── (auth)/             # Auth pages (login, register)
│       │   ├── (dashboard)/        # Authenticated pages
│       │   │   ├── leads/          # Lead feed and detail views
│       │   │   ├── settings/       # Company settings, preferences
│       │   │   └── onboarding/     # First-time setup wizard
│       │   └── api/                # API routes
│       ├── components/             # React components
│       └── lib/                    # Client-side utilities
├── packages/
│   ├── db/                         # Database schema, migrations, client
│   │   ├── schema/                 # Drizzle or Prisma schema files
│   │   ├── migrations/             # SQL migration files
│   │   └── seed/                   # Seed data for development
│   ├── core/                       # Shared business logic
│   │   ├── leads/                  # Lead domain logic
│   │   ├── tenants/                # Tenant domain logic
│   │   ├── geo/                    # Geographic utilities
│   │   └── scoring/                # Lead scoring algorithms
│   └── scrapers/                   # Scraping pipeline
│       ├── sources/                # One module per data source
│       │   ├── permits/            # Building permit scrapers
│       │   ├── bid-boards/         # Bid board scrapers
│       │   ├── news/               # Construction news scrapers
│       │   └── google-dork/        # Google advanced search queries
│       ├── enrichment/             # Data extraction and enrichment
│       │   ├── parsers/            # Source-specific parsers
│       │   ├── geocoder/           # Address to lat/lng
│       │   ├── equipment-tagger/   # Equipment type detection
│       │   └── contact-extractor/  # Contact info extraction
│       ├── dedup/                  # Deduplication logic
│       ├── queue/                  # BullMQ job definitions
│       └── worker.ts               # Worker process entry point
├── docker-compose.yml              # Local dev: Postgres + Redis
├── turbo.json                      # Monorepo task runner config
└── package.json                    # Root workspace config
```

### Structure Rationale

- **`apps/web/`:** The web application is a single Next.js app. No need for separate frontend/backend repos at this scale. API routes handle tenant-scoped queries directly.
- **`packages/db/`:** Shared database schema used by both the web app and scraper workers. Single source of truth for data models. Keeps migrations versioned and reviewable.
- **`packages/core/`:** Business logic that both the API and the pipeline need (e.g., scoring a lead, checking tenant preferences). Avoids duplicating logic between web and workers.
- **`packages/scrapers/`:** Isolated from the web app intentionally. Scrapers run as background workers on a separate process (or separate deployment). Each data source gets its own module because permit sites, bid boards, and news sources have completely different structures and failure modes.
- **Monorepo with Turborepo:** Keeps everything in one repo for simplicity while allowing independent deployment of web app vs. worker processes.

## Architectural Patterns

### Pattern 1: Shared-Schema Multi-Tenancy with Row-Level Filtering

**What:** All tenants share the same database tables, isolated by a `tenant_id` column on every tenant-scoped table. Queries always filter by tenant context.
**When to use:** MVP through mid-scale (up to hundreds of tenants). This is the right choice for HeavyLeads because tenant data volume is low (hundreds of leads per day per tenant) and operational simplicity matters more than hard isolation.
**Trade-offs:**
- Pro: Simple to implement, no schema duplication, easy cross-tenant analytics
- Pro: One database to back up, migrate, and monitor
- Con: A missing WHERE clause leaks data across tenants (mitigate with middleware/RLS)
- Con: One noisy tenant can impact query performance for others (unlikely at this scale)

**Example:**
```sql
-- PostgreSQL Row-Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Every API request sets tenant context before queries
SET app.current_tenant_id = '<tenant-uuid>';
SELECT * FROM leads WHERE created_at > NOW() - INTERVAL '1 day';
-- RLS automatically adds: AND tenant_id = '<tenant-uuid>'
```

**Confidence:** HIGH -- this is the standard pattern for B2B SaaS at this scale per AWS, Azure, and WorkOS multi-tenant architecture guides.

### Pattern 2: Pipeline-First Data Architecture (Scrape -> Enrich -> Score -> Match)

**What:** Scraped data flows through a sequential pipeline. Each stage transforms the data and is independently retryable. Leads exist in a "global" pool before being matched to specific tenants.
**When to use:** Always for this type of product. The scraping pipeline produces leads that are tenant-agnostic initially (a building permit is a building permit regardless of who's looking). Tenant matching happens as the last step.
**Trade-offs:**
- Pro: Scraping cost is O(sources), not O(sources * tenants) -- scrape once, match to many
- Pro: Each pipeline stage can fail and retry independently
- Pro: New tenants immediately see historical leads that match their profile
- Con: Requires a clear data model for "raw lead" vs "tenant-matched lead"
- Con: Tenant matcher must run whenever a new tenant signs up or changes preferences

**Pipeline stages:**
```
[Scraper] --> Raw Data Store (HTML/JSON)
    |
    v
[Parser/Extractor] --> Structured Lead Record
    |
    v
[Geocoder] --> Lead + lat/lng coordinates
    |
    v
[Equipment Tagger] --> Lead + equipment_types[]
    |
    v
[Deduplicator] --> Merged/deduplicated lead
    |
    v
[Tenant Matcher] --> tenant_leads join table (lead_id, tenant_id, score)
```

**Confidence:** HIGH -- this is how Shovels.ai, ConstructionMonitor, and similar platforms structure their data pipelines.

### Pattern 3: Job Queue with Source-Specific Workers

**What:** Each data source type (permits, bid boards, news) gets its own queue and worker logic. A scheduler triggers daily batch runs. Failed jobs go to source-specific retry queues with exponential backoff.
**When to use:** When scraping multiple heterogeneous sources with different failure modes, rate limits, and data formats.
**Trade-offs:**
- Pro: A broken permit scraper does not block bid board scraping
- Pro: Can tune concurrency and retry strategy per source
- Pro: Easy to add new sources without touching existing ones
- Con: More queues to monitor
- Con: Need a "pipeline complete" signal when all sources finish for the day

**Example:**
```typescript
// BullMQ queue per source type
const permitQueue = new Queue('scrape:permits', { connection: redis });
const bidBoardQueue = new Queue('scrape:bid-boards', { connection: redis });
const newsQueue = new Queue('scrape:news', { connection: redis });

// Daily scheduler adds jobs for all known sources
const scheduler = new Queue('scheduler', { connection: redis });
await scheduler.add('daily-batch', {}, {
  repeat: { pattern: '0 2 * * *' } // 2 AM daily
});

// Scheduler worker fans out to source-specific queues
new Worker('scheduler', async (job) => {
  const permitSources = await db.query('SELECT * FROM scrape_sources WHERE type = $1', ['permit']);
  for (const source of permitSources) {
    await permitQueue.add('scrape', { sourceId: source.id, url: source.url });
  }
  // ... same for bid boards, news
}, { connection: redis });
```

**Confidence:** HIGH -- BullMQ is the standard Node.js job queue, and source-specific queues are a well-documented pattern for heterogeneous scraping.

## Data Flow

### Daily Batch Scraping Flow

```
[Cron Scheduler (2 AM)]
    |
    v
[Scheduler Worker] --fans out--> [Permit Queue] [Bid Board Queue] [News Queue]
    |                                   |                |              |
    v                                   v                v              v
                              [Source Workers - Playwright/HTTP]
                                        |
                                        v
                              [Raw Data Store (S3/filesystem)]
                                        |
                                        v
                              [Parser/Enrichment Queue]
                                        |
                                        v
                    ┌───────────────────┼───────────────────┐
                    v                   v                   v
            [Geocoder]        [Equipment Tagger]    [Contact Extractor]
                    |                   |                   |
                    └───────────────────┼───────────────────┘
                                        v
                              [Deduplication Engine]
                                        |
                                        v
                              [Leads Table (global pool)]
                                        |
                                        v
                              [Tenant Matcher]
                                        |
                                        v
                              [tenant_leads join table]
                                        |
                                        v
                    [Dashboard shows new leads to each tenant]
```

### User Request Flow

```
[Sales Rep opens Dashboard]
    |
    v
[Next.js Page] --> [API Route: GET /api/leads]
    |
    v
[Auth Middleware: verify JWT, extract tenant_id]
    |
    v
[Lead Service: query with tenant filters]
    |
    v
[PostgreSQL + PostGIS]
    SELECT l.*, tl.score
    FROM leads l
    JOIN tenant_leads tl ON l.id = tl.lead_id
    WHERE tl.tenant_id = $1
      AND ST_DWithin(l.location, $2, $3)  -- within service radius
      AND l.equipment_types && $4          -- array overlap with tenant equipment
    ORDER BY tl.score DESC, l.created_at DESC
    |
    v
[JSON response --> Dashboard renders lead cards]
```

### Key Data Flows

1. **Scrape-to-Lead pipeline:** Runs daily at ~2 AM. Scheduler fans out source URLs to per-type queues. Workers fetch, store raw data, then push to enrichment queue. Enrichment adds geocoding, equipment tags, and contacts. Dedup merges duplicates. Tenant matcher scores and assigns to tenants. Entire pipeline takes 1-4 hours depending on source count.

2. **Lead-to-Dashboard query:** User-initiated. Tenant-scoped query joining leads with tenant_leads, filtered by PostGIS radius and equipment type array overlap. Should be sub-second with proper indexes.

3. **Tenant onboarding backfill:** When a new tenant completes onboarding (sets HQ, equipment types, radius), the tenant matcher runs against the existing lead pool to populate their feed immediately. This is a one-time batch job per new tenant.

4. **Source management:** Admin adds/removes scrape sources via a config table. Each source has a URL, type (permit/bid/news), scraping strategy (browser vs HTTP), and schedule override. New sources get picked up on the next daily run.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 tenants (MVP) | Single PostgreSQL instance, single worker process, local file storage for raw data. BullMQ on the same Redis instance used for caching. Everything runs on one or two servers. |
| 50-500 tenants | Add read replica for dashboard queries. Move raw data storage to S3. Separate worker deployment from web app. Add monitoring (queue depth, scrape success rate). Consider managed PostgreSQL (RDS/Supabase). |
| 500+ tenants | Partition tenant_leads table by tenant_id. Add Redis cluster for queue scaling. Multiple worker processes with concurrency tuning. CDN for static assets. This is the point where you might consider a dedicated enrichment service. |

### Scaling Priorities

1. **First bottleneck: Scraper throughput.** As you add more sources (hundreds of permit jurisdictions), scraping time grows. Fix: increase worker concurrency, add worker replicas, use proxy rotation to avoid rate limits. This is a linear scaling problem and straightforward.

2. **Second bottleneck: Tenant matching at scale.** When the tenant matcher runs after each batch, it must check every new lead against every tenant's preferences. Fix: precompute tenant preferences into a spatial index + equipment bitmask, so matching is a set intersection rather than N*M comparisons.

3. **Third bottleneck: Dashboard query latency.** With millions of historical leads, the tenant_leads join table grows large. Fix: partition by date (only show last 90 days by default), add composite indexes on (tenant_id, created_at, score).

## Anti-Patterns

### Anti-Pattern 1: Scraping Per-Tenant Instead of Globally

**What people do:** Run separate scraping jobs for each tenant, filtering at scrape time based on their preferences.
**Why it's wrong:** If 50 tenants overlap on the same permit jurisdiction, you scrape it 50 times. Wastes resources, hits rate limits, and the same lead gets stored 50 times without dedup.
**Do this instead:** Scrape globally into a shared lead pool, then match leads to tenants. Scraping cost scales with sources, not tenants.

### Anti-Pattern 2: Storing Scraped Data Only in Parsed Form

**What people do:** Parse the HTML during scraping and only store the extracted fields. Discard the raw HTML/JSON.
**Why it's wrong:** When you improve your parser (and you will, constantly), you cannot reprocess historical data. When a bug corrupts parsed data, you have no recovery path.
**Do this instead:** Store raw scraped content (HTML, JSON) in cheap storage (filesystem or S3) with a reference ID. Parsed/enriched data goes into PostgreSQL. You can always reprocess raw data through an improved pipeline.

### Anti-Pattern 3: Tight Coupling Between Scraper and Enrichment

**What people do:** Parse, geocode, and score leads inside the scraper worker itself.
**Why it's wrong:** When the geocoding API is rate-limited or down, the entire scraping pipeline stalls. Different enrichment steps have different failure modes and retry strategies.
**Do this instead:** Scraper workers only fetch and store raw data, then enqueue an enrichment job. Enrichment stages are separate workers on separate queues. Each can fail and retry independently.

### Anti-Pattern 4: Using Distance Calculation in Application Code

**What people do:** Load all leads into application memory, then filter by calculating Haversine distance in JavaScript.
**Why it's wrong:** Does not scale. With 100K leads and a radius filter, you're loading and iterating all of them on every request.
**Do this instead:** Use PostGIS ST_DWithin() which leverages spatial indexes. The database does the radius filtering efficiently at the storage layer.

### Anti-Pattern 5: URL-Only Deduplication

**What people do:** Deduplicate leads by checking if the source URL was already scraped.
**Why it's wrong:** The same construction project appears on multiple sources (a permit filing AND a bid board listing AND a news article). URL dedup misses these cross-source duplicates entirely.
**Do this instead:** Deduplicate on a composite of project attributes: normalized address + project description hash + date range. Use fuzzy matching for project names since "Walmart Distribution Center - Phase 2" and "New Walmart DC Phase II" are the same project.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Permit/bid board sites** | Scraper workers with Playwright (JS-rendered sites) or HTTP client (static sites) | Each jurisdiction is different. Expect to maintain 50-200+ scraper configs. Respect robots.txt. |
| **Geocoding API** | REST calls during enrichment stage (Google Geocoding API or OpenCage) | Rate-limited. Cache aggressively -- addresses don't move. Budget for ~$5/1000 requests on Google. |
| **Proxy service** | HTTP proxy rotation for scraping to avoid IP blocks | Use a residential proxy service (Bright Data, Oxylabs). Required once you hit rate limits. Not needed for MVP. |
| **Shovels.ai API** | REST API for pre-aggregated permit data as an alternative to direct scraping | Covers ~85% of US population. Could supplement or replace direct permit scraping for covered jurisdictions. Priced per API call. |
| **Authentication provider** | NextAuth.js or Clerk for user auth + tenant association | Clerk is simpler for multi-tenant; NextAuth is more flexible. Both work. |
| **Payment processor** | Stripe for subscription + one-time setup fee billing | Stripe handles the "setup fee + recurring" model natively with Checkout. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Web App <-> Database** | Direct query via ORM (Drizzle/Prisma) | Same network, low latency. Tenant context set via RLS or middleware. |
| **Scheduler <-> Scraper Workers** | BullMQ job queue (Redis) | Decoupled. Scheduler adds jobs, workers consume independently. |
| **Scraper Workers <-> Enrichment** | BullMQ job queue (Redis) | Each completed scrape enqueues an enrichment job with the raw data reference. |
| **Enrichment <-> Lead Storage** | Direct database write | After enrichment completes, writes structured lead to PostgreSQL. |
| **Tenant Matcher <-> Lead Storage** | Database read + write | Reads new unmatched leads, reads tenant profiles, writes to tenant_leads join table. |
| **Web App <-> Redis** | Cache layer for frequently-accessed data | Cache tenant preferences, daily lead counts, dashboard aggregations. |

## Build Order Implications

The dependency chain dictates the build order. Each phase below depends on the one before it.

1. **Database schema + tenant model first.** Everything depends on the data model: leads table, tenants table, tenant_leads join table, PostGIS geography columns. Get this right before writing any application code. Includes: migrations, seed data, PostGIS setup.

2. **Auth + basic web app second.** Tenant onboarding (HQ location, equipment types, radius) and user authentication. This gives you a working app shell that can display data, even if there's no data yet. Can seed with fake leads for development.

3. **Scraping pipeline third.** Start with 2-3 easy sources (one permit site, one bid board, one news source). Get the full pipeline working end-to-end: scrape -> store raw -> parse -> geocode -> tag equipment -> dedup -> store lead. This is the hardest and most iterative component.

4. **Enrichment + scoring fourth.** Once raw leads are flowing, improve extraction quality: better equipment detection, contact extraction, lead scoring. This is continuous improvement, not a one-time build.

5. **Tenant matching + filtered dashboard fifth.** Connect the global lead pool to tenant-specific views. PostGIS radius filtering, equipment type filtering, score-based ranking. This is where the product comes together.

6. **Billing + operational tooling last.** Stripe integration, admin dashboard for monitoring scraper health, source management UI. These are important but not blockers for validating core product value.

## Sources

- [AWS: Data Ingestion in Multi-Tenant SaaS](https://aws.amazon.com/blogs/apn/data-ingestion-in-a-multi-tenant-saas-environment-using-aws-services/) -- multi-tenant data pipeline patterns
- [WorkOS: Developer's Guide to Multi-Tenant Architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) -- tenant isolation strategies
- [Clerk: How to Design Multi-Tenant SaaS Architecture](https://clerk.com/blog/how-to-design-multitenant-saas-architecture) -- shared-schema vs database-per-tenant tradeoffs
- [ScrapeGraph AI: Zero to Production Scraping Pipeline](https://scrapegraphai.com/blog/zero-to-production-scraping-pipeline) -- production scraping pipeline architecture
- [Bright Data: Guide to Distributed Web Crawling](https://brightdata.com/blog/web-data/distributed-web-crawling) -- scaling scraping infrastructure
- [BullMQ Documentation: Architecture](https://docs.bullmq.io/guide/architecture) -- job queue architecture for Node.js
- [PostGIS: Use ST_DWithin for Radius Queries](https://postgis.net/documentation/tips/st-dwithin/) -- spatial radius filtering
- [PostGIS: Spatial Queries](https://postgis.net/docs/using_postgis_query.html) -- geographic query patterns
- [Shovels.ai: Building Permit API](https://www.shovels.ai/api) -- existing permit data aggregation platform
- [ConstructionMonitor](https://www.constructionmonitor.com/) -- existing construction lead platform architecture reference
- [Things Solver: Data Deduplication and Entity Resolution](https://thingsolver.com/blog/data-deduplication-and-entity-resolution/) -- dedup/entity resolution patterns
- [GroupBWT: Web Scraping Infrastructure](https://groupbwt.com/blog/infrastructure-of-web-scraping/) -- production scraping infrastructure patterns

---
*Architecture research for: HeavyLeads -- web scraping lead intelligence SaaS for heavy machinery*
*Researched: 2026-03-13*
