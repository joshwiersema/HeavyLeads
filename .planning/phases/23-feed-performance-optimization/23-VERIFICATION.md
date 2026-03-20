---
phase: 23-feed-performance-optimization
verified: 2026-03-20T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
human_verification:
  - test: "Dashboard load time with large dataset"
    expected: "Dashboard lead feed renders in under 3 seconds with 50K+ leads in the database"
    why_human: "Cannot measure wall-clock query performance programmatically without a populated production database. PERF-03 requires runtime observation."
---

# Phase 23: Feed Performance Optimization Verification Report

**Phase Goal:** The dashboard loads fast with 50K+ leads in the database, distance filtering uses spatial indexes instead of per-row computation, and duplicate leads from overlapping sources are caught
**Verified:** 2026-03-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getFilteredLeadsWithCount` uses SQL COUNT + SQL LIMIT, never fetches all rows | VERIFIED | Line 523-526: separate `count(*)` query; line 578: `.limit(pageSize)`; line 579: `.offset((page - 1) * pageSize)` |
| 2 | Pipeline insert populates `leads.location` as `ST_MakePoint(lng, lat)::geometry` for every lead with coordinates | VERIFIED | Lines 261-264 in pipeline.ts: conditional `ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)` in values object |
| 3 | `getFilteredLeadsCursor` uses ST_DWithin on `leads.location` instead of Haversine acos expression | VERIFIED | Lines 836-840 in queries.ts: `ST_DWithin(${leads.location}::geography, ..., ${effectiveRadius * 1609.344})` |
| 4 | `getFilteredLeads` uses ST_DWithin on `leads.location` instead of Haversine acos expression | VERIFIED | Lines 400-404 in queries.ts: `ST_DWithin(${leads.location}::geography, ...)` |
| 5 | `getFilteredLeadsWithCount` uses ST_DWithin on `leads.location` instead of Haversine acos expression | VERIFIED | Lines 500-504 in queries.ts: `spatialCondition = sql\`ST_DWithin(...)\`` |
| 6 | Storm alert queries use ST_DWithin on `leads.location` instead of Haversine acos expression | VERIFIED | Lines 60-64 in storm-alerts/queries.ts: `ST_DWithin(l.location::geography, ...)`. Note: `getRoofingSubscribersInStormArea` intentionally retains Haversine — it filters org profiles, not leads.location (no spatial column on org_profiles table) |
| 7 | Dashboard loads in under 3 seconds with spatial index utilized | ? NEEDS HUMAN | Cannot verify runtime performance without populated production DB |

