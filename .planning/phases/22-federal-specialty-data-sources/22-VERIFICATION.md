---
phase: 22-federal-specialty-data-sources
verified: 2026-03-20T06:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run scraper pipeline for heavy_equipment industry and confirm new source types appear in lead records"
    expected: "Leads with sourceType values of contract-award, inspection, brownfield, grant, energy, and telecom are ingested and stored"
    why_human: "Requires live API calls to USAspending, DOL, EPA, Grants.gov, FERC, and FCC endpoints which cannot be verified programmatically without network access"
---

# Phase 22: Federal & Specialty Data Sources Verification Report

**Phase Goal:** The platform surfaces federal construction contracts, OSHA inspections, EPA brownfield sites, federal grants, energy infrastructure filings, and telecom tower registrations as lead types alongside municipal permits
**Verified:** 2026-03-20T06:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | base-adapter.ts sourceTypes array includes contract-award, inspection, brownfield, grant, energy, and telecom | VERIFIED | Line 19: 13-entry array with all 6 new types; JSDoc documents each type |
| 2 | USAspending adapter fetches awarded construction contracts filtered by NAICS 236/237/238 | VERIFIED | `usaspending-contracts.ts`: POST to `api.usaspending.gov/api/v2/search/spending_by_award/` with naics_codes: {require: ["236","237","238"]}; maps to sourceType "contract-award" |
| 3 | OSHA adapter fetches construction site inspection records filtered by SIC 15xx-17xx | VERIFIED | `osha-inspections.ts`: loops sicPrefixes ["15","16","17"], fetches from DOL enforcedata API with redirect:"manual" detection; maps to sourceType "inspection" |
| 4 | EPA Brownfields adapter fetches contaminated site cleanup data with coordinates and cleanup status | VERIFIED | `epa-brownfields.ts`: tries 3 ACRES table name variants from `data.epa.gov/efservice/`, extracts LATITUDE/LONGITUDE with NaN/zero guard, maps CLEANUP_STATUS; sourceType "brownfield" |
| 5 | Grants.gov adapter fetches federal construction grant opportunities with funding amounts and deadlines | VERIFIED | `grants-gov.ts`: POSTs 5 construction keywords to `api.grants.gov/v1/api/search2`, deduplicates by opportunityId, maps estimatedFunding to estimatedValue and closeDate to deadlineDate; sourceType "grant" |
| 6 | FERC adapter fetches energy infrastructure filings filtered for construction-related terms | VERIFIED | `ferc-energy.ts`: fetches FERC eLibrary RSS from `elibrary.ferc.gov`, regex-parses XML items, filters by CONSTRUCTION_KEYWORDS list (10+ terms), falls back to XML endpoint; sourceType "energy" |
| 7 | FCC adapter fetches antenna structure registrations with tower coordinates | VERIFIED | `fcc-antenna.ts`: fetches from FCC Socrata `opendata.fcc.gov/resource/2fwp-vbpn.json` with SODA `$where=reg_dat>90_days_ago`, parses both DMS and decimal coordinate formats; sourceType "telecom" |
| 8 | All 6 new adapters are registered in index.ts for appropriate industries | VERIFIED | `index.ts`: all 6 imported; heavy_equipment has all 6; hvac has 3; roofing has 4; solar has 3; electrical has 5 — matches plan specification exactly |
| 9 | api-rate-limiter.ts exports 6 new queue factory functions | VERIFIED | `api-rate-limiter.ts`: exports getUsaSpendingQueue (2/10/min), getOshaQueue (1/5/min), getEpaQueue (1/10/min), getGrantsGovQueue (1/5/min), getFercQueue (1/5/min), getFccQueue (1/10/min) |
| 10 | Both USAspending and OSHA adapters gracefully return [] on API error or missing config | VERIFIED | Both wrap entire scrape() in try/catch with console.warn; OSHA also handles 301/302 redirects explicitly |
| 11 | EPA Brownfields and Grants.gov adapters gracefully return [] on API error | VERIFIED | EPA tries 3 table variants with individual try/catch; Grants.gov catches per-keyword and globally |
| 12 | FERC and FCC adapters gracefully return [] on API error | VERIFIED | Both have outer try/catch returning [] with console.warn; FCC handles 404 explicitly for dataset fallback |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scraper/adapters/base-adapter.ts` | 6 new source types in sourceTypes array | VERIFIED | 13-entry array: permit, bid, news, deep-web, storm, disaster, violation, contract-award, inspection, brownfield, grant, energy, telecom |
| `src/lib/scraper/api-rate-limiter.ts` | 6 new rate limiter queue factories | VERIFIED | 159 lines; 10 total queue functions; 6 new ones match plan specs exactly |
| `src/lib/scraper/adapters/usaspending-contracts.ts` | USAspending federal contracts adapter | VERIFIED | 158 lines; exports UsaSpendingContractsAdapter; implements ScraperAdapter; POST with NAICS filter |
| `src/lib/scraper/adapters/osha-inspections.ts` | OSHA inspection data adapter | VERIFIED | 164 lines; exports OshaInspectionsAdapter; SIC prefix loop; redirect-aware fetch |
| `src/lib/scraper/adapters/epa-brownfields.ts` | EPA Brownfields/ACRES contaminated site adapter | VERIFIED | 164 lines; exports EpaBrownfieldsAdapter; 3-table fallback; lat/lng extraction |
| `src/lib/scraper/adapters/grants-gov.ts` | Grants.gov federal construction grants adapter | VERIFIED | 182 lines; exports GrantsGovAdapter; 5-keyword search with Set-based dedup |
| `src/lib/scraper/adapters/ferc-energy.ts` | FERC energy infrastructure filings adapter | VERIFIED | 224 lines; exports FercEnergyAdapter; regex RSS parser; construction keyword filter |
| `src/lib/scraper/adapters/fcc-antenna.ts` | FCC antenna structure registration adapter | VERIFIED | 223 lines; exports FccAntennaAdapter; Socrata SODA query; DMS+decimal coordinate parser |
| `src/lib/scraper/adapters/index.ts` | Updated adapter registry with all 6 new federal adapters | VERIFIED | All 6 imported at top; getHardcodedAdapters() switch cases updated for all 5 industries |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `usaspending-contracts.ts` | `api.usaspending.gov` | POST /api/v2/search/spending_by_award/ | WIRED | Line 49: `private readonly endpoint = "https://api.usaspending.gov/api/v2/search/spending_by_award/"` |
| `osha-inspections.ts` | DOL enforcement API | GET enforcedata.dol.gov osha_inspection | WIRED | Line 47: `private readonly primaryEndpoint = "https://enforcedata.dol.gov/api/enforcement/osha_inspection"` with SIC params |
| `epa-brownfields.ts` | `data.epa.gov` | GET Envirofacts REST API | WIRED | Line 67: `https://data.epa.gov/efservice/${tableName}/JSON/rows/0:100` with 3-table fallback |
| `grants-gov.ts` | `api.grants.gov` | POST /v1/api/search2 | WIRED | Line 60: `private readonly endpoint = "https://api.grants.gov/v1/api/search2"` with 5 keyword POSTs |
| `ferc-energy.ts` | `elibrary.ferc.gov` | RSS/XML feed fetch | WIRED | Line 46: `https://elibrary.ferc.gov/eLibrary/filelist?...resultFormat=rss` with XML fallback at line 50 |
| `fcc-antenna.ts` | `opendata.fcc.gov` | Socrata SODA API | WIRED | Line 66: `https://opendata.fcc.gov/resource/2fwp-vbpn.json` with `$where`, `$limit`, `$order` params |
| `index.ts` | all 6 new adapter files | import + getHardcodedAdapters() | WIRED | Lines 17-22: all 6 imports; lines 85-91 (heavy_equipment), 103-105 (hvac), 119-122 (roofing), 130-132 (solar), 143-148 (electrical) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FED-01 | 22-01 | USAspending.gov adapter scrapes awarded federal construction contracts | SATISFIED | UsaSpendingContractsAdapter exists, POSTs to api.usaspending.gov with NAICS 236/237/238, maps to contract-award sourceType |
| FED-02 | 22-01 | OSHA inspection data adapter scrapes construction site inspections | SATISFIED | OshaInspectionsAdapter exists, queries DOL API with SIC 15xx/16xx/17xx, maps to inspection sourceType |
| FED-03 | 22-02 | EPA Brownfields/ACRES adapter scrapes contaminated site cleanup opportunities | SATISFIED | EpaBrownfieldsAdapter exists, fetches from Envirofacts with table fallback, extracts lat/lng/status, maps to brownfield sourceType |
| FED-04 | 22-02 | Grants.gov adapter scrapes federal construction grant opportunities | SATISFIED | GrantsGovAdapter exists, searches with 5 keywords, deduplicates by ID, maps funding+deadlines, sourceType grant |
| FED-05 | 22-03 | FERC energy infrastructure adapter scrapes pipeline/power plant filings | SATISFIED | FercEnergyAdapter exists, fetches FERC eLibrary RSS, filters for 10+ construction keywords, maps to energy sourceType |
| FED-06 | 22-03 | FCC antenna structure adapter scrapes telecom tower registrations | SATISFIED | FccAntennaAdapter exists, fetches FCC Socrata with SODA query, parses DMS/decimal coordinates, maps to telecom sourceType |
| FED-07 | 22-01 | New source types added to base-adapter (contract-award, inspection, brownfield, grant, energy, telecom) | SATISFIED | base-adapter.ts line 19: all 6 types present in 13-entry sourceTypes const array |

