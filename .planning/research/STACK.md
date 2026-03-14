# Stack Research

**Domain:** Multi-tenant SaaS -- Web Scraping + Lead Intelligence Platform (Heavy Machinery)
**Researched:** 2026-03-13
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x | Full-stack framework (App Router) | Current stable. Turbopack default for 10x faster dev refresh, React 19.2 + React Compiler built in, Server Components for dashboard performance, API routes for webhook handlers. The SaaS boilerplate ecosystem is centered on Next.js -- more production templates, auth integrations, and billing examples than any alternative. |
| TypeScript | 5.x | Type safety across entire codebase | Non-negotiable for a multi-service app where scrapers, API, and UI share types. Catches malformed lead data shapes at compile time, not in production. |
| PostgreSQL | 16+ | Primary database | ACID transactions for billing/subscription data, JSONB columns for flexible scraped lead schemas (permits vary wildly by municipality), PostGIS extension for geographic radius filtering (core requirement), row-level security patterns for multi-tenancy. The project needs relational integrity (tenants, users, subscriptions, leads) AND flexible document storage (heterogeneous scrape results) -- PostgreSQL handles both. |
| Redis | 7.x | Job queues, caching, rate limiting | Required by BullMQ for job scheduling. Also serves as scrape result cache (deduplication), rate limiter for outbound requests, and session store. |
| Crawlee | 3.16.x | Web scraping framework | Purpose-built for exactly this use case. Unified API across HTTP (Cheerio), Playwright, and adaptive modes. Built-in request queuing, automatic retries, session management, proxy rotation, and anti-bot evasion. Eliminates months of building scraping infrastructure from scratch. TypeScript-native. |
| Playwright | 1.58.x | Browser automation (via Crawlee) | Cross-browser headless rendering for JavaScript-heavy sites (bid boards, permit portals with dynamic search forms). Used through Crawlee's PlaywrightCrawler -- not directly. Preferred over Puppeteer because permit portals may use non-Chrome browsers and Playwright handles modern SPAs more reliably. |

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Drizzle ORM | 0.45.x | TypeScript ORM | 10-20% of raw SQL performance overhead (vs Prisma's 2-4x). ~7.4kb bundle (90% smaller than Prisma). No code generation step -- schema changes reflect instantly in the TypeScript API. SQL-like query builder means complex geo queries (PostGIS) and JSONB operations don't fight the ORM abstraction. |
| Neon | -- | Managed PostgreSQL | Serverless PostgreSQL with autoscaling, database branching for dev/staging, scale-to-zero for cost efficiency in early stage. $0.35/GB-month storage after 2025 price cuts. Native Drizzle ORM support. Eliminates database ops overhead for a small team. |
| Upstash Redis | -- | Managed Redis | HTTP-based API works in serverless/edge contexts (Next.js middleware). Pay-per-request pricing scales to zero when scraping isn't running. Free tier covers development. Supports BullMQ via standard Redis protocol. |

### Authentication & Multi-Tenancy

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth | 1.5.x | Authentication framework | Auth.js/NextAuth merged under Better Auth's maintenance in Sept 2025. First-class organization plugin provides multi-tenant support out of the box: org creation, role-based access (owner/admin/member), invitation workflows, org switching. Built-in rate limiting, MFA, and password policies. Plugin architecture keeps core lightweight. Framework-agnostic if backend needs change later. |

### Job Processing & Scheduling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| BullMQ | 5.71.x | Job queue and scheduler | The standard for Node.js background jobs. Cron-based scheduling for daily scrape runs. Job dependencies for multi-stage pipelines (scrape -> parse -> enrich -> deduplicate -> store). Automatic retries with exponential backoff for flaky government sites. Rate limiting to respect robots.txt. Parent-child job relationships for complex scraping DAGs. Built on Redis Streams. |

### Frontend & UI

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS | 4.2.x | Utility-first CSS | v4 is a Rust-based ground-up rewrite. 5x faster builds, 100x faster incremental. CSS-native @theme configuration (no JS config). The standard for modern React apps, especially with shadcn/ui. |
| shadcn/ui | CLI v4 (Mar 2026) | Component library | Not a dependency -- copies components into your project for full control. Built on Radix UI primitives (accessible by default). CLI v4 adds AI agent compatibility, design system presets. Every SaaS boilerplate in the Next.js ecosystem uses shadcn/ui as the UI layer. |
| TanStack Table | 8.x | Data table for lead dashboard | Headless, so it integrates with shadcn/ui styling. Sorting, filtering, pagination, column pinning built in. Handles 50K+ rows with virtualization. The lead feed dashboard is the core UI -- this is the right tool for it. |
| Recharts | 3.8.x | Charts and data visualization | Declarative React components built on D3. Lightweight. Used for lead analytics, scraping activity dashboards, geographic distribution views. 3.6M+ weekly downloads -- battle-tested. |

### AI/NLP (Lead Enrichment)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenAI API (GPT-4o-mini) | Latest | Entity extraction, lead classification | Structured Outputs mode extracts equipment types, project details, contact info, and estimated equipment needs from scraped text in a validated JSON schema. gpt-4o-mini is cost-effective for high-volume extraction (~$0.15/1M input tokens). Classify leads by relevance score. Generate outreach talking points. |
| Zod | 4.3.x | Schema validation | 14x faster string parsing vs v3. Validates scraped data, API inputs, and OpenAI structured output schemas. Drizzle ORM integrates Zod validators directly (drizzle-zod now built into drizzle-orm package). Single validation library across the entire stack. |

### Payments & Billing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Stripe | SDK v17+ | Subscription billing + one-time setup fees | Checkout with mode=subscription handles trial periods, failed payment retries (Smart Retries), dunning emails, proration. Supports the project's "one-time setup fee + subscription" model via Stripe Checkout line items. Webhook-based architecture fits Next.js API routes. |

### Proxy Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Oxylabs OR Bright Data | -- | Residential proxy rotation | Government permit sites and bid boards often block datacenter IPs. Residential proxies provide real IP addresses that pass anti-bot checks. Oxylabs: 175M+ IP pool, 99.95% success rate. Bright Data: largest network, granular geo-targeting (useful for region-specific permit sites). Budget $7-10/GB. Start with Oxylabs for simplicity; switch to Bright Data if specific municipality sites need advanced unblocking. |

### Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Railway | -- | Application hosting | Visual project canvas groups web app + worker processes + databases. Best DX of any PaaS. Connects services visually, manages env vars across services, deploys everything together. Usage-based pricing ($5-20/month for early stage). Scraping workers run as separate Railway services alongside the Next.js app. |
| Vercel | -- | Next.js frontend (alternative) | If deploying frontend separately from scraping workers. Native Next.js 16 support, edge functions, automatic preview deployments. Workers would still need Railway/Render for long-running scrape jobs (Vercel functions timeout at 60s on Pro). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Biome | Linter + formatter | Replaces ESLint + Prettier in a single Rust-based tool. 10-100x faster. Opinionated defaults reduce config debates. |
| Vitest | Unit/integration testing | Vite-native test runner. Compatible with Jest API but significantly faster. First-class TypeScript support. |
| Playwright Test | E2E testing | Same Playwright used for scraping, also used for testing the dashboard UI. One browser automation tool for both purposes. |
| Docker Compose | Local dev environment | Run PostgreSQL, Redis, and worker processes locally. Matches production topology. |
| Drizzle Kit | Database migrations | Generates SQL migrations from Drizzle schema changes. Inspect/push commands for quick iteration. |

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Database
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# Authentication
npm install better-auth

# Job queue
npm install bullmq ioredis

# Scraping
npm install crawlee playwright

# AI/Enrichment
npm install openai zod

# UI
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
npm install @tanstack/react-table recharts

# Payments
npm install stripe

# Dev dependencies
npm install -D typescript @types/node @types/react @biomejs/biome vitest @playwright/test
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Drizzle ORM | Prisma 7 (pure TS rewrite) | If team already knows Prisma. v7 removes Rust engine, but still has code generation step and larger bundles. Choose Prisma if you prefer schema-first workflow over SQL-like queries. |
| Crawlee + Playwright | Scrapy (Python) | If scraping complexity outgrows Node.js and you need a dedicated Python scraping service. Scrapy has the largest plugin ecosystem for scraping. Would require a polyglot architecture (Python workers + Node.js app). Avoid unless JavaScript scraping hits hard limits. |
| Better Auth | Clerk | If you want zero auth code. Clerk is a hosted auth service ($25+/month at scale) with excellent Next.js integration. Choose if time-to-market matters more than cost and control. Not recommended because the organization plugin in Better Auth covers multi-tenancy needs at zero per-user cost. |
| PostgreSQL + PostGIS | MongoDB | If scraped data structure is truly unpredictable AND you don't need geographic queries. PostgreSQL's JSONB handles schema flexibility, and PostGIS is essential for radius-based filtering. MongoDB would require a separate geo solution. |
| BullMQ | Temporal | If scraping workflows become extremely complex (100+ step DAGs with human approval steps, long-running sagas). Massive overkill for v1 -- BullMQ's parent-child jobs cover multi-stage scraping pipelines. Revisit if the system evolves to need workflow orchestration beyond job queues. |
| Railway | Render | If you need first-class background worker service types and cron jobs as platform primitives. Render defines workers and cron as distinct service types (no manual setup). Choose Render if Railway's "everything is a service" model feels too freeform. |
| Neon | Supabase | If you want a full backend-as-a-service (auth, realtime, storage) in addition to PostgreSQL. Supabase bundles more but has higher baseline cost and you'd be paying for features Better Auth already covers. |
| Oxylabs | ScraperAPI / ScrapingBee | If you want scraping + proxy as a single API (send URL, get HTML). Simpler but less control. Higher per-request cost at scale. Choose for prototyping, switch to raw proxies + Crawlee when costs matter. |
| GPT-4o-mini | Claude 3.5 Haiku | Comparable cost and performance for structured extraction. Claude may produce better results for nuanced construction terminology. Test both on real permit data during development. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer (standalone) | Chrome-only, no built-in queuing/retries/proxy rotation. You'd rebuild half of Crawlee's features manually. Google maintenance, not community-driven scraping tool. | Crawlee with PlaywrightCrawler |
| Bull (v3/v4) | Legacy predecessor to BullMQ. No longer actively developed. BullMQ has better TypeScript support, Redis Streams backend, and job dependency trees. | BullMQ |
| NextAuth.js / Auth.js (standalone) | Auth.js merged under Better Auth maintenance (Sept 2025). v5 was stuck in beta for years. Better Auth has proper plugin architecture, built-in rate limiting, and first-class organization/multi-tenant support. | Better Auth |
| Mongoose + MongoDB | Adds unnecessary complexity. You need relational data (tenants, users, subscriptions, lead assignments) AND geographic queries (PostGIS). MongoDB would require a separate geo solution and you lose ACID for billing. | PostgreSQL + Drizzle ORM |
| Selenium | Outdated, heavy, Java-oriented. 10x slower than Playwright for the same tasks. No modern TypeScript ecosystem integration. | Playwright via Crawlee |
| node-cron / Agenda | Simple cron schedulers without job queuing, retries, rate limiting, or dependency chains. Fine for "run this every hour" but not for production scraping pipelines with error handling. | BullMQ |
| Express.js | Separate server when Next.js App Router + API routes handle API needs. Adding Express creates two routing layers, two middleware stacks, and deployment complexity. | Next.js API Routes + Server Actions |
| Tailwind CSS v3 | v4 is stable since Jan 2025. v3 uses JavaScript config (deprecated pattern). v4's Rust engine is 5-100x faster and uses CSS-native configuration. | Tailwind CSS v4 |
| TypeORM / Sequelize | Heavy, class-based ORMs with poor TypeScript inference. TypeORM has known bugs that have been open for years. Both generate bloated queries. | Drizzle ORM |

## Stack Patterns by Variant

**If scraping volume stays under 10K pages/day:**
- Run CheerioCrawler (HTTP-only) for static permit pages -- 10x faster than browser rendering
- Reserve PlaywrightCrawler for JavaScript-required bid boards only
- Single Railway worker service handles all scraping
- Datacenter proxies ($2-3/GB) may suffice, saving on residential proxy costs

**If scraping volume exceeds 50K pages/day:**
- Separate scraping workers by source type (permits, bid boards, news, deep web)
- Each source type runs as its own Railway service with independent scaling
- Must use residential proxies -- government sites will block datacenter IPs at this volume
- Consider adding a dedicated Redis instance (not Upstash) for BullMQ at high throughput
- Move from Neon to dedicated PostgreSQL (e.g., Railway managed Postgres) if write volume causes autoscale cost spikes

**If AI enrichment costs become significant (>$100/month):**
- Batch scraped text and process with GPT-4o-mini in bulk
- Cache enrichment results -- same project description shouldn't be re-processed
- Consider fine-tuning a smaller model on construction/equipment terminology for classification
- Use Zod structured outputs to enforce schema and reduce retry costs from malformed responses

**If deploying frontend and workers separately:**
- Next.js app on Vercel (optimal Next.js hosting, preview deployments, edge caching)
- Scraping workers + BullMQ on Railway (long-running processes, no function timeouts)
- Both connect to Neon (PostgreSQL) and Upstash (Redis)
- Use shared npm workspace for TypeScript types between packages

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.x | React 19.2, Tailwind CSS 4.x, shadcn/ui CLI v4 | Turbopack is the default bundler. React Compiler enabled out of the box. |
| Drizzle ORM 0.45.x | Neon serverless driver, PostgreSQL 16+, Zod 4.x | drizzle-zod validators now built into the main drizzle-orm package. Use @neondatabase/serverless as the driver. |
| Crawlee 3.16.x | Playwright 1.58.x, Cheerio (bundled) | Crawlee pins its own Playwright version. Let Crawlee manage the Playwright dependency to avoid version conflicts. |
| BullMQ 5.71.x | Redis 7.x, Upstash Redis, ioredis 5.x | Requires Redis 5+ (Streams support). Upstash is compatible via standard Redis protocol. Use ioredis as the connection library. |
| Better Auth 1.5.x | Next.js 16.x, Drizzle ORM 0.45.x | Has a Drizzle adapter. Organization plugin requires explicit opt-in. |
| Tailwind CSS 4.2.x | Next.js 16.x via @tailwindcss/vite | No more tailwind.config.js -- use @theme in CSS. PostCSS plugin deprecated in favor of Vite plugin. |
| Zod 4.3.x | Drizzle ORM (built-in), OpenAI SDK | OpenAI SDK uses Zod for structured output schemas. Drizzle ORM integrates Zod validators. Single version across the stack. |

## Architecture Note

This stack is deliberately **monoglot TypeScript**. Scraping, API, UI, job processing, and schema validation all share one language, one type system, and one package manager. This is a deliberate choice:

- **Against Python scraping:** Scrapy is more mature for pure scraping, but introducing Python creates a polyglot architecture with separate deployments, separate CI, separate type systems, and a message-passing boundary between scraper and app. For a small team shipping an MVP, the coordination cost outweighs Scrapy's advantages. Crawlee provides 90% of Scrapy's capabilities in TypeScript.

- **Against microservices:** The scraper, API, and dashboard should share Drizzle schemas, Zod validators, and TypeScript types. Deploy as separate processes (Next.js app + BullMQ workers) within the same codebase (monorepo), not as separate services with API contracts between them.

## Sources

- [Next.js 16 release blog](https://nextjs.org/blog/next-16) -- Verified Turbopack stability, React 19.2, React Compiler. HIGH confidence.
- [Next.js 16.1 release](https://nextjs.org/blog/next-16-1) -- Confirmed latest stable. HIGH confidence.
- [Crawlee GitHub](https://github.com/apify/crawlee) -- Verified v3.16.x, feature set, Playwright/Cheerio support. HIGH confidence.
- [Crawlee docs](https://crawlee.dev/js) -- Confirmed adaptive crawler, anti-bot features, TypeScript-native. HIGH confidence.
- [BullMQ docs](https://docs.bullmq.io) -- Verified v5.71.x, job dependencies, cron scheduling, Redis Streams. HIGH confidence.
- [BullMQ npm](https://www.npmjs.com/package/bullmq) -- Confirmed v5.71.0 published 2026-03-11. HIGH confidence.
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) -- Confirmed v0.45.1. HIGH confidence.
- [Drizzle vs Prisma comparison (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/) -- Performance benchmarks, bundle size comparison. MEDIUM confidence.
- [Drizzle vs Prisma (MakerKit)](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) -- Prisma 7 pure TS rewrite confirmed. MEDIUM confidence.
- [Better Auth docs](https://better-auth.com/) -- Verified v1.5.5, organization plugin, multi-tenant features. HIGH confidence.
- [Auth.js joins Better Auth announcement](https://better-auth.com/blog/authjs-joins-better-auth) -- Confirmed Sept 2025 merger. HIGH confidence.
- [Better Auth organization plugin docs](https://better-auth.com/docs/plugins/organization) -- Verified RBAC, invitations, org switching. HIGH confidence.
- [Neon serverless Postgres](https://neon.com/) -- Verified autoscaling, branching, $0.35/GB pricing. HIGH confidence.
- [Neon pricing breakdown (Vela/Simplyblock)](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) -- 2025 price cuts confirmed. MEDIUM confidence.
- [Upstash Redis comparison](https://upstash.com/docs/redis/overall/compare) -- HTTP API, pay-per-request, BullMQ compatibility. HIGH confidence.
- [Tailwind CSS v4 release blog](https://tailwindcss.com/blog/tailwindcss-v4) -- Rust engine, CSS-native config confirmed. HIGH confidence.
- [shadcn/ui CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- March 2026, AI agent skills, design presets. HIGH confidence.
- [Zod v4 announcement (InfoQ)](https://www.infoq.com/news/2025/08/zod-v4-available/) -- 14x faster parsing, @zod/mini confirmed. MEDIUM confidence.
- [Zod npm](https://www.npmjs.com/package/zod) -- Confirmed v4.3.6. HIGH confidence.
- [Recharts npm](https://www.npmjs.com/package/recharts) -- Confirmed v3.8.0. HIGH confidence.
- [Playwright npm](https://www.npmjs.com/package/playwright) -- Confirmed v1.58.2. HIGH confidence.
- [Stripe Node.js SDK releases](https://github.com/stripe/stripe-node/releases) -- v17+ confirmed for 2026 API versions. MEDIUM confidence.
- [PostgreSQL JSONB for SaaS (Medium)](https://medium.com/@hashbyt/postgresql-as-nosql-the-complete-guide-for-saas-leaders-1c772b8ed107) -- JSONB indexing, multi-tenant patterns. MEDIUM confidence.
- [PostgreSQL vs MongoDB for web scraping (Data-Ox)](https://data-ox.com/comparison-postgresql-vs-mysql-vs-mongodb-for-web-scraping) -- Both viable; PostgreSQL wins for relational + flexible. MEDIUM confidence.
- [Railway vs Render comparison (Northflank)](https://northflank.com/blog/railway-vs-render) -- Worker process differences, pricing models. MEDIUM confidence.
- [Web scraping legal guide (McCarthy Law)](https://mccarthylg.com/is-web-scraping-legal-a-2025-breakdown-of-what-you-need-to-know/) -- Public government data scraping legality. MEDIUM confidence.
- [Proxy comparison (ScrapingBee)](https://www.scrapingbee.com/blog/rotating-proxies/) -- Oxylabs, Bright Data pricing and pool sizes. MEDIUM confidence.
- [OpenAI structured outputs cookbook](https://cookbook.openai.com/examples/named_entity_recognition_to_enrich_text) -- Entity extraction patterns. MEDIUM confidence.

---
*Stack research for: HeavyLeads -- Multi-tenant SaaS Lead Intelligence Platform*
*Researched: 2026-03-13*
