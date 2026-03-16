---
phase: 10
slug: query-optimizations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/leads/pagination.test.ts tests/leads/bookmarks-batch.test.ts tests/email/digest-optimization.test.ts tests/scraper/source-url-dedup.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | PERF-01 | unit | `npx vitest run tests/leads/pagination.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | PERF-01 | unit | `npx vitest run tests/leads/pagination.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | PERF-02 | unit | `npx vitest run tests/leads/bookmarks-batch.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | PERF-02 | unit | `npx vitest run tests/leads/bookmarks-batch.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | PERF-03 | unit | `npx vitest run tests/email/digest-optimization.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | PERF-03 | unit | `npx vitest run tests/email/digest-optimization.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 2 | PERF-04 | unit | `npx vitest run tests/scraper/source-url-dedup.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 | 2 | PERF-04 | unit | `npx vitest run tests/scraper/source-url-dedup.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/leads/pagination.test.ts` — covers PERF-01
- [ ] `tests/leads/bookmarks-batch.test.ts` — covers PERF-02
- [ ] `tests/email/digest-optimization.test.ts` — covers PERF-03
- [ ] `tests/scraper/source-url-dedup.test.ts` — covers PERF-04

*Existing test infrastructure (Vitest, mocking patterns) covers all other needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page navigation controls render correctly | PERF-01 | Visual UI check | Navigate dashboard, click Next/Previous, verify page indicator updates |
| Bookmarks page shows enriched lead cards | PERF-02 | Visual data check | Bookmark leads, visit bookmarks page, verify score/equipment/freshness display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
