# Phase 21: Dynamic Portal Discovery & Nationwide Coverage - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build dynamic discovery services that query the Socrata Discovery API and ArcGIS Hub Search API to find permit and violation datasets across hundreds of U.S. cities. Create generic adapters that read config from the data_portals DB table instead of requiring per-city TypeScript files. Migrate existing Austin/Dallas/Atlanta adapters to data_portals seed rows. Run discovery as a weekly cron job.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase with well-defined inputs/outputs.

**Key architecture from research:**

**Socrata Discovery API:**
- Endpoint: `api.us.socrata.com/api/catalog/v1`
- Query: `?q=building+permits&only=datasets&domains=*&limit=100`
- Returns dataset metadata including domain, datasetId, column names
- No auth required for discovery (app token optional for higher limits)
- 486 permit datasets verified live

**ArcGIS Hub Search API:**
- Endpoint: `hub.arcgis.com/api/v3/datasets`
- Query: `?q=building+permits&filter[type]=Feature+Service`
- Returns dataset metadata with download URLs
- GeoJSON format includes coordinates (no geocoding needed)

**Generic Adapters:**
- `GenericSocrataAdapter` — reads `SocrataConfig` from data_portals table row
- `GenericArcGISAdapter` — reads ArcGIS config from data_portals table row
- Both implement existing `ScraperAdapter` interface
- Heuristic field mapper infers column mappings from common patterns:
  - permitNumber: permit_number, permit_no, permit_num, permitnumber
  - address: address, location, permit_location, street_address, site_address
  - permitDate: issue_date, issued_date, permit_date, date_issued, date_filed
  - description: description, work_description, scope_of_work
  - projectType: permit_type, permit_type_desc, work_type, type
  - latitude: latitude, lat, y
  - longitude: longitude, lng, lon, x
  - estimatedValue: valuation, project_valuation, estimated_cost, value, total_valuation

**Discovery Cron:**
- Weekly schedule: `0 3 * * 0` (Sunday 3 AM)
- Queries both APIs, infers field mappings, upserts into data_portals
- Sets `status: "discovered"` for new portals, `status: "verified"` for known-good ones
- Logs unmappable datasets as warnings

**Migration:**
- Austin, Dallas, Atlanta get seed rows in data_portals with `status: "verified"`
- Old hardcoded adapter files can remain for backward compat but pipeline uses data_portals

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/schema/data-portals.ts` — data_portals table (created in Phase 19)
- `src/lib/scraper/adapters/socrata-permit-adapter.ts` — SocrataConfig interface
- `src/lib/scraper/adapters/base-adapter.ts` — ScraperAdapter interface, RawLeadData
- `src/lib/scraper/batch-orchestrator.ts` — fan-out batching (Phase 19)
- `src/lib/scraper/api-rate-limiter.ts` — p-queue rate limiters
- `src/lib/scraper/adapters/utils.ts` — toTitleCase, buildPermitTitle

### Established Patterns
- Adapters implement ScraperAdapter interface with scrape() method
- Rate limiting via p-queue
- Pipeline validates with Zod, geocodes, upserts

### Integration Points
- `src/lib/scraper/adapters/index.ts` — adapter registry
- `src/app/api/cron/scrape/[industry]/route.ts` — daily pipeline trigger
- `/api/cron/discover` — new weekly discovery endpoint

</code_context>

<specifics>
## Specific Ideas

- Start with Socrata discovery (bigger dataset), then ArcGIS
- Field mapping heuristic should be aggressive — try to map as many columns as possible
- Log datasets that can't be auto-mapped so they can be manually reviewed
- data_portals rows should include `lastScrapedAt` and `recordCount` for monitoring

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
