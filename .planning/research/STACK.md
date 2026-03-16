# Technology Stack: v2.1 Bug Fixes & Hardening

**Project:** HeavyLeads
**Researched:** 2026-03-15
**Scope:** Additions/changes for testing server actions, better-auth password reset & email verification, cursor-based pagination with Drizzle

## Context

This is a SUBSEQUENT MILESTONE research. The existing stack (Next.js 16.1.6, better-auth 1.5.5, Drizzle 0.45.1, Vitest 4.1.0, React Email + Resend, Vercel) is validated and deployed. This document covers ONLY the incremental stack changes needed for v2.1 features.

---

## 1. Testing Server Actions with Vitest

### No New Dependencies Required

**Confidence:** HIGH (verified against existing codebase tests)

The project already has a well-established testing pattern for server actions. The existing tests in `tests/leads/bookmarks.test.ts` and `tests/leads/lead-status.test.ts` demonstrate a complete, working approach:

| What | How | Already In Place |
|------|-----|-----------------|
| Test runner | Vitest 4.1.0 | Yes |
| Component testing | @testing-library/react 16.3.2 | Yes |
| DOM matchers | @testing-library/jest-dom 6.9.1 | Yes |
| DOM environment | jsdom 28.1.0 | Yes |
| React plugin | @vitejs/plugin-react 6.0.1 | Yes |
| Path aliases | Manual `resolve.alias` in vitest.config.ts | Yes |

### Established Mocking Pattern for Server Actions

The codebase already uses this tested pattern for server actions that call `auth.api.getSession()`, `headers()`, `revalidatePath()`, and `db` queries:

```typescript
// Mock auth module
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock db with chainable query builder
vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args) => ({ values: (...vArgs) => ({ onConflictDoUpdate: vi.fn() }) }),
    select: (...args) => ({ from: (...fArgs) => ({ where: (...wArgs) => ({ limit: vi.fn() }) }) }),
    delete: (...args) => ({ where: vi.fn() }),
  },
}));
```

### What NOT to Add

| Library | Why Not |
|---------|---------|
| `vite-tsconfig-paths` | Next.js official docs recommend it, but the project already uses manual `resolve.alias` in vitest.config.ts which works identically. Switching would be churn for zero benefit. |
| `@testing-library/user-event` | Not needed for the regression tests planned. These are server action unit tests and component render tests, not interaction-heavy form flows. |
| Playwright / E2E framework | Out of scope for v2.1. The existing unit test approach (mocking Next.js APIs) covers server actions adequately. E2E testing is a future milestone. |
| `next/experimental/testing/server` | Next.js does not yet offer a stable testing utility for server actions. The community-standard approach is `vi.mock()` as already implemented. |

### Limitation Acknowledged

Next.js official docs state: "Since async Server Components are new to the React ecosystem, Vitest currently does not support them." The existing codebase works around this by testing server actions (which ARE async functions, not async components) directly via mocked imports. This is the correct approach -- server actions are plain async functions that happen to use `"use server"`, not React Server Components.

**Confidence:** HIGH -- pattern verified against 6 existing server action test files in the codebase.

---

## 2. better-auth Password Reset & Email Verification

### No New Dependencies Required

**Confidence:** HIGH (verified against better-auth official docs)

Both password reset and email verification are **built-in capabilities** of better-auth's `emailAndPassword` configuration. The project already has:

- `better-auth@^1.5.5` (server)
- `better-auth/react` (client -- `createAuthClient`)
- `resend@^6.9.3` (email sending)
- `@react-email/components@^1.0.9` (email templates)
- `zod@^4.3.6` (form validation)
- `react-hook-form@^7.71.2` + `@hookform/resolvers@^5.2.2` (forms)

### Server Configuration Changes

Add to existing `auth.ts` -- no new imports needed beyond the existing Resend client:

