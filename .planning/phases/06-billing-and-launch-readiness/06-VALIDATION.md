---
phase: 6
slug: billing-and-launch-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 6 — Validation Strategy

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
| 06-01-01 | 01 | 1 | PLAT-05a | unit | `npx vitest run tests/billing/checkout.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | PLAT-05b | unit | `npx vitest run tests/billing/webhook.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | PLAT-05c | unit | `npx vitest run tests/billing/access-gate.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | PLAT-05d | unit | `npx vitest run tests/billing/billing-page.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/billing/checkout.test.ts` — stubs for PLAT-05a (mock Stripe client, verify checkout session params include setup fee)
- [ ] `tests/billing/webhook.test.ts` — stubs for PLAT-05b (mock webhook events, verify subscription status updates)
- [ ] `tests/billing/access-gate.test.ts` — stubs for PLAT-05c (mock subscription query, verify redirect behavior)
- [ ] `tests/billing/billing-page.test.tsx` — stubs for PLAT-05d (render billing page with/without active subscription)
- [ ] `tests/helpers/billing.ts` — shared fixtures (mock subscription, mock Stripe events)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect flow | PLAT-05a | Requires real Stripe test mode session | 1. Click subscribe 2. Verify redirect to Stripe Checkout 3. Complete with test card 4. Verify return to success page |
| Stripe Customer Portal access | PLAT-05 | External Stripe-hosted UI | 1. Click manage subscription 2. Verify portal loads 3. Test cancel flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
