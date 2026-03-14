---
phase: 6
slug: billing-and-launch-readiness
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-14
---

# Phase 6 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/billing/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/billing/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-00 | 01 | 1 | W0 | scaffold | `ls tests/billing/*.test.* tests/helpers/billing.ts` | Created in Task 0 | W0 |
| 06-01-01 | 01 | 1 | PLAT-05a | unit | `npx vitest run tests/billing/checkout.test.ts -x` | Created in Task 0 | pending |
| 06-01-02 | 01 | 1 | PLAT-05b | unit | `npx vitest run tests/billing/webhook.test.ts -x` | Created in Task 0 | pending |
| 06-01-03 | 01 | 1 | PLAT-05c | unit | `npx vitest run tests/billing/access-gate.test.ts -x` | Created in Task 0 | pending |
| 06-02-01 | 02 | 2 | PLAT-05d | unit | `npx vitest run tests/billing/billing-page.test.tsx -x` | Created in Plan 02 Task 2 | pending |

*Status: W0 = wave 0 scaffold, pending, green, red, flaky*

---

## Wave 0 Requirements

- [x] `tests/helpers/billing.ts` -- shared fixtures (mock subscription, mock Stripe events) -- Created by Plan 01 Task 0
- [x] `tests/billing/checkout.test.ts` -- stubs for PLAT-05a (mock Stripe client, verify checkout session params include setup fee) -- Created by Plan 01 Task 0
- [x] `tests/billing/webhook.test.ts` -- stubs for PLAT-05b (mock webhook events, verify subscription status updates) -- Created by Plan 01 Task 0
- [x] `tests/billing/access-gate.test.ts` -- stubs for PLAT-05c (mock subscription query, verify redirect behavior) -- Created by Plan 01 Task 0
- [ ] `tests/billing/billing-page.test.tsx` -- for PLAT-05d (render billing page with/without active subscription) -- Created by Plan 02 Task 2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect flow | PLAT-05a | Requires real Stripe test mode session | 1. Click subscribe 2. Verify redirect to Stripe Checkout 3. Complete with test card 4. Verify return to success page |
| Stripe Customer Portal access | PLAT-05 | External Stripe-hosted UI | 1. Click manage subscription 2. Verify portal loads 3. Test cancel flow |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
