---
phase: 04-multi-source-expansion
plan: 02
subsystem: scraper
tags: [sam-gov, rss-parser, serper-dev, google-dorking, news-feeds, bid-boards, deep-web, adapters]

# Dependency graph
requires:
  - phase: 04-multi-source-expansion
    provides: Generalized RawLeadData schema, ScraperAdapter interface with sourceType, lead_sources table, pipeline with dual insert paths
provides:
  - SAM.gov federal bid board adapter (NAICS 236/237/238)
  - Three RSS news adapters (ENR, Construction Dive, PR Newswire) with construction keyword filtering
  - Google dorking adapter via Serper.dev with daily query rotation and budget
  - Shared utils (extractLocation, isConstructionRelevant) for text analysis
  - All 5 new adapters registered in initializeAdapters() for daily pipeline execution
affects: [04-03-PLAN, lead-detail, dashboard-metrics, source-attribution]

# Tech tracking
tech-stack:
  added: [rss-parser]
  patterns: [RSS feed parsing with construction keyword filtering, API-key-gated adapters with graceful skip, daily query rotation by day-of-year, metadata-only deep web indexing]

key-files:
  created:
    - src/lib/scraper/adapters/sam-gov-bids.ts
    - src/lib/scraper/adapters/enr-news.ts
    - src/lib/scraper/adapters/construction-dive-news.ts
    - src/lib/scraper/adapters/prnewswire-news.ts
    - src/lib/scraper/adapters/google-dorking.ts
    - src/lib/scraper/adapters/utils.ts
    - tests/scraper/sam-gov-adapter.test.ts
    - tests/scraper/news-adapter.test.ts
    - tests/scraper/dorking-adapter.test.ts
  modified:
    - src/lib/scraper/adapters/index.ts
    - tests/scraper/adapters.test.ts

key-decisions:
  - "Shared utils.ts for extractLocation and isConstructionRelevant keeps helpers reusable across all adapter types"
  - "Google dorking stores only Serper.dev search metadata (title, snippet, URL) -- no third-party site scraping for legal safety"
  - "Daily query rotation uses day-of-year modulo to cycle through dorking templates, staying within 50-query budget"
  - "RSS adapters use rss-parser with Accept: application/rss+xml header to handle content negotiation"

patterns-established:
  - "API-key-gated adapter: check env var, warn and return [] if missing, no crashes"
  - "RSS feed adapter pattern: parse feed, filter by isConstructionRelevant, extract location, map to RawLeadData"
  - "Metadata-only deep web indexing: store search result title/snippet/URL, never follow links to scrape target sites"

requirements-completed: [DATA-02, DATA-03, DATA-04]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 4 Plan 02: New Source Adapters Summary

**SAM.gov bid board, 3 RSS news feeds (ENR/Construction Dive/PR Newswire), and Serper.dev Google dorking adapter with construction filtering and daily query rotation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T19:06:00Z
- **Completed:** 2026-03-14T19:12:55Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- SAM.gov adapter queries federal construction bid opportunities by NAICS codes 236/237/238, maps response to RawLeadData with sourceType="bid"
- Three RSS news adapters parse ENR, Construction Dive, and PR Newswire feeds with construction-relevant keyword filtering and city/state location extraction
- Google dorking adapter queries Serper.dev with 7 construction-specific dork templates, rotated daily within a 50-query budget
- All adapters gracefully return empty arrays when API keys are missing or on errors -- no pipeline crashes
- Shared utility functions (extractLocation, isConstructionRelevant) support text analysis across all adapter types
- All 5 new adapters registered in initializeAdapters(), bringing total to 8 (3 permit + 1 bid + 3 news + 1 deep-web)
- 38 new tests added, full suite at 187 tests across 20 files

## Task Commits

Each task was committed atomically:

1. **Task 1: SAM.gov bid board and RSS news adapters** (TDD)
   - `01d4fd7` (test) - Failing tests for SAM.gov and RSS news adapters
   - `93c7233` (feat) - Implement SAM.gov bid and RSS news adapters with tests
