---
phase: 8
slug: lead-automation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/scraper/ tests/dashboard/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/ tests/dashboard/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | AUTO-01 | unit | `npx vitest run tests/scraper/cron-route.test.ts -x` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | AUTO-04 | unit | `npx vitest run tests/scraper/rate-limit.test.ts -x` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | AUTO-05 | unit | `npx vitest run tests/scraper/user-trigger.test.ts -x` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 2 | AUTO-02 | unit | `npx vitest run tests/scraper/first-login.test.ts -x` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 2 | AUTO-03 | unit | `npx vitest run tests/dashboard/pipeline-progress.test.tsx -x` | ❌ W0 | ⬜ pending |
| 8-02-03 | 02 | 2 | PLSH-02 | unit | `npx vitest run tests/dashboard/empty-state.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scraper/cron-route.test.ts` — stubs for AUTO-01, AUTO-05 (cron auth, CRON_SECRET verification)
- [ ] `tests/scraper/rate-limit.test.ts` — stubs for AUTO-04 (1hr rate limit)
- [ ] `tests/scraper/user-trigger.test.ts` — stubs for AUTO-05 (session auth on user-triggered route)
- [ ] `tests/scraper/first-login.test.ts` — stubs for AUTO-02 (first-login pipeline trigger)
- [ ] `tests/dashboard/pipeline-progress.test.tsx` — stubs for AUTO-03 (progress indicator)
- [ ] `tests/dashboard/empty-state.test.tsx` — stubs for PLSH-02 (empty state messaging)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel Cron triggers daily in production | AUTO-01 | Cron only fires on production deployments | 1. Deploy to Vercel 2. Check Vercel dashboard cron logs next day 3. Verify pipeline ran and leads updated |
| First-login pipeline populates leads within minutes | AUTO-02 | Requires real scraping pipeline execution | 1. Create new user 2. Complete onboarding 3. Verify dashboard shows progress indicator 4. Wait for leads to appear |
| Rate limit enforcement across cold starts | AUTO-04 | Serverless cold starts reset in-memory state | 1. Trigger refresh 2. Wait < 1hr 3. Trigger again 4. Verify rate limit message shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
