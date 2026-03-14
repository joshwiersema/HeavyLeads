# Project Research Summary

**Project:** HeavyLeads — Multi-Tenant SaaS Lead Intelligence Platform
**Domain:** Web scraping + lead generation SaaS for heavy machinery dealers and rental companies
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

HeavyLeads is a data pipeline product with a SaaS frontend — not a CRUD app with scraping bolted on. The core insight from research is that the scraping and enrichment engine IS the product; the web dashboard is simply the window into it. No competitor in the construction lead generation space (Dodge, ConstructConnect, Building Radar, Construction Monitor) targets heavy machinery dealers specifically. The differentiated value proposition is equipment-need inference: automatically mapping "12-story hotel construction" to "likely needs excavators, boom lifts, cranes, telehandlers." That mapping intelligence, combined with multi-source data aggregation, is the moat.

The recommended approach is a monoglot TypeScript monorepo (Next.js 16 + Drizzle ORM + PostgreSQL/PostGIS + BullMQ + Crawlee) deployed on Railway. The architecture follows a pipeline-first pattern: scrape globally into a shared lead pool, enrich and deduplicate, then match leads to tenants in a final step. This means scraping cost scales with the number of sources, not with the number of customers — a critical efficiency that must be baked into the data model on day one. Multi-tenancy uses shared-schema isolation with PostgreSQL row-level security and must be established before the first customer is onboarded.

The top risks are operational rather than technical. Municipality permit data exists across 20,000+ jurisdictions with no standard format — national coverage is a years-long infrastructure investment. Scoping to the customer's actual geographic region (starting with Sioux Center, IA and surrounding metros) is non-negotiable for launch. Silent scraper failures delivering stale data are the single fastest way to destroy product trust. And multi-tenant data leakage between competing equipment dealers would be immediately catastrophic. Both require defense-in-depth from day one, not as retrofits.

## Key Findings

### Recommended Stack

The stack is deliberately monoglot TypeScript throughout. Scraping (Crawlee + Playwright), job processing (BullMQ + Redis), API (Next.js App Router), database (PostgreSQL via Drizzle ORM), and validation (Zod) all share one language, one type system, and one package manager. This eliminates the coordination cost of polyglot architectures and allows the scraper, API, and dashboard to share Drizzle schemas and TypeScript types directly.

PostgreSQL with PostGIS is the only correct database choice here. The product needs both relational integrity (tenants, subscriptions, lead assignments) and flexible document storage (heterogeneous permit schemas vary wildly by municipality) — JSONB columns cover the latter. PostGIS ST_DWithin for radius filtering is a core requirement that cannot be handled in application code at scale. Better Auth 1.5.x (which absorbed Auth.js/NextAuth in Sept 2025) handles multi-tenancy with its organization plugin out of the box.

