---
phase: 5
slug: lead-management-and-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/leads/ tests/email/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/leads/ tests/email/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UX-02 | unit | `npx vitest run tests/leads/lead-status.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | UX-03 | unit | `npx vitest run tests/leads/bookmarks.test.ts tests/leads/saved-searches.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | UX-06 | unit | `npx vitest run tests/leads/keyword-search.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | UX-04 | unit | `npx vitest run tests/email/digest.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/leads/lead-status.test.ts` — covers UX-02 (status CRUD, persistence, badge display)
- [ ] `tests/leads/bookmarks.test.ts` — covers UX-03 (bookmark toggle)
- [ ] `tests/leads/saved-searches.test.ts` — covers UX-03 (saved search CRUD, filter loading)
- [ ] `tests/email/digest.test.ts` — covers UX-04 (digest generation, lead filtering)
- [ ] `tests/leads/keyword-search.test.ts` — covers UX-06 (keyword, date range, project size)
- [ ] `tests/helpers/email.ts` — shared mock for Resend API

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email arrives in inbox with correct formatting | UX-04 | Requires real Resend delivery + email client | Set RESEND_API_KEY, trigger digest, check inbox |
| Status badge color matches design | UX-02 | Visual verification | Update lead status, verify badge colors match spec |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
