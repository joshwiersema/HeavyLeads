# Phase 22: Federal & Specialty Data Sources - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add 6 new federal/specialty data source adapters: USAspending (awarded contracts), OSHA inspections, EPA Brownfields, Grants.gov, FERC energy filings, FCC antenna registrations. Each implements the existing ScraperAdapter interface. Add new source types to base-adapter.ts. All are free public APIs using plain fetch — no new packages needed.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — straightforward adapter implementation phase.

**API endpoints (from FEATURES.md research):**

1. **USAspending.gov** — `api.usaspending.gov/api/v2/search/spending_by_award/`
   - POST with NAICS filter for construction (236, 237, 238)
   - No auth required
   - Returns awarded contracts with amounts, locations, dates
   - Source type: `"contract-award"`

2. **OSHA Inspections** — `enforcedata.dol.gov/api/enforcement/osha_inspection` or bulk CSV from `data.dol.gov`
   - Filter by SIC codes 15xx-17xx (construction)
   - Free API key from dataportal.dol.gov
   - Source type: `"inspection"`

3. **EPA Brownfields/ACRES** — `enviro.epa.gov/enviro/efservice/ACRES_SITE_INFORMATION/JSON`
   - GeoJSON with coordinates
   - No auth required
   - Source type: `"brownfield"`

4. **Grants.gov** — `api.grants.gov/v1/api/search`
   - POST with `fundingCategories: "ENV"` and keyword filters
   - No auth required
   - Source type: `"grant"`

5. **FERC** — `elibrary.ferc.gov/eLibrary/search` or RSS feeds
   - Filter for construction-related dockets
   - No auth required
   - Source type: `"energy"`

6. **FCC Antenna Structure** — `wireless2.fcc.gov/UlsApp/AsrSearch/asrRegistrationSearch.jsp` or bulk download
   - Registration data with coordinates
   - No auth required
   - Source type: `"telecom"`

**New source types to add to base-adapter.ts:**
`"contract-award"`, `"inspection"`, `"brownfield"`, `"grant"`, `"energy"`, `"telecom"`

**Rate limiting:** Add new p-queue instances in api-rate-limiter.ts for each new API

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/scraper/adapters/base-adapter.ts` — ScraperAdapter interface, sourceTypes array
- `src/lib/scraper/api-rate-limiter.ts` — p-queue rate limiter factory
- `src/lib/scraper/adapters/sam-gov-bids.ts` — similar federal API adapter pattern
- `src/lib/scraper/adapters/utils.ts` — toTitleCase, buildPermitTitle, extractLocation

### Established Patterns
- Adapters: class implementing ScraperAdapter with sourceId, sourceName, sourceType, scrape()
- Rate limiting via p-queue getSomethingQueue() functions
- Error handling: try/catch with console.warn, return [] on failure
- Date formatting helpers for API query params

### Integration Points
- `src/lib/scraper/adapters/index.ts` — adapter registry (add new adapters)
- `src/lib/scraper/adapters/base-adapter.ts` — sourceTypes array (add new types)

</code_context>

<specifics>
## Specific Ideas

- Follow the sam-gov-bids.ts pattern for all new adapters
- Each adapter should gracefully return [] if API key missing or API errors
- Log warnings when API keys are missing (don't silently fail)
- All adapters should extract coordinates when available to avoid geocoding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
