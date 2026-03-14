---
phase: 4
slug: multi-source-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/scraper/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DATA-02 | unit | `npx vitest run tests/scraper/sam-gov-adapter.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DATA-03 | unit | `npx vitest run tests/scraper/news-adapter.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DATA-04 | unit | `npx vitest run tests/scraper/dorking-adapter.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DATA-06 | unit | `npx vitest run tests/scraper/dedup.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | DATA-06 | unit | `npx vitest run tests/scraper/pipeline.test.ts -x` | Exists (update) | ⬜ pending |
| 04-02-03 | 02 | 2 | DATA-06 | integration | `npx vitest run tests/leads/multi-source.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scraper/sam-gov-adapter.test.ts` — covers DATA-02 (SAM.gov API response parsing, NAICS filtering)
- [ ] `tests/scraper/news-adapter.test.ts` — covers DATA-03 (RSS parsing, construction filtering)
- [ ] `tests/scraper/dorking-adapter.test.ts` — covers DATA-04 (Serper.dev query, rate limiting)
- [ ] `tests/scraper/dedup.test.ts` — covers DATA-06 (proximity + text similarity matching, merge/keep)
- [ ] `tests/scraper/lead-validation.test.ts` — covers generalized RawLeadData validation
- [ ] `tests/leads/multi-source.test.ts` — covers multi-source attribution on lead detail
- [ ] Update `tests/scraper/pipeline.test.ts` — adapt for generalized adapter interface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SAM.gov live API returns real bid data | DATA-02 | Requires API key registration | Set SAM_GOV_API_KEY, run adapter, verify structured bid results |
| Serper.dev returns real search results | DATA-04 | Requires API key | Set SERPER_API_KEY, run adapter, verify results match dorking queries |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