| Config Property | Location | What It Does |
|----------------|----------|--------------|
| `emailAndPassword.sendResetPassword` | `betterAuth({ emailAndPassword: { ... } })` | Callback that sends password reset email via Resend |
| `emailAndPassword.requireEmailVerification` | `betterAuth({ emailAndPassword: { ... } })` | Blocks login until email is verified |
| `emailVerification.sendVerificationEmail` | `betterAuth({ emailVerification: { ... } })` | Callback that sends verification email via Resend |
| `emailVerification.sendOnSignUp` | `betterAuth({ emailVerification: { ... } })` | Auto-send verification on signup |
| `emailVerification.autoSignInAfterVerification` | `betterAuth({ emailVerification: { ... } })` | Skip re-login after clicking verify link |

### Client Methods Available (already in `better-auth/react`)

| Method | Purpose |
|--------|---------|
| `authClient.forgetPassword({ email, redirectTo })` | Triggers password reset email |
| `authClient.resetPassword({ newPassword })` | Sets new password using token from URL |
| `authClient.sendVerificationEmail({ email, callbackURL })` | Resends verification email |

### Database Schema -- Already Sufficient

The existing `verification` table in `src/lib/db/schema/auth.ts` stores both password reset tokens and email verification tokens. No schema migration needed:

