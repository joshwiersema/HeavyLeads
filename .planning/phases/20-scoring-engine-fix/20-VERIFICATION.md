---
phase: 20-scoring-engine-fix
verified: 2026-03-19T23:55:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 20: Scoring Engine Fix Verification Report

**Phase Goal:** Leads produce meaningfully different scores that vary by industry, and the single scoring engine is the only one in the codebase
**Verified:** 2026-03-19T23:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Leads with null estimatedValue receive a valueTier derived from projectType instead of a flat 10/20 fallback | VERIFIED | `tierScores` map in `value.ts` lines 39-46: high=18, medium=12, low=5. `PROJECT_TYPE_VALUE_MAP` with 33 entries in `enrichment.ts` lines 76-110. `inferValueTier` accepts `projectType` param and iterates map. |
| 2 | Low-confidence leads (all 5 industries tagged) are scored 0-15 on relevance via keyword matching instead of flat +5 | VERIFIED | `scoreProjectTypeForIndustry` function in `relevance.ts` lines 125-177. Low-confidence branch at lines 80-94 calls this function. `INDUSTRY_KEYWORDS` map covers all 5 industries with strong/weak keyword tiers. |
| 3 | Storm alerts decay in hours, bids in days, permits in weeks — each source type has its own freshness curve | VERIFIED | `FRESHNESS_CURVES` constant in `freshness.ts` lines 12-35 with storm (0.25d max per tier), bid (1-21d), default/permit (1-30d). `scoreFreshness` accepts `sourceType` and dispatches to curve. |
| 4 | Only one scoring engine exists — `src/lib/scoring/` is the single source of truth | VERIFIED | `src/lib/leads/scoring.ts` confirmed DELETED. `tests/leads/scoring.test.ts` confirmed DELETED. No remaining `from.*leads/scoring` imports anywhere. |
| 5 | The legacy `src/lib/leads/scoring.ts` file is deleted with no remaining imports anywhere | VERIFIED | File does not exist. `grep -r "from.*leads/scoring" src/` returns zero results. `ScoringInput` interface absent from `leads/types.ts`. |
| 6 | All `scoreLead()` call sites in `queries.ts` replaced with `scoreLeadForOrg` | VERIFIED | `queries.ts` has 6 occurrences of `scoreLeadForOrg` (import + call sites at lines 27, 277, 433, 601, 967, 1051). Zero `scoreLead(` calls remain. |
| 7 | HVAC/solar/roofing/electrical/heavy_equipment leads each score highest for their matching org | VERIFIED | `tests/scoring/industry-routing.test.ts` — 7 tests pass including per-industry routing (5), low-confidence routing (1), minimum 10-point difference (1). All pass. |
| 8 | Score standard deviation exceeds 15 across 1000+ synthetic leads | VERIFIED | `tests/scoring/score-differentiation.test.ts` — std dev test passes against 1200 synthetic leads. Summary documents stdDev=15.6. |
| 9 | Scoring engine produces full score range (not clustered) — range spans at least 50 points | VERIFIED | score-differentiation.test.ts passes: range spans 83 points (5-88), no single score >30% of leads, all four quartiles populated. |

