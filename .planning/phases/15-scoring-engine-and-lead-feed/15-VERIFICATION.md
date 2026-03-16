---
phase: 15-scoring-engine-and-lead-feed
verified: 2026-03-16T13:40:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 15: Scoring Engine & Lead Feed Verification Report

**Phase Goal:** Every user sees a personalized lead feed where the same lead scores differently per subscriber based on their industry, location, specializations, and preferences
**Verified:** 2026-03-16T13:40:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lead scores computed at query time per subscriber — same lead produces different scores for different orgs | VERIFIED | `scoreLeadForOrg(lead, orgContext, distanceMiles)` called per-org in `getFilteredLeadsCursor` and `getLeadByIdScored`; unit test "produces different scores for two orgs with different profiles" passes |
| 2 | Lead cards display title, type badge, value, distance, composite score, match reasons, and bookmark button | VERIFIED | `lead-card.tsx` renders `lead.scoring.total` as colored pill, `scoring.matchReasons.slice(0,2)`, source type badge, `formatValue(estimatedValue)`, `Math.round(lead.distance)` mi, and `lead.isBookmarked` |
| 3 | User can filter by source type, distance, value range, project type, date range, and sort by score/date/distance | VERIFIED | `lead-filters.tsx` implements SOURCE_TYPES checkboxes, Slider for maxDistance, min/maxValue inputs, INDUSTRY_CONFIG[industry].specializations checkboxes, dateFrom/dateTo, SORT_OPTIONS buttons, and matchOnly toggle |
| 4 | Lead feed uses cursor-based pagination with stable ordering | VERIFIED | `getFilteredLeadsCursor` orders by `asc(leads.id)`, cursor condition `leads.id > cursor`, returns `nextCursor`/`hasMore`; `pagination.tsx` appends `?cursor={nextCursor}` preserving all filter params |
| 5 | Lead detail page shows enrichment data, map, contacts, and similar leads | VERIFIED | Detail page queries `lead_enrichments`, renders `EnrichmentCards` (graceful null state), `LeadMap` with dual-marker + radius circle, `SimilarLeads` component queries within 25mi, `ScoreBreakdown` with 5 dimension bars |

**Score: 5/5 truths verified**

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scoring/engine.ts` | 5-dimension scoring engine with match reasons | VERIFIED | Exports `scoreLeadForOrg`; calls all 5 dimension functions; clamps 0–100; collects `matchReasons` |
| `src/lib/scoring/types.ts` | Scoring type definitions | VERIFIED | Exports `ScoredLead`, `ScoreDimension`, `ScoringResult`, `OrgScoringContext`, `LeadScoringInput` |
| `src/lib/leads/queries.ts` | Cursor-based feed query | VERIFIED | Exports `getFilteredLeadsCursor`, `getLeadByIdScored`; all existing functions preserved |
| `tests/scoring/engine.test.ts` | Scoring engine unit tests | VERIFIED | 35 tests, all passing |
| `src/lib/scoring/distance.ts` | Distance dimension scorer | VERIFIED | 6-tier scoring, 25pt max, human-readable reasons |
| `src/lib/scoring/relevance.ts` | Relevance dimension scorer | VERIFIED | Spec match +15, industry match +10, cross-industry +5, preferred type +5, penalty -10; clamps 0–30 |
| `src/lib/scoring/value.ts` | Value dimension scorer | VERIFIED | 20pts in-range, 15pts above, 10pts unknown, 5pts below 50%, 0pts well below |
| `src/lib/scoring/freshness.ts` | Freshness dimension scorer | VERIFIED | 6-tier decay from 15pts (today) to 0pts (30+ days) |
| `src/lib/scoring/urgency.ts` | Urgency dimension scorer | VERIFIED | Takes highest of: storm 10pts, bid deadline 10pts, violation 8pts, permit 5pts, incentive 10pts |
| `src/lib/scoring/index.ts` | Re-exports from engine and types | VERIFIED | Re-exports `scoreLeadForOrg` and all types |
| `src/lib/leads/types.ts` | ScoredLead type | VERIFIED | `ScoredLead` interface with `scoring: ScoringResult` added alongside preserved `EnrichedLead` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/dashboard/lead-card.tsx` | Redesigned card with score breakdown and match reasons | VERIFIED | Accepts `ScoredLead`; renders `scoring.total` pill, `scoring.matchReasons.slice(0,2)`, source type badges, value formatted as $XXK/$X.XM, distance, status dot |
| `src/app/(dashboard)/dashboard/lead-filters.tsx` | Filter panel with source type, project type, sort, specialization toggle | VERIFIED | SOURCE_TYPES checkboxes, Slider, value range, INDUSTRY_CONFIG specializations, date range, SORT_OPTIONS, matchOnly toggle |
| `src/app/(dashboard)/dashboard/pagination.tsx` | Cursor-based Load More pagination | VERIFIED | Accepts `nextCursor`/`hasMore`; single "Load more leads" button; preserves all URL params |
| `src/components/dashboard/industry-badge.tsx` | Colored industry pill for sidebar | VERIFIED | 5-industry color map with rounded-full pill; `INDUSTRY_LABELS` for display names |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/dashboard/leads/[id]/page.tsx` | Rewritten detail page with scored data | VERIFIED | Uses `getLeadByIdScored`; queries enrichments; renders ScoreBreakdown, EnrichmentCards, SimilarLeads, LeadMap with dual-marker |
| `src/app/(dashboard)/dashboard/leads/[id]/score-breakdown.tsx` | Visual score breakdown with 5 dimension bars | VERIFIED | Renders 5 dimension bars with `style={{ width: pct% }}`, score/maxScore text, reasons below each bar, and matchReasons list |
| `src/app/(dashboard)/dashboard/leads/[id]/enrichment-cards.tsx` | Enrichment data display with graceful empty state | VERIFIED | Returns `null` when all null; renders WeatherCard, PropertyCard, IncentivesCard when data present |
| `src/app/(dashboard)/dashboard/leads/[id]/similar-leads.tsx` | Similar leads section within 25mi | VERIFIED | Haversine SQL within 25mi, excludes current lead, orders by scrapedAt DESC, limit 5 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/scoring/engine.ts` | `src/lib/scoring/distance.ts` | `import scoreDistance` | WIRED | `import { scoreDistance } from "./distance"` on line 2; called `scoreDistance(distanceMiles, org.serviceRadiusMiles)` |
| `src/lib/leads/queries.ts` | `src/lib/scoring/engine.ts` | `import scoreLeadForOrg` | WIRED | `import { scoreLeadForOrg } from "@/lib/scoring/engine"` on line 28; called for each row in `getFilteredLeadsCursor` and `getLeadByIdScored` |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | `src/lib/leads/queries.ts` | `import getFilteredLeadsCursor` | WIRED | Line 8 import; called at line 164 and 184 |
| `src/app/(dashboard)/dashboard/lead-card.tsx` | `src/lib/scoring/types.ts` | `import ScoringResult` (via ScoredLead) | WIRED | `import type { ScoredLead } from "@/lib/leads/types"` on line 19; `lead.scoring.total` and `lead.scoring.matchReasons` used in render |
| `src/components/dashboard/sidebar-nav.tsx` | `src/components/dashboard/industry-badge.tsx` | `import IndustryBadge` | WIRED | Line 7 import; `<IndustryBadge industry={industry} />` rendered on line 20 |

