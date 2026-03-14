---
phase: 3
slug: lead-intelligence-and-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | LEAD-01 | unit | `npx vitest run tests/leads/equipment-inference.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | LEAD-02 | unit | `npx vitest run tests/leads/scoring.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | LEAD-03 | unit | `npx vitest run tests/leads/timeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | UX-05 | unit | `npx vitest run tests/leads/freshness.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | LEAD-05 | unit | `npx vitest run tests/leads/filtering.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | LEAD-06 | unit | `npx vitest run tests/leads/geo-filter.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | UX-01 | smoke | `npx vitest run tests/leads/feed.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | LEAD-04 | smoke | `npx vitest run tests/leads/detail-view.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/leads/equipment-inference.test.ts` — covers LEAD-01 (pure function, multiple project types, edge cases)
- [ ] `tests/leads/scoring.test.ts` — covers LEAD-02 (weight verification, boundary values, missing data)
- [ ] `tests/leads/timeline.test.ts` — covers LEAD-03 (phase detection, urgency mapping)
- [ ] `tests/leads/freshness.test.ts` — covers UX-05 (badge logic for today, 3 days, 10 days)
- [ ] `tests/leads/geo-filter.test.ts` — covers LEAD-06 (Haversine SQL expression generation, NULL handling)
- [ ] `tests/leads/filtering.test.ts` — covers LEAD-05 (equipment type filter logic)
- [ ] `tests/leads/feed.test.tsx` — covers UX-01 (component render smoke test)
- [ ] `tests/leads/detail-view.test.tsx` — covers LEAD-04 (component render smoke test)
- [ ] `tests/helpers/leads.ts` — shared test fixtures (mock leads with various project types, coordinates)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Maps renders correctly with marker | LEAD-04 | Requires API key and visual verification | Open lead detail page, verify map loads at correct coordinates with pin |
| Slider drag UX is smooth | LEAD-06 | UI interaction quality; automated test can't assess smoothness | Drag radius slider, verify value updates without jank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
