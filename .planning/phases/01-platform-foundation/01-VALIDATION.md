---
phase: 1
slug: platform-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | PLAT-01 | integration | `npx vitest run tests/auth/signup.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PLAT-01 | integration | `npx vitest run tests/auth/signin.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PLAT-02 | integration | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PLAT-03 | unit | `npx vitest run tests/db/tenant-isolation.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | PLAT-04 | unit | `npx vitest run tests/onboarding/validation.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | PLAT-04 | unit | `npx vitest run tests/onboarding/geocoding.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | PLAT-06 | integration | `npx vitest run tests/settings/account.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | PLAT-06 | integration | `npx vitest run tests/settings/company.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with Next.js paths and TypeScript support
- [ ] `tests/setup.ts` — Test setup file (mock environment variables, db helpers)
- [ ] `tests/helpers/auth.ts` — Helper to create authenticated test sessions
- [ ] `tests/helpers/db.ts` — Helper to create/tear down test data with tenant scoping
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom`
- [ ] All test stub files listed in verification map

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across browser refresh | PLAT-02 | Requires real browser session/cookie behavior | 1. Sign in 2. Refresh browser 3. Verify still logged in |
| Onboarding wizard step navigation | PLAT-04 | Multi-step UI flow with visual feedback | 1. Start onboarding 2. Navigate forward/back 3. Verify state persistence across steps |
| Tenant data isolation (end-to-end) | PLAT-03 | Requires two separate authenticated sessions | 1. Create two companies 2. Add data as Company A 3. Log in as Company B 4. Verify Company A data not visible |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