**Core technologies:**
- **Next.js 16.x**: Full-stack framework with App Router — Turbopack default, React 19.2 + React Compiler, API routes for webhooks
- **PostgreSQL 16 + PostGIS**: Primary database — ACID for billing, JSONB for flexible lead schemas, PostGIS for radius filtering
- **Drizzle ORM 0.45.x**: TypeScript ORM — 10-20% overhead vs raw SQL (not Prisma's 2-4x), SQL-like queries don't fight PostGIS operations
- **Redis 7.x (Upstash)**: Job queues + caching + rate limiting — HTTP API works in serverless contexts
- **Crawlee 3.16.x**: Web scraping framework — built-in queuing, retries, proxy rotation, anti-bot evasion, TypeScript-native
- **BullMQ 5.71.x**: Job queue + scheduler — cron scheduling, job dependencies for multi-stage pipelines, exponential backoff
- **Better Auth 1.5.x**: Authentication — organization plugin provides multi-tenant RBAC, invitations, org switching out of the box
- **OpenAI GPT-4o-mini**: Entity extraction and lead classification via Structured Outputs — $0.15/1M input tokens
- **Stripe SDK v17+**: Subscription billing + setup fees — native support for "one-time setup fee + subscription" model
- **Railway**: Application hosting — visual canvas for web app + worker processes, usage-based pricing ($5-20/month early stage)

### Expected Features

The market gap is unambiguous: all major construction lead services (Dodge, ConstructConnect, Building Radar) serve general contractors and subcontractors. None are built for equipment dealers. HeavyLeads wins not by having more leads but by having the right intelligence layer — equipment-need inference — that makes construction project data actionable for equipment sales reps.

**Must have (table stakes) — v1 launch:**
- Daily lead feed dashboard — users expect "open and see what's new"; stale data = immediate churn
- Geographic filtering (radius from dealer HQ) — more intuitive than state-based for regional equipment dealers
- Equipment type/project type filtering — showing irrelevant leads wastes trust; THIS IS THE PRODUCT
- Lead detail view — project info, location map, contacts, estimated equipment needs, source attribution
- Company onboarding wizard — set HQ, equipment types, service radius to configure the feed
- Auth + multi-tenant accounts — company-level accounts with user seats, role-based access
- Lead status tracking (New/Contacted/Won/Lost) — seeds conversion data needed for future scoring models
- Daily email digest — sales reps live in email; "X new leads today" with top 5 and link to dashboard
- Data freshness indicators — show discovered date and age badges; staleness destroys trust

**Should have (differentiators) — v1.x after validation:**
- Equipment-need inference (rule-based first, ML later) — the "magic" that justifies the product; start with taxonomy mapping
- Bid board scraping — second data source after permit pipeline is stable
- News/press release scraping — third source, broadens coverage
- Multi-source deduplication — required once 2+ sources are active; same project on permits + news + bid boards
- Outreach talking points — template-based in v1.x, LLM-powered in v2; NOT automated outreach
- Saved searches and bookmarks — users will request this within the first month
- Advanced search and filtering — keyword, value range, date range, project phase

**Defer (v2+) — after product-market fit:**
- Google dorking / deep web discovery — high value but high legal scrutiny; validate PMF first
- Fleet expansion detection — separate data pipeline (job postings, press releases); validate project leads first
- CRM integration (Salesforce, HubSpot) — explicitly scoped to v2 in project requirements
- ML lead scoring — needs conversion data from v1 lead status tracking before training
- Contact enrichment — cross-referencing with LinkedIn and company websites
- Mobile native app — responsive web works on mobile; native doubles development cost
- Permit-to-equipment timeline mapping — requires project phase detection; complex

### Architecture Approach

HeavyLeads is a data ingestion and enrichment system, not a typical SaaS app. The pipeline-first architecture is mandatory: scrape globally into a tenant-agnostic lead pool, enrich through sequential stages (parse -> geocode -> equipment tag -> deduplicate), then match to tenants as the final step. This means scraping cost is O(sources), not O(sources × tenants). A new tenant immediately sees historical leads matching their profile with no additional scraping cost.

The monorepo structure (`apps/web/` + `packages/db/` + `packages/core/` + `packages/scrapers/`) allows the web app and scraper workers to share Drizzle schemas and business logic while deploying as separate processes. The web app runs on Railway as a Next.js service; scraper workers run as separate long-running Railway services (bypassing Vercel's 60s function timeout). All communicate through shared PostgreSQL and Redis.

**Major components:**
1. **Scraper Workers** — Crawlee-based workers per source type (permits, bid boards, news), fetch and store raw HTML/JSON only, then enqueue enrichment jobs; each source type has its own BullMQ queue
2. **Enrichment Pipeline** — sequential stages: Parser -> Geocoder -> Equipment Tagger -> Contact Extractor -> Deduplicator; each stage is independently retryable via separate queues
3. **Tenant Matcher** — after enrichment, scores each lead against all tenant profiles and writes to `tenant_leads` join table; re-runs on tenant onboarding to backfill history
4. **Lead Service + PostGIS** — tenant-scoped queries using ST_DWithin for radius filtering and array overlap for equipment type matching; sub-second with proper indexes
5. **Job Scheduler** — BullMQ cron at 2 AM daily fans out source URLs to per-type queues; entire pipeline takes 1-4 hours depending on source count
6. **Next.js Web App** — App Router with server components for dashboard performance, API routes for tenant-scoped lead queries, webhook handlers for Stripe

### Critical Pitfalls

1. **Municipality format chaos** — 20,000 permitting jurisdictions with zero standard format; build a scraper adapter framework with pluggable configs before writing any scrapers; start with 50-mile radius from customer HQ, not national coverage; investigate Shovels.ai API before building custom scrapers for every jurisdiction

2. **Silent scraper failures delivering stale leads** — scrapers return HTTP 200 but collect garbage after site redesigns; implement data quality gates (validate record counts against historical baselines, alert on <80% expected volume), HTML fingerprinting to detect DOM changes, and freshness tracking (`scraped_at`, `source_last_updated`) on every lead record from day one

3. **Multi-tenant data leakage** — missing `WHERE tenant_id` clauses between competing equipment dealers in the same region would be catastrophic; enforce isolation at both database level (PostgreSQL RLS) AND application level (middleware sets tenant context on every request); prefix ALL cache keys with `tenant:{id}:`; write automated cross-tenant isolation tests that run in CI

4. **Legal exposure from ToS-protected sources** — conflating "publicly visible" with "legally free to scrape"; classify every data source before building scrapers: Tier 1 (government permit portals — safe), Tier 2 (news sites — respect robots.txt), Tier 3 (Dodge/ConstructConnect — requires licensing, do not scrape); robots.txt compliance must be a hard framework constraint

5. **Infrastructure cost overrun from headless browsers** — each Playwright instance consumes 200-500MB RAM; classify sites upfront: static HTML (Cheerio — 10x cheaper), JS-rendered (Playwright — necessary but expensive), API-available (cheapest); track cost-per-lead by source; never use headless browsers for sites that don't require JavaScript rendering

## Implications for Roadmap

The architecture research prescribes the build order explicitly: data model before application, auth before features, scraping pipeline before enrichment, enrichment before tenant matching. The pitfalls research adds the constraint that legal review, adapter framework design, and tenant isolation architecture must happen before the first line of scraper code is written. The features research confirms a clear MVP scope: permit scraping + equipment inference + lead feed is the minimum to validate the core value proposition.

### Phase 0: Legal and Data Source Strategy

**Rationale:** PITFALLS.md is unambiguous — data source legal classification must happen before development begins. Scraping Dodge or ConstructConnect without a license is a recoverable mistake technically but potentially business-ending legally.
**Delivers:** Written data source inventory with tier classification (government/news/commercial); legal sign-off on scraping strategy; list of Tier 1 permit sources to target for launch geography; decision on Shovels.ai API vs. direct permit scraping
**Avoids:** Legal exposure (Pitfall 3), scraping commercial aggregators without licenses
**Research flag:** Not needed — this is a legal/business task, not an engineering research question

### Phase 1: Foundation (Data Layer + Auth + Infrastructure)

**Rationale:** Everything downstream depends on getting the data model right. Tenant isolation and the canonical lead schema cannot be retrofitted cheaply. The ARCHITECTURE.md build order confirms this must come first.
**Delivers:** PostgreSQL + PostGIS schema (tenants, users, leads, tenant_leads join table, scrape_sources config); Drizzle ORM setup with migrations; Better Auth multi-tenant auth (org creation, RBAC, invitation workflows); Docker Compose local dev environment; skeleton Next.js app with authenticated routes
**Addresses:** Auth + multi-tenancy (P1 feature), company onboarding wizard shell
**Avoids:** Multi-tenant data leakage (Pitfall 5) — RLS policies and tenant-aware middleware must be in this phase; lead deduplication data model failures (Pitfall 6) — canonical Project entity designed here
**Research flag:** Standard patterns — PostgreSQL RLS, Better Auth organization plugin, Drizzle migrations are well-documented

### Phase 2: Scraping Infrastructure + Permit Pipeline

**Rationale:** No leads without a data pipeline. This is the hardest and most iterative component. The scraper adapter framework must be established before ANY scrapers are built — this is the Phase 1 pitfall trap.
**Delivers:** Crawlee-based scraper framework with pluggable adapter pattern; BullMQ job queue with per-source queues; raw data storage (filesystem/S3 reference); initial permit scrapers for 3-5 jurisdictions in launch geography; basic Parser -> Geocoder -> Equipment Tagger -> Deduplicator pipeline; BullMQ scheduler with 2 AM daily cron
**Addresses:** Permit data scraping pipeline (P1), equipment-need inference rule-based (P1 differentiator)
**Avoids:** Municipality format chaos (Pitfall 1) — adapter framework prevents monolithic scraper brittleness; scraper maintenance burden (Pitfall 4) — configuration-driven from day one; infrastructure cost overrun (Pitfall 7) — tiered HTTP vs headless browser strategy implemented here; raw data store anti-pattern — raw HTML preserved for reprocessing
**Research flag:** Needs deeper research — specific permit portal platforms (Accela, CivicPlus) and their scraping characteristics; Shovels.ai API vs direct scraping cost-benefit for launch geography

### Phase 3: Lead Feed + Tenant Dashboard

**Rationale:** Once raw leads are flowing through the pipeline, connect them to tenant-specific views. This is where the product becomes usable by an actual sales rep.
**Delivers:** Tenant Matcher (scores and assigns leads to tenants based on equipment profile + radius); lead feed dashboard with TanStack Table (list view, age badges, equipment type + geographic filtering); lead detail view with project info, location map, equipment needs, source attribution; company onboarding wizard (HQ location, equipment types, service radius); tenant onboarding backfill job (new tenant sees historical leads immediately); data freshness indicators throughout UI
**Addresses:** Daily lead feed dashboard (P1), geographic filtering (P1), equipment type filtering (P1), lead detail view (P1), company onboarding wizard (P1), data freshness indicators (P1)
**Avoids:** Silent scraper failures (Pitfall 2) — freshness indicators surface stale data to users; UX pitfall of showing every scraped record as a lead — quality threshold filtering applied in Tenant Matcher
**Research flag:** Standard patterns for Next.js dashboard UIs; PostGIS ST_DWithin queries are well-documented

### Phase 4: Lead Management + Email Notifications

**Rationale:** Core table-stakes features that make the daily workflow complete for a sales rep. These depend on the lead feed being stable and validated.
**Delivers:** Lead status tracking (New/Contacted/Won/Lost) with persistence; daily email digest (transactional email via Postmark/SendGrid — NOT application server SMTP); saved searches and bookmarks; basic keyword search and filtering; data quality monitoring dashboard (scraper success rates, lead counts by source, freshness metrics)
**Addresses:** Lead status tracking (P1), daily email digest (P1), saved searches (P2), search + filtering (P2)
**Avoids:** Silent scraper failures (Pitfall 2 — full monitoring/alerting as Phase 4 deliverable); SMTP deliverability gotcha (use transactional email service from day one)
**Research flag:** Standard patterns — BullMQ for email job scheduling, Postmark/SendGrid integration is well-documented

### Phase 5: Billing + Operational Readiness

**Rationale:** Billing and operational tooling are important but not blockers for validating the core product value. Per ARCHITECTURE.md build order, these come last.
**Delivers:** Stripe subscription billing with "one-time setup fee + recurring" model via Checkout; webhook handlers for subscription lifecycle events (activated, cancelled, payment failed); admin dashboard for scraper health monitoring (red/yellow/green per source); source management UI (add/remove scrape sources via config); security hardening (API rate limiting, audit logging for contact data access, generic scraper user-agent strings)
**Addresses:** Subscription billing, operational monitoring
**Avoids:** Infrastructure cost overrun (cost-per-lead dashboard); security mistakes (Pitfall — no rate limiting on HeavyLeads API itself); scraper identification via user-agent headers
**Research flag:** Stripe Checkout for "setup fee + subscription" pattern may need verification — confirm line items configuration for combined one-time + recurring in a single Checkout session

### Phase 6: Multi-Source Expansion + Enrichment Upgrade

**Rationale:** After Phase 1-5 validate the core value prop with permit data, expand data sources. Deduplication engine becomes critical once 2+ sources are active.
**Delivers:** Bid board scrapers (second data source); news/press release scrapers (third source); multi-signal deduplication engine (geocoded address proximity + project type + entity name fuzzy matching); outreach talking points (template-based for v1, LLM-powered upgrade path); lead export (CSV) for CRM import; advanced filtering (value range, date range, project phase)
**Addresses:** Bid board scraping (P2), news scraping (P2), multi-source deduplication (P2), outreach talking points (P2), lead export (P2)
**Avoids:** Lead deduplication failures (Pitfall 6) — multi-signal dedup vs URL-only; deduplication anti-pattern (merge-not-delete strategy retains all source references)
**Research flag:** Fuzzy matching library selection (fuzz.js vs others) and deduplication threshold tuning requires experimentation; outreach talking point templates need domain expert review

### Phase Ordering Rationale

- Phase 0 before any code: Legal exposure is the only unrecoverable pitfall. Everything else can be fixed with engineering time.
- Phase 1 before Phase 2: The data model and tenant isolation architecture cannot be retrofitted. Schema changes at Phase 3 cost 10x more than getting them right at Phase 1.
- Phase 2 before Phase 3: The dashboard is meaningless without data. The scraping pipeline is the highest-risk component and needs the most iteration time.
- Phase 3 before Phase 4: Email notifications and lead management features require a working, validated lead feed. Building them in parallel risks building on an unstable foundation.
- Phase 5 last (except billing): Billing and ops tooling are necessary for launch but do not affect product-market fit validation. Core product value is proven before payment infrastructure is complete.
- Phase 6 after Phase 1-5: Multi-source expansion requires a stable foundation. Deduplication logic built before sources are proven wastes effort.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Scraping Infrastructure):** Specific permit portal platforms (Accela, CivicPlus, OpenGov) have different scraping characteristics and anti-bot postures. Research specific platforms for the 5-10 launch jurisdiction targets. Also research Shovels.ai API pricing at expected query volume vs. cost of direct scraping.
- **Phase 5 (Billing):** Stripe Checkout line items for combined one-time setup fee + recurring subscription in a single session — verify this is supported in the current Stripe API version before designing the billing flow.

Phases with well-documented patterns (skip deep research):
- **Phase 1 (Foundation):** PostgreSQL RLS, Better Auth organization plugin, Drizzle migrations, and Docker Compose local dev are thoroughly documented with many production examples.
- **Phase 3 (Lead Feed):** Next.js App Router dashboard patterns, TanStack Table, PostGIS ST_DWithin queries — all well-documented with production examples.
- **Phase 4 (Lead Management + Email):** BullMQ cron jobs and transactional email integration (Postmark/SendGrid) are standard patterns with extensive documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official release blogs, npm registry, and vendor documentation for every technology. Version compatibility matrix verified across all packages. |
| Features | MEDIUM-HIGH | Direct competitor research from public pricing/feature pages. Equipment dealer persona inferred from project requirements and industry context rather than primary customer research. |
| Architecture | HIGH | Pipeline-first data architecture corroborated by Shovels.ai, ConstructionMonitor, and AWS multi-tenant SaaS guides. PostGIS patterns verified against official documentation. |
| Pitfalls | HIGH | Multiple corroborating sources across legal, technical, and domain dimensions. hiQ v. LinkedIn ruling and CFAA analysis from legal sources. Multi-tenant leakage patterns from OWASP and production post-mortems. |

**Overall confidence:** HIGH

### Gaps to Address

- **Customer persona validation:** The equipment dealer persona (daily lead feed, morning review workflow, high-touch sales culture) is inferred from project requirements and indirect research. Should be validated with 3-5 conversations with actual equipment sales reps at New Tec or similar dealers before committing to UX decisions.

- **Specific jurisdiction scraper complexity:** Research confirms the 20,000-jurisdiction problem exists but cannot predict the specific complexity of target jurisdictions (Iowa counties, South Dakota, surrounding metros) without actually examining those portal systems. Phase 2 should begin with a 2-3 day scraper spike against actual target jurisdictions before estimating scope.

- **Shovels.ai API cost-benefit:** The research recommends investigating Shovels.ai (170M+ permits, API-first) as a potential alternative or supplement to direct permit scraping. Pricing at expected query volumes (covering target geography) has not been evaluated. This could significantly simplify Phase 2 if Shovels covers the target markets at acceptable cost.

- **Equipment taxonomy definition:** The equipment-need inference engine requires a well-designed taxonomy mapping project types to equipment categories. This is described as "the product intelligence" but the actual taxonomy has not been researched. Domain expert input (from New Tec or similar) is required before implementing the rule-based tagging system.

- **Data freshness SLA:** The product value proposition depends on "fresh daily leads." What does "fresh" mean for the target customer? Same-day? Within 24 hours? Within 48 hours? This defines scraper scheduling requirements (2 AM daily cron may not be sufficient for some use cases) and is a customer research question, not an engineering one.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Turbopack stability, React 19.2, React Compiler
- [Crawlee GitHub + docs](https://crawlee.dev/js) — v3.16.x feature set, anti-bot, TypeScript-native
- [BullMQ docs + npm](https://docs.bullmq.io) — v5.71.x, job dependencies, cron scheduling
- [Better Auth docs](https://better-auth.com/) — v1.5.5, organization plugin, Auth.js merger
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.1 confirmed
- [Zod npm](https://www.npmjs.com/package/zod) — v4.3.6, Drizzle integration
- [Tailwind CSS v4 release blog](https://tailwindcss.com/blog/tailwindcss-v4) — Rust engine, CSS-native config
- [PostGIS ST_DWithin documentation](https://postgis.net/documentation/tips/st-dwithin/) — spatial radius filtering
- [WorkOS multi-tenant architecture guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — shared-schema patterns
- [BullMQ architecture docs](https://docs.bullmq.io/guide/architecture) — job queue architecture
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — isolation patterns

### Secondary (MEDIUM confidence)
- [Building Radar lead generation tools comparison](https://www.buildingradar.com/construction-blog/best-lead-generation-tools-for-construction-sales-2025) — competitor feature analysis
- [Dodge Construction Central](https://www.construction.com/solutions/dodge-construction-central/) — feature set and pricing
- [ConstructConnect](https://www.constructconnect.com/) — feature set and pricing
- [Construction Monitor](https://www.constructionmonitor.com/) — permit data approach
- [Shovels.ai API](https://www.shovels.ai/api) — permit data aggregation, potential Tier 1 source
- [Drizzle vs Prisma benchmarks (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/) — ORM performance comparison
- [Neon pricing breakdown (Vela)](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) — cost modeling
- [Railway vs Render comparison (Northflank)](https://northflank.com/blog/railway-vs-render) — hosting decision
- [hiQ v. LinkedIn case analysis (ZwillGen)](https://www.zwillgen.com/alternative-data/hiq-v-linkedin-wrapped-up-web-scraping-lessons-learned/) — legal precedent
- [Silent scraper failures analysis (Medium)](https://medium.com/@arman-bd/web-scraping-monitoring-the-silent-data-quality-crisis-no-one-talks-about-9949a2b5a361) — 37% silent failure statistic
- [LLM web scraping maintenance reduction (ScrapeGraph)](https://scrapegraphai.com/blog/llm-web-scraping) — 70% maintenance reduction claim
- [Web scraping challenges 2025 (GroupBWT)](https://groupbwt.com/blog/challenges-in-web-scraping/) — anti-bot, legal, maintenance landscape

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
