---
phase: 13
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
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
| 13-01-01 | 01 | 1 | SCHM-01 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | SCHM-02 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | SCHM-03 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | SCHM-04 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 1 | SCHM-05 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-06 | 01 | 1 | SCHM-06 | unit | `npx vitest run src/__tests__/schema` | ❌ W0 | ⬜ pending |
| 13-01-07 | 01 | 1 | SCHM-07 | manual | N/A (PostGIS extension) | N/A | ⬜ pending |
| 13-02-01 | 02 | 2 | AUTH-02v3 | unit | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | AUTH-03v3 | unit | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | AUTH-04v3 | unit | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 2 | AUTH-05v3 | unit | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 13-02-05 | 02 | 2 | BILL-02v3 | unit | `npx vitest run src/__tests__/billing` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Schema type tests for new/modified tables
- [ ] Auth flow tests for atomic sign-up and error handling
- [ ] Billing tests for checkout param structure

*Existing test infrastructure (vitest + testing-library) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PostGIS extension enabled on Neon | SCHM-07 | Database-level operation | Run `SELECT PostGIS_Version();` on Neon console |
| Existing users unaffected by migration | SCHM-01 | Requires production data | Log in as admin account after migration, verify dashboard loads |
| Drizzle migration SQL review | SCHM-01-07 | Manual review for DROP statements | Review generated .sql files for any DROP COLUMN/TABLE |

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
