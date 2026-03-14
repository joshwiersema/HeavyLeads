# Phase 5: Deferred Items

## Pre-existing Build Issues

### 1. Type assertion error in queries.ts (from 05-01)

**File:** `src/lib/leads/queries.ts:279`
**Error:** `Argument of type '{ [key: string]: unknown; }' is not assignable to parameter of type 'SelectedFields'`
**Origin:** Commit c63ff07 (Phase 05-01, Task 1)
**Impact:** `next build` TypeScript check fails. Turbopack compilation succeeds but TS strict check rejects the `as { [key: string]: unknown }` assertion.
**Fix:** Cast `selectFields` to the correct Drizzle `SelectedFields` type or use a type-safe builder pattern instead of `Record<string, unknown>`.
**Discovered during:** Phase 05-03, Task 2 verification