### Plan 03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/(dashboard)/dashboard/leads/[id]/page.tsx` | `src/lib/leads/queries.ts` | `import getLeadByIdScored` | WIRED | Line 9 import; called at lines 49 and 80 |
| `src/app/(dashboard)/dashboard/leads/[id]/score-breakdown.tsx` | `src/lib/scoring/types.ts` | `import ScoringResult, ScoreDimension` | WIRED | `import type { ScoringResult } from "@/lib/scoring/types"` on line 3; `scoring.dimensions.map()` iterates ScoreDimension |
| `src/app/(dashboard)/dashboard/leads/[id]/enrichment-cards.tsx` | `src/lib/db/schema/lead-enrichments.ts` | queried in page.tsx | WIRED | `leadEnrichments` imported and queried in page.tsx lines 7 and 92; parsed by `enrichmentType` and passed to `EnrichmentCards` component |

---

## Layout Wiring Verification

The layout (`src/app/(dashboard)/layout.tsx`) correctly:
- Queries `organization.industry` via `db.query.organization.findFirst`
- Casts to `Industry` type
- Passes `orgIndustry` to both `<SidebarNav industry={orgIndustry} />` and `<MobileNav ... industry={orgIndustry} />`

The dashboard page (`page.tsx`) independently queries org industry and passes `industry` + `profile.specializations` to `<LeadFilters>`.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCOR-01 | 15-01 | Score computed at query time per subscriber | SATISFIED | `getFilteredLeadsCursor` builds `OrgScoringContext` then calls `scoreLeadForOrg` per lead row |
| SCOR-02 | 15-01 | Distance dimension (0-25 pts) | SATISFIED | `src/lib/scoring/distance.ts` — 6 tiers, 25pt max |
| SCOR-03 | 15-01 | Relevance dimension (0-30 pts) | SATISFIED | `src/lib/scoring/relevance.ts` — spec match, industry, cross-industry, preferred type, penalty; 30pt max |
| SCOR-04 | 15-01 | Value dimension (0-20 pts) | SATISFIED | `src/lib/scoring/value.ts` — target range matching, 20pt max |
| SCOR-05 | 15-01 | Freshness dimension (0-15 pts) | SATISFIED | `src/lib/scoring/freshness.ts` — 6-tier decay over 30 days, 15pt max |
| SCOR-06 | 15-01 | Urgency dimension (0-10 pts) | SATISFIED | `src/lib/scoring/urgency.ts` — storm/bid/violation/permit/incentive signals, 10pt max |
| SCOR-07 | 15-01 | Human-readable match reasons on lead cards | SATISFIED | `scoring.matchReasons` displayed on `lead-card.tsx` as comma-separated text |
| FEED-01 | 15-02 | Lead cards show title, type badge, value, distance, score, match reasons, bookmark | SATISFIED | `lead-card.tsx` fully implements all listed fields |
| FEED-02 | 15-02 | Filter panel with source type, distance, value range, project type, date range, sort | SATISFIED | `lead-filters.tsx` implements all 8 filter dimensions + sort + matchOnly toggle |
| FEED-03 | 15-01 | Cursor-based pagination | SATISFIED | `getFilteredLeadsCursor` + `pagination.tsx` Load More button |
| FEED-04 | 15-03 | Lead detail with enrichment, map, contacts, similar leads | SATISFIED | Detail page renders all four sections |
| FEED-06 | 15-02 | Industry badge in navigation | SATISFIED | `IndustryBadge` rendered in `SidebarNav` and `MobileNav` via layout |

