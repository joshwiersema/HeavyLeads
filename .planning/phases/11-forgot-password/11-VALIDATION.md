---
phase: 11
slug: forgot-password
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/auth/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/auth/ -x`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/forgot-password-form.test.tsx` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/reset-password-form.test.tsx tests/auth/send-reset-password.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth/forgot-password-form.test.tsx` — covers AUTH-01a
- [ ] `tests/auth/reset-password-form.test.tsx` — covers AUTH-01b
- [ ] `tests/auth/sign-in-forgot-link.test.tsx` — covers AUTH-01c
- [ ] `tests/auth/send-reset-password.test.ts` — covers AUTH-01d

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email delivery and spam filtering | AUTH-01 | Requires actual Resend delivery | Send reset email, check inbox/spam |
| Full redirect chain works end-to-end | AUTH-01 | Requires browser + server | Click reset link, verify redirect to reset page with token |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