**Score:** 6/7 truths verified (1 requires human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scraper/pipeline.ts` | Location column population during lead insert | VERIFIED | `ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)` at line 263; `ST_SetSRID(ST_MakePoint(excluded.lng, excluded.lat), 4326)` in onConflictDoUpdate at line 306; `backfillLeadLocations()` exported at line 465 |
| `src/lib/leads/queries.ts` | ST_DWithin spatial queries replacing Haversine WHERE | VERIFIED | 6 occurrences of `ST_DWithin`; zero occurrences of `3959 * acos` in WHERE clauses; `ST_Distance` used for display |
| `src/lib/storm-alerts/queries.ts` | ST_DWithin in `getActiveStormAlertsForOrg` | VERIFIED | 1 occurrence of `ST_DWithin` at line 60 in the correct function |
| `src/lib/scraper/dedup.ts` | Cross-source dedup with permit number + date+address matching | VERIFIED | `normalizePermitNumber()` at line 33; 3-path `isLikelyDuplicate()` at line 67; cross-source logging at line 192 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/scraper/pipeline.ts` | `leads.location` column | `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` in INSERT values | WIRED | Pattern found at line 263 (new inserts) and line 306 (upsert conflict set) |
| `src/lib/leads/queries.ts` | `leads_location_gist_idx` | `ST_DWithin` in WHERE clause | WIRED | ST_DWithin present in all 3 query functions (getFilteredLeads, getFilteredLeadsWithCount, getFilteredLeadsCursor); `isNotNull(leads.location)` ensures index utilization |
| `src/lib/scraper/dedup.ts` | `leads` + `lead_sources` tables | bounding box candidate query across all sourceIds | WIRED | Lines 143-154: bounding box query using `ne(leads.id, newId)` to exclude self; `mergeLeads()` updates `leadSources` then deletes duplicate |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PERF-01 | 23-01-PLAN.md | All lead queries use SQL-level LIMIT (no fetch-all-then-slice) | SATISFIED | `getFilteredLeadsWithCount` has `.limit(pageSize)` at line 578; `getFilteredLeads` has `.limit(fetchLimit)` at line 409; `getFilteredLeadsCursor` has `.limit(CURSOR_BATCH_SIZE)` at line 929 |
| PERF-02 | 23-01-PLAN.md | PostGIS spatial index on `leads.location` used for distance filtering | SATISFIED | All three feed functions use ST_DWithin with `leads.location::geography`; GiST index `leads_location_gist_idx` exists per schema; `isNotNull(leads.location)` added so index is utilized |
| PERF-03 | 23-01-PLAN.md | Dashboard loads in < 3 seconds with 50K+ leads | NEEDS HUMAN | Implementation prerequisites satisfied (ST_DWithin + SQL LIMIT in place); actual runtime performance requires production observation |
| PERF-04 | 23-02-PLAN.md | Cross-source dedup catches same permit from city and county portals | SATISFIED | Three-path `isLikelyDuplicate()` with permit number similarity (>0.8), text similarity (>0.7), and date+address compound (3 days + >0.5); `normalizePermitNumber()` strips common prefixes; cross-source logging implemented |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/leads/queries.ts` | 463-464 | Stale doc comment: "this function fetches ALL within-radius leads" — contradicts the SQL LIMIT/COUNT implementation below | Info | No functional impact; misleading for future developers |

No TODO/FIXME/placeholder comments or empty implementations found in any modified files.

### Human Verification Required

#### 1. Dashboard Load Time Under Load

**Test:** With the database seeded to 50K+ leads, navigate to the lead feed dashboard and measure time-to-interactive using browser DevTools Network tab or Vercel Analytics.
**Expected:** Initial lead feed renders in under 3 seconds. The "Time to First Byte" for the feed API route should be significantly reduced compared to the prior Haversine implementation.
**Why human:** Cannot measure wall-clock query performance without a populated database at scale. The code change is verifiably correct (ST_DWithin replaces Haversine in all three feed functions), but PERF-03 specifies a runtime threshold that only applies under actual database load.

**Prerequisite:** Run the backfill to populate `location` for existing leads before testing:
```typescript
import { backfillLeadLocations } from "@/lib/scraper/pipeline";
const count = await backfillLeadLocations();
```

### Summary

All automated verifiable must-haves pass:

- **PERF-01 (SQL LIMIT):** `getFilteredLeadsWithCount` runs a separate `count(*)` query, then fetches only `pageSize` rows with `.limit(pageSize).offset((page-1)*pageSize)`. `getFilteredLeads` and `getFilteredLeadsCursor` both have SQL-level LIMIT.
- **PERF-02 (Spatial Index):** All three lead feed functions and `getActiveStormAlertsForOrg` use `ST_DWithin(...::geography, ..., radius_meters)` against `leads.location`. The `isNotNull(leads.location)` condition ensures the GiST index is engaged. The pipeline populates `leads.location` on every insert/upsert.
- **PERF-04 (Cross-source dedup):** `dedup.ts` has a three-path matching strategy. Permit number normalization strips common prefixes (bldg, bld, bp, com, res, pmt, permit) with correct regex ordering (longer prefixes first to avoid partial matches). Cross-source merges are logged distinctly.
- **PERF-03 (< 3 second load):** This is a runtime benchmark that cannot be verified statically. The underlying implementation is in place.

One minor finding: the doc comment on `getFilteredLeadsWithCount` (lines 463-464) still describes the old fetch-all behavior. This does not affect correctness.

Commit hashes from summaries confirmed present in git history: `a31dd00`, `b67deeb`, `c8d952c`.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