All 12 required requirement IDs are accounted for and satisfied.

**Note:** FEED-05 (Storm alert banner) is NOT in Phase 15's scope and correctly remains as a future requirement `[ ]` in REQUIREMENTS.md.

---

## Anti-Patterns Scan

No stub anti-patterns found in any phase-15 modified files.

- No `TODO`/`FIXME`/`HACK`/`XXX` comments in scoring engine, queries, or UI components
- No placeholder returns (`return null`, `return {}`, `return []`) in scoring functions — all produce real computed values
- No empty handler stubs — all filter handlers perform URL navigation
- `placeholder` text found in `lead-filters.tsx` lines 258/329/339 are legitimate HTML input placeholder attributes, not stub implementations
- `EnrichmentCards` returns `null` when all enrichment data is null — this is intentional and correct (no enrichment scrapers built yet, per Phase 16+)

---

## Human Verification Required

The following items cannot be verified programmatically:

### 1. Score color coding visual

**Test:** Log in, navigate to /dashboard, observe a lead card with score >= 70
**Expected:** Score pill appears green; score 40-69 appears yellow; score < 40 appears red/gray
**Why human:** CSS class application and color rendering requires visual inspection

### 2. Filter panel industry-specific project types

**Test:** Log in as an HVAC org, open filter panel, expand "Project Type" section
**Expected:** Checkboxes show HVAC-specific specializations from INDUSTRY_CONFIG (e.g., "Heat Pumps", "Commercial HVAC", "Ductwork") rather than heavy equipment types
**Why human:** Dynamic option generation from org profile requires a real session

### 3. Cursor pagination "Load More" behavior

**Test:** Navigate to /dashboard with enough leads to trigger hasMore, click "Load more leads"
**Expected:** Additional leads append with URL updated to `?cursor={id}`, no duplicate leads, existing filters preserved in URL
**Why human:** Requires live data exceeding limit=20 to trigger pagination

### 4. Lead detail dual-marker map

**Test:** Click into a lead detail, scroll to the map card
**Expected:** Two pins — red for the lead location, blue for org HQ — with a semi-transparent blue service radius circle around HQ
**Why human:** Google Maps rendering requires browser + API key

### 5. Match reason accuracy

**Test:** Open a lead from an HVAC org that matches an HVAC specialization
**Expected:** Match reasons include "Matches your [specialization]" and distance/freshness reasons — all contextually accurate for that specific org
**Why human:** Per-org personalization accuracy requires comparing org profile data to displayed reasons

---

## Summary

Phase 15 goal is fully achieved. All five success criteria are satisfied by real, substantive implementations:

1. **Scoring engine** — 5 pure-function dimension scorers produce a 0-100 score with human-readable match reasons. The same lead produces different totals for different orgs (verified by 35 passing unit tests).

2. **Lead feed UI** — Lead cards consume `ScoredLead` and display all required fields. The filter panel supports all 8+ filter dimensions including industry-specific project types from `INDUSTRY_CONFIG`. The industry badge renders in both sidebar and mobile nav.

3. **Cursor pagination** — `getFilteredLeadsCursor` uses `leads.id ASC` ordering with `id > cursor` for stable pages. The Load More button preserves filter params.

4. **Lead detail page** — `getLeadByIdScored` fetches and scores a single lead per org. The detail page renders score breakdown bars, enrichment cards (gracefully empty), dual-marker map with service radius circle, and similar leads query.

5. **Backward compatibility** — All pre-existing query functions (`getFilteredLeads`, `getFilteredLeadsWithCount`, `getLeadById`, `getLeadsByIds`, `getLeadSources`) remain intact. The bookmarks page adapts `EnrichedLead.score` into a minimal `ScoringResult` for `LeadCard` compatibility.

---

_Verified: 2026-03-16T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
