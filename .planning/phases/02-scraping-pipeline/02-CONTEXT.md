# Phase 2: Scraping Pipeline - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Crawlee-based scraper framework, initial permit scrapers for at least 3 jurisdictions, daily scheduling, and geocoding of lead locations. Produces raw lead records stored in the database — no enrichment, scoring, or UI display (those are Phase 3+).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation decisions for this phase are at Claude's discretion. User requested autonomous execution with no consultation. The following guidelines apply:

- **Scraper framework**: Use Crawlee (Node.js) for the scraping framework — pluggable, well-maintained, handles rate limiting and retries
- **Target jurisdictions**: Select 3-5 U.S. jurisdictions with publicly accessible online permit databases, prioritizing municipalities near heavy machinery market centers (e.g., Houston TX, Dallas TX, Phoenix AZ, Atlanta GA, Chicago IL metro areas)
- **Data storage**: Store scraped leads in a tenant-agnostic `leads` table — match to tenants at query time based on geography and equipment types (pipeline-first architecture per roadmap decision)
- **Pluggable adapter pattern**: Each jurisdiction scraper implements a common adapter interface so new sources can be added without modifying framework code
- **Scheduling**: Use node-cron or similar for daily scheduling — simple, in-process, no external infrastructure needed for MVP
- **Geocoding**: Reuse the Google Maps Geocoding API already configured in Phase 1 for address-to-coordinates conversion on each lead
- **Freshness tracking**: Each lead record carries `scrapedAt` timestamp and `sourceUrl` for attribution
- **Deduplication**: Basic dedup within a single source by permit number/ID — cross-source dedup is Phase 4
- **Error handling**: Log scraper failures per jurisdiction, continue with remaining sources — don't let one failing source block the entire pipeline
- **Data model**: Lead records include: permit number, project description, address, lat/lng, project type, estimated value (if available), applicant/contractor name, permit date, source jurisdiction, scraped timestamp

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly requested autonomous execution with full Claude discretion.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/geocoding.ts`: Geocoding utility with Google Maps API and graceful degradation — reuse for lead geocoding
- `src/lib/db/index.ts`: Drizzle ORM client connected to Neon PostgreSQL — add leads table to existing schema
- Better Auth session infrastructure — scraper runs server-side, no auth needed for pipeline itself

### Established Patterns
- Drizzle ORM schema definition pattern (see `src/lib/db/schema/`) — follow same pattern for leads table
- Server Actions pattern — could be used for manual scraper triggers
- Zod validation — use for validating scraped data before insertion

### Integration Points
- New `leads` table in `src/lib/db/schema/leads.ts` following existing schema patterns
- Scraper framework lives in `src/lib/scraper/` or similar server-side directory
- Daily schedule triggered by cron job or API endpoint
- Geocoded coordinates enable radius-based filtering in Phase 3

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-scraping-pipeline*
*Context gathered: 2026-03-14*