```typescript
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

The `user.emailVerified` boolean column also already exists.

### New Email Templates Needed (use existing stack)

| Template | Purpose | Build With |
|----------|---------|------------|
| `PasswordResetEmail` | "Click to reset your password" link | `@react-email/components` (already installed) |
| `EmailVerificationEmail` | "Click to verify your email" link | `@react-email/components` (already installed) |

### New Pages Needed

| Route | Purpose | Components Used |
|-------|---------|----------------|
| `/forgot-password` | Enter email to request reset | react-hook-form + zod (existing) |
| `/reset-password` | Enter new password (token in URL) | react-hook-form + zod (existing) |

No new route for email verification -- better-auth handles the verify callback via its API route handler at `/api/auth/*`.

### Important Implementation Detail

better-auth docs warn: "Avoid awaiting the email sending to prevent timing attacks." On Vercel serverless, use `void` (fire-and-forget) or `waitUntil` for email sending in the callback. The existing digest email in `send-digest.ts` already demonstrates this pattern.

**Confidence:** HIGH -- verified against better-auth official docs and existing schema.

---

## 3. Cursor-Based Pagination with Drizzle

### No New Dependencies Required

**Confidence:** HIGH (verified against Drizzle official docs)

Cursor-based pagination is a built-in Drizzle ORM pattern using existing operators (`gt`, `lt`, `desc`, `asc`) that are already imported in `src/lib/leads/queries.ts`.

### Why Cursor-Based, Not Offset-Based

The existing query in `getFilteredLeads` uses `limit` + `offset`, which has two problems at scale:
1. **Performance degradation** -- PostgreSQL must scan and skip `offset` rows
2. **Data inconsistency** -- new leads inserted between page loads cause duplicates or skips

Cursor-based pagination solves both. For the lead feed sorted by score (computed in-memory), the cursor must be applied after enrichment, not at the SQL level.

### Implementation Approach

The lead feed has a unique challenge: sorting is done **in-memory** after SQL fetch (by computed `score` DESC, then `scrapedAt` DESC). This means cursor-based pagination must work at the application level, not pure SQL.

**Recommended pattern -- hybrid approach:**

| Layer | What | How |
|-------|------|-----|
| SQL query | Fetch candidates within radius | Same Haversine WHERE clause (no cursor at SQL level) |
| In-memory | Enrich, score, sort | Same pipeline as current |
| Cursor | Paginate sorted results | Cursor = `{ score: number, scrapedAt: string, id: string }` |
| Response | Return page + `nextCursor` | Client sends cursor back for next page |

The multi-column cursor (`score` + `scrapedAt` + `id`) is necessary because:
- `score` is not unique (multiple leads can have score 78)
- `scrapedAt` is not unique (multiple leads scraped in same batch)
- `id` (UUID) is unique and serves as the tiebreaker

**Alternative considered and rejected:**

| Approach | Why Not |
|----------|---------|
| SQL-level cursor on `scrapedAt` | Score is computed in-memory, so SQL pagination would break score ordering |
| `drizzle-cursor` npm package | Unnecessary dependency for a simple WHERE clause pattern. The official Drizzle docs pattern is 5 lines of code. |
| `drizzle-pagination` npm package | Same -- adds dependency for trivial logic |
| Offset pagination with larger limit | Doesn't fix the data inconsistency problem, degrades at scale |

### Drizzle Operators Already Available

```typescript
// Already imported in queries.ts:
import { sql, and, isNotNull, eq, desc, asc, ilike, gte, lte, or } from "drizzle-orm";
// gt and lt are also available from drizzle-orm, just add to import
```

### Index Recommendation

The existing `leads_scraped_at_idx` index covers the `scrapedAt` component of the cursor. No new database index is needed because the cursor operates at the application level after in-memory scoring.

**Confidence:** HIGH -- verified against Drizzle ORM official cursor pagination guide.

---

## Complete Stack Changes Summary

### Dependencies to Add

**None.** All three features are achievable with the existing dependency set.

### Dependencies to NOT Add

| Library | Version | Why Not |
|---------|---------|---------|
| `vite-tsconfig-paths` | any | Existing path alias config works; switching adds churn |
| `drizzle-cursor` | any | Official pattern is trivial; no need for a wrapper |
| `drizzle-pagination` | any | Same reason |
| `@testing-library/user-event` | any | Not needed for server action unit tests |
| `playwright` | any | E2E testing is a future milestone |
| `next/experimental/testing/server` | any | Not stable; community uses vi.mock() |
| `better-auth-ui` | any | Project has its own UI; this adds unnecessary abstraction |

### Configuration Changes Needed

| File | Change | Why |
|------|--------|-----|
| `src/lib/auth.ts` | Add `sendResetPassword` to `emailAndPassword` | Enable password reset flow |
| `src/lib/auth.ts` | Add `emailVerification` config block | Enable email verification |
| `src/lib/auth-client.ts` | Export `forgetPassword`, `resetPassword` from `authClient` | Client-side password reset |
| `src/lib/leads/queries.ts` | Modify `getFilteredLeads` to accept and return cursor | Pagination |
| `package.json` | Add `"test": "vitest"` script | Missing from scripts (currently no test script) |

### New Files Needed

| File | Purpose |
|------|---------|
| `src/components/emails/password-reset.tsx` | React Email template for password reset |
| `src/components/emails/email-verification.tsx` | React Email template for email verification |
| `src/app/(auth)/forgot-password/page.tsx` | Forgot password form page |
| `src/app/(auth)/reset-password/page.tsx` | Reset password form page (receives token from URL) |
| `tests/auth/password-reset.test.ts` | Tests for password reset flow |
| `tests/auth/email-verification.test.ts` | Tests for email verification flow |
| `tests/leads/pagination.test.ts` | Tests for cursor-based pagination |

---

## Sources

- [better-auth Email & Password docs](https://better-auth.com/docs/authentication/email-password) -- password reset, email verification config (HIGH confidence)
- [better-auth Email concepts](https://better-auth.com/docs/concepts/email) -- email sending patterns (HIGH confidence)
- [Drizzle ORM Cursor-Based Pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) -- official guide (HIGH confidence)
- [Next.js Vitest Testing Guide](https://nextjs.org/docs/app/guides/testing/vitest) -- official setup (HIGH confidence)
- [Next.js Server Actions Testing Discussion](https://github.com/vercel/next.js/discussions/69036) -- community patterns (MEDIUM confidence)
- [better-auth + Resend password reset tutorial](https://dev.to/daanish2003/forgot-and-reset-password-using-betterauth-nextjs-and-resend-ilj) -- integration example (MEDIUM confidence)
- [better-auth + Resend email verification tutorial](https://dev.to/daanish2003/email-verification-using-betterauth-nextjs-and-resend-37gn) -- integration example (MEDIUM confidence)
