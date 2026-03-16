---
phase: 9
slug: regression-test-safety-net
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/regressions/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/regressions/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TEST-02 | infra | `npx vitest run tests/smoke.test.ts` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | TEST-02 | infra | `npx vitest run tests/scraper/pipeline.test.ts` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/permit-upsert.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/geocoding-null.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-03 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/lead-query-sort.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-04 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/org-slug.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-05 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/stripe-idempotency.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-06 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/onboarding-upsert.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-07 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/date-formatting.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-08 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/equipment-types-guard.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-09 | 02 | 2 | TEST-01 | unit | `npx vitest run tests/regressions/geocoding-error-handling.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/sign-in-redirect.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/mobile-nav.test.tsx` | ❌ W0 | ⬜ pending |
| 09-03-03 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/landing-page.test.tsx` | ❌ W0 | ⬜ pending |
| 09-03-04 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/pricing-display.test.tsx` | ❌ W0 | ⬜ pending |
| 09-03-05 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/error-boundaries.test.tsx` | ❌ W0 | ⬜ pending |
| 09-03-06 | 03 | 2 | TEST-01 | component | `npx vitest run tests/regressions/loading-states.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/regressions/` — new directory for all 15 regression test files
- [ ] `package.json` — add `"test": "vitest run"` script
- [ ] Fix 6 failing tests in `tests/scraper/pipeline.test.ts` — mock `returning()` needs unique IDs

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
