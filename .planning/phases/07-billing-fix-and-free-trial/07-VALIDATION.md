---
phase: 7
slug: billing-fix-and-free-trial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/billing/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/billing/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | BILL-01 | unit | `npx vitest run tests/billing/auth-config.test.ts -x` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | BILL-02 | unit | `npx vitest run tests/billing/auth-config.test.ts -x` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | BILL-05 | unit | `npx vitest run tests/billing/checkout-params.test.ts -x` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | BILL-03 | unit | `npx vitest run tests/billing/trial-banner.test.tsx -x` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 2 | BILL-03 | unit | `npx vitest run tests/billing/billing-utils.test.ts -x` | ❌ W0 | ⬜ pending |
| 7-02-03 | 02 | 2 | BILL-04 | unit | `npx vitest run tests/billing/billing-page.test.tsx -x` | ✅ (partial) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/billing/auth-config.test.ts` — stubs for BILL-01, BILL-02 (verify auth config exports)
- [ ] `tests/billing/trial-banner.test.tsx` — stubs for BILL-03 (trial banner component rendering)
- [ ] `tests/billing/billing-utils.test.ts` — stubs for BILL-03 (getTrialStatus utility)
- [ ] `tests/billing/checkout-params.test.ts` — stubs for BILL-05 (setup fee conditional logic)
- [ ] Update `tests/billing/billing-page.test.tsx` — stubs for BILL-04 (add trial-ended state tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Stripe Checkout flow with trial | BILL-02 | Requires live Stripe test-mode session | 1. Sign up new user 2. Click subscribe 3. Verify Stripe Checkout shows trial messaging 4. Complete checkout 5. Verify subscription status is "trialing" |
| Trial expiry redirect to billing | BILL-04 | Requires expired trial state in Stripe | 1. Set trial end to past date in DB 2. Navigate to dashboard 3. Verify redirect to /billing with "Trial ended" message |
| Setup fee not charged during trial | BILL-05 | Requires Stripe dashboard verification | 1. Complete trial checkout 2. Check Stripe dashboard for no immediate charge 3. After trial convert to paid 4. Verify setup fee appears on first invoice |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