**Score: 9/9 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scoring/value.ts` | Value scoring with projectType-based valueTier estimation | VERIFIED | `tierScores` map exists at line 39, `high=18/medium=12/low=5` logic confirmed |
| `src/lib/scoring/freshness.ts` | Source-type-specific freshness decay curves | VERIFIED | `FRESHNESS_CURVES` constant with `storm`, `bid`, `default` keys; `sourceType` parameter on `scoreFreshness` |
| `src/lib/scoring/relevance.ts` | Keyword-to-projectType relevance scoring for low-confidence leads | VERIFIED | `scoreProjectTypeForIndustry` defined at line 125, called at line 81. `INDUSTRY_KEYWORDS` at line 134. |
| `src/lib/scraper/enrichment.ts` | Enhanced `inferValueTier` with projectType lookup | VERIFIED | `PROJECT_TYPE_VALUE_MAP` at line 76 (33 entries), `inferValueTier` at line 112 accepts `projectType` param, `enrichLeads` call passes `lead.projectType` at line 156 |
| `src/lib/leads/queries.ts` | Lead queries using only the new scoring engine | VERIFIED | 6 occurrences of `scoreLeadForOrg`, zero `scoreLead(` calls |
| `src/lib/leads/scoring.ts` | DELETED | VERIFIED | File does not exist |
| `tests/leads/scoring.test.ts` | DELETED | VERIFIED | File does not exist |
| `tests/scoring/value-estimation.test.ts` | inferValueTier tests (10 tests) | VERIFIED | Exists, 10 tests all pass |
| `tests/scoring/industry-routing.test.ts` | Industry routing verification tests | VERIFIED | Exists, contains "scores highest" (5 per-industry tests), "low-confidence" test, ">= 10" diff test, all pass |
| `tests/scoring/score-differentiation.test.ts` | Statistical score differentiation tests | VERIFIED | Exists, contains "standard deviation", "rank order" tests, all 5 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/scraper/enrichment.ts` | `src/lib/scoring/value.ts` | `valueTier` field populated by enrichment, consumed by scoring | WIRED | `enrichLeads()` calls `inferValueTier(lead.estimatedValue, lead.projectType)` at line 156; `scoreValue()` reads `lead.valueTier` at line 38 |
| `src/lib/scoring/relevance.ts` | `src/lib/scoring/types.ts` | `LeadScoringInput.projectType` used for keyword matching | WIRED | `scoreProjectTypeForIndustry` receives `lead.projectType` from `scoreRelevance`; `LeadScoringInput.projectType` typed as `string | null` in types.ts |
| `src/lib/leads/queries.ts` | `src/lib/scoring/engine.ts` | `scoreLeadForOrg` import replaces old `scoreLead` | WIRED | Import at line 27, 6 call sites confirmed, zero remaining `scoreLead(` calls |
| `tests/scoring/industry-routing.test.ts` | `src/lib/scoring/engine.ts` | `scoreLeadForOrg` called with industry-specific orgs | WIRED | Import at line 3, used in all 7 test cases |
| `tests/scoring/score-differentiation.test.ts` | `src/lib/scoring/engine.ts` | `scoreLeadForOrg` called with 1200 synthetic leads | WIRED | Import at line 3, used across all 5 tests |
| `src/lib/scoring/engine.ts` | `src/lib/scoring/freshness.ts` | `scoreFreshness(lead.scrapedAt, lead.sourceType)` | WIRED | Line 33 of engine.ts passes both `scrapedAt` and `sourceType` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCOR-01 | 20-03 | Leads produce score standard deviation > 15 across a sample of 1000+ leads | SATISFIED | `score-differentiation.test.ts` test "1200 synthetic leads produce standard deviation > 15" passes; summary documents stdDev=15.6 |
| SCOR-02 | 20-01 | Value estimation heuristic assigns valueTier from projectType when estimatedValue is null | SATISFIED | `PROJECT_TYPE_VALUE_MAP` in enrichment.ts, `inferValueTier` projectType branch confirmed in code and 10 passing tests |
| SCOR-03 | 20-01 | Industry relevance uses keyword-to-projectType matching (0-15 range) instead of flat low-confidence fallback | SATISFIED | `scoreProjectTypeForIndustry` replaces flat +5, `INDUSTRY_KEYWORDS` map with strong(15)/weak(8)/none(3) tiers verified in code and tests |
| SCOR-04 | 20-01 | Freshness scoring uses source-type-specific curves (storm=hours, bid=days, permit=weeks) | SATISFIED | `FRESHNESS_CURVES` with three named tiers verified; 9 freshness tests in engine.test.ts all pass |
| SCOR-05 | 20-02 | Legacy scoring system (src/lib/leads/scoring.ts) is removed; single scoring engine remains | SATISFIED | `src/lib/leads/scoring.ts` deleted, `tests/leads/scoring.test.ts` deleted, no remaining `from.*leads/scoring` imports, zero `scoreLead(` calls in src/ |
| SCOR-06 | 20-03 | HVAC leads score highest for HVAC accounts, solar leads for solar accounts, etc. (industry routing verified) | SATISFIED | `industry-routing.test.ts` 7 tests all pass including all 5 industry-specific routing assertions |

All 6 requirements assigned to Phase 20 in REQUIREMENTS.md are satisfied. No orphaned requirements found (REQUIREMENTS.md table maps all 6 IDs to Phase 20, and all 6 appear in plan frontmatter: SCOR-02/03/04 in 20-01, SCOR-05 in 20-02, SCOR-01/06 in 20-03).

---

### Anti-Patterns Found

None detected. No TODO/FIXME/XXX/PLACEHOLDER comments in any modified files. No empty implementations or console.log-only handlers. No stub patterns found.

---

### TypeScript Compilation

TypeScript compilation produces errors only in pre-existing test files unrelated to scoring:
- `tests/email/unsubscribe.test.ts` — pre-existing EmailLayoutProps errors (noted in Plan 01 summary as pre-existing)

Zero TypeScript errors in any scoring, leads, or enrichment files introduced or modified by this phase.

---

### Human Verification Required

None. All scoring logic is deterministic and fully verifiable programmatically. The 83-test suite covers unit and statistical integration behavior completely.

---

### Test Suite Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/scoring/engine.test.ts` | 58 | All pass |
| `tests/scoring/value-estimation.test.ts` | 10 | All pass |
| `tests/scoring/industry-routing.test.ts` | 7 | All pass |
| `tests/scoring/score-differentiation.test.ts` | 5 | All pass |
| `tests/scoring/distance.test.ts` | 3 | All pass |
| **Total** | **83** | **All pass** |

---

### Summary

Phase 20 fully achieves its goal. The three root-cause scoring dimensions are fixed: value differentiation via projectType-derived tiers (5/12/18 vs flat 10), freshness differentiation via source-type-specific decay curves (storm=hours, bid=days, permit=weeks), and relevance differentiation via keyword matching (3-15 vs flat 5). The legacy `src/lib/leads/scoring.ts` is deleted and all call sites migrated to `scoreLeadForOrg`. Integration tests confirm stdDev=15.6 across 1200 leads, score range of 83 points (5-88), and all 5 industries route correctly.

---

_Verified: 2026-03-19T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