2. **Task 2: Google dorking adapter and adapter registration** (TDD)
   - `fb79a45` (test) - Failing tests for Google dorking adapter
   - `5cd4e5c` (feat) - Implement Google dorking adapter, register all 5 new adapters

## Files Created/Modified
- `src/lib/scraper/adapters/sam-gov-bids.ts` - SAM.gov federal bid board adapter (NAICS 236/237/238, 30-day window)
- `src/lib/scraper/adapters/enr-news.ts` - Engineering News-Record RSS adapter (3 feed URLs)
- `src/lib/scraper/adapters/construction-dive-news.ts` - Construction Dive RSS adapter
- `src/lib/scraper/adapters/prnewswire-news.ts` - PR Newswire construction news RSS adapter
- `src/lib/scraper/adapters/google-dorking.ts` - Serper.dev Google dorking adapter with query rotation
- `src/lib/scraper/adapters/utils.ts` - Shared extractLocation and isConstructionRelevant helpers
- `src/lib/scraper/adapters/index.ts` - Updated to register all 8 adapters (3 permit + 5 new)
- `tests/scraper/sam-gov-adapter.test.ts` - 8 tests for SAM.gov adapter
- `tests/scraper/news-adapter.test.ts` - 20 tests for RSS adapters, location extraction, and construction relevance
- `tests/scraper/dorking-adapter.test.ts` - 10 tests for Google dorking adapter
- `tests/scraper/adapters.test.ts` - Updated adapter count from 3 to 8, pluggability test from 4 to 9

## Decisions Made
- Created shared `utils.ts` for extractLocation and isConstructionRelevant rather than duplicating helpers in each adapter -- cleaner imports and single source of truth
- Google dorking adapter stores only search result metadata (title, snippet, URL) from Serper.dev -- no following links to scrape third-party sites, addressing the legal concern flagged in STATE.md
- Daily query rotation uses `dayOfYear % totalQueries` as starting index, running up to DAILY_QUERY_BUDGET (50) queries per day -- ensures full query template coverage over multiple days
- RSS adapters set Accept header to `application/rss+xml, application/xml` per research pitfall #2 recommendation
- extractLocation uses 3 regex patterns: "in City, ST", "in City, State Name", and "City, ST" at word boundaries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated adapters.test.ts for new adapter count**
- **Found during:** Task 2
- **Issue:** Existing test expected 3 registered adapters; after adding 5 new adapters, the count became 8
- **Fix:** Updated adapter count assertions from 3 to 8 (initializeAdapters) and 4 to 9 (pluggability test)
- **Files modified:** tests/scraper/adapters.test.ts
- **Verification:** npx vitest run tests/scraper/adapters.test.ts passes
- **Committed in:** 5cd4e5c

---

**Total deviations:** 1 auto-fixed (1 bug from adapter registration expansion)
**Impact on plan:** Expected consequence of registering new adapters. No scope creep.

## Issues Encountered
None

## User Setup Required

**External services require API keys for full functionality:**

- **SAM.gov:** Set `SAM_GOV_API_KEY` env var. Register at https://sam.gov/content/entity-registration then request API key at https://open.gsa.gov/api/get-opportunities-public-api/ (approval takes 1-4 weeks). Without this key, the SAM.gov adapter gracefully skips.
- **Serper.dev:** Set `SERPER_API_KEY` env var. Sign up at https://serper.dev (free tier includes 2,500 queries). Without this key, the Google dorking adapter gracefully skips.
- **RSS feeds (ENR, Construction Dive, PR Newswire):** No API keys needed -- these are public RSS feeds.

## Next Phase Readiness
- All 5 new adapter types are registered and will run automatically with the daily scheduler
- Pipeline already handles multi-source RawLeadData via the generalized schema from 04-01
- Cross-source deduplication (Plan 04-03) can now merge leads across all 8 adapters using lead_sources junction table
- Location extraction from news/search snippets provides city/state for geocoding fallback

## Self-Check: PASSED

All 11 claimed files verified present. All 4 commit hashes verified in git log.

---
*Phase: 04-multi-source-expansion*
*Completed: 2026-03-14*