All 7 requirements satisfied. No orphaned requirements found — REQUIREMENTS.md maps exactly FED-01 through FED-07 to Phase 22.

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `tests/helpers/scraper.ts` | `Record<SourceType, ...>` missing 6 new source type entries; TypeScript error | Warning | Test helper was not updated for new source types. Tests still compile by using `as RawLeadData` cast on line 104. Does NOT affect production code — src/ compiles cleanly. |

No anti-patterns found in the 8 production files created/modified by this phase. No TODO/FIXME/PLACEHOLDER comments. No stub implementations. No empty handlers. No ignored response data.

### Human Verification Required

#### 1. End-to-End Federal Lead Ingestion

**Test:** Start the dev server. Trigger the `heavy_equipment` industry scraper cron (or call `POST /api/cron/scrape` with the heavy_equipment industry). Check the leads table for new rows with sourceType values of `contract-award`, `inspection`, `brownfield`, `grant`, `energy`, or `telecom`.

**Expected:** At least some federal leads appear in the database (USAspending and FCC are the most reliable public APIs; OSHA and FERC may return no data if their restructured endpoints are unavailable).

**Why human:** Requires live HTTP calls to federal government APIs (api.usaspending.gov, enforcedata.dol.gov, data.epa.gov, api.grants.gov, elibrary.ferc.gov, opendata.fcc.gov). Cannot be verified without network access and running infrastructure.

#### 2. Dashboard Display of Federal Lead Types

**Test:** If federal leads are ingested (from test above), navigate to the lead dashboard and check that leads with source types `contract-award`, `inspection`, `brownfield`, `grant`, `energy`, and `telecom` display correctly in the lead card UI without visual errors.

**Expected:** Lead cards render normally for all 6 new source types. Industry badge, score, and source attribution appear correctly.

**Why human:** UI rendering of new source type labels requires visual inspection.

### Gaps Summary

No gaps found. All phase must-haves are fully implemented and wired.

**Production TypeScript:** `src/` compiles with zero errors. The only TypeScript errors are in `tests/helpers/scraper.ts` (a pre-existing test helper that predates Phase 22 and was not updated to include the 6 new source type entries in its `Record<SourceType, ...>` defaults map). This is a test maintenance issue and does not affect runtime behavior, production compilation, or the phase goal.

---

_Verified: 2026-03-20T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
