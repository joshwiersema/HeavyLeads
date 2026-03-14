---
phase: 2
slug: scraping-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing from Phase 1) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | DATA-01 | unit | `npx vitest run tests/scraper/adapter.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | DATA-01 | integration | `npx vitest run tests/scraper/pipeline.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | DATA-05 | unit | `npx vitest run tests/scraper/scheduler.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | DATA-07 | unit | `npx vitest run tests/scraper/geocoding.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Crawlee + node-cron dependencies installed
- [ ] PostGIS extension enabled on Neon database
- [ ] Test stub files for scraper adapters, pipeline, scheduler, geocoding
- [ ] Test fixtures with sample permit data for each jurisdiction

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scraper fetches live data from jurisdiction APIs | DATA-01 | Requires network access to external APIs | Run scraper manually, verify records appear in database |
| Daily schedule triggers correctly | DATA-05 | Requires time passage or cron simulation | Trigger cron job manually, verify pipeline executes |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
