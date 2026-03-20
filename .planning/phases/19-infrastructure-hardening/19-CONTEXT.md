# Phase 19: Infrastructure Hardening - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase hardens the scraping pipeline infrastructure to handle 10x data volume: batched fan-out cron execution, geocoding cache with Nominatim fallback, 45-day lead expiration, and a data_portals DB table for storing discovered portal configs. No new data sources are added — this is pure infrastructure preparation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key constraints from research:
- Fan-out must keep each batch under 300s Vercel Hobby timeout
- Batch size of 5-10 adapters per invocation recommended
- Geocoding cache should use address hash as lookup key with 90-day expiry
- Nominatim rate limit: 1 req/sec, requires User-Agent header
- Lead expiration must preserve bookmarked/interacted leads
- data_portals table needs JSONB field for flexible field mappings

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/scraper/pipeline.ts` — runPipeline() orchestrator, sequential adapter execution
- `src/lib/scraper/adapters/socrata-permit-adapter.ts` — SocrataConfig interface with fieldMap
- `src/lib/geocoding.ts` — geocodeAddress() using Google Maps
- `src/lib/scraper/api-rate-limiter.ts` — p-queue based rate limiters
- `vercel.json` — cron configuration

### Established Patterns
- Drizzle ORM for all DB operations
- neon-http driver (no transactions)
- Zod for validation
- p-queue for rate limiting

### Integration Points
- `/api/cron/scrape` — daily pipeline trigger
- `src/lib/db/schema/` — Drizzle table definitions
- `src/lib/scraper/adapters/index.ts` — adapter registry

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Research recommends:
- DB cursor in pipeline_runs to track batch progress
- Nominatim as overflow geocoder after Google 10K/month
- Storage monitoring via Neon dashboard alerts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
