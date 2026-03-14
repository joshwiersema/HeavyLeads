---
phase: 01-platform-foundation
plan: 01
subsystem: auth, database, ui
tags: [next.js, better-auth, drizzle-orm, neon, postgresql, shadcn-ui, react-hook-form, zod, vitest, organization, multi-tenancy]

# Dependency graph
requires:
  - phase: none
    provides: greenfield project
provides:
  - Next.js 16 application scaffold with Turbopack
  - Better Auth server/client configuration with email/password and organization plugin
  - Drizzle ORM connected to Neon PostgreSQL with full auth schema (7 tables) and company_profiles table
  - Sign-up flow (user + organization creation + active org set)
  - Sign-in flow with dashboard redirect
  - Protected dashboard layout with session validation and onboarding guard
  - Vitest test infrastructure with jsdom environment and test helpers
  - shadcn/ui component library (button, card, input, label, separator, sonner)
affects: [01-02-PLAN, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: [next.js 16.1.6, react 19.2.3, better-auth 1.5.5, drizzle-orm 0.45.1, @neondatabase/serverless, zod 4.3.6, react-hook-form 7.71.2, @hookform/resolvers 5.2.2, shadcn-ui 4.0.6, vitest 4.1.0, tailwind-css 4, sonner]
  patterns: [server-component session validation, organization-based multi-tenancy, tenant-scoped data access via organizationId, onboarding guard pattern, client-component auth forms with React Hook Form]

key-files:
  created: [src/lib/auth.ts, src/lib/auth-client.ts, src/lib/db/index.ts, src/lib/db/schema/auth.ts, src/lib/db/schema/company-profiles.ts, src/lib/validators/auth.ts, src/app/api/auth/[...all]/route.ts, src/app/(auth)/layout.tsx, src/app/(auth)/sign-in/page.tsx, src/app/(auth)/sign-up/page.tsx, src/app/(dashboard)/layout.tsx, src/app/(dashboard)/dashboard/page.tsx, src/components/auth/sign-up-form.tsx, src/components/auth/sign-in-form.tsx, src/components/auth/sign-out-button.tsx, drizzle.config.ts, vitest.config.ts, .env.example, tests/setup.ts, tests/helpers/auth.ts, tests/helpers/db.ts, src/types/index.ts]
  modified: [src/app/layout.tsx, src/app/page.tsx, package.json, .gitignore]

key-decisions:
  - "Used Inter font instead of Geist for root layout (standard SaaS typography)"
  - "Created sign-out button as separate client component for use in server-rendered dashboard layout"
  - "Used sonner instead of deprecated toast component from shadcn/ui v4"
  - "Root page (/) acts as redirect hub based on auth state rather than rendering content"
  - "Zod v4 installed (shipped with latest npm) - compatible with existing z.string().email() API"

patterns-established:
  - "Server Component session validation: auth.api.getSession({ headers: await headers() })"
  - "Onboarding guard: check activeOrganizationId AND companyProfiles.onboardingCompleted"
  - "Client auth forms: useForm + zodResolver + authClient methods"
  - "Tenant scoping: all custom tables include organizationId column"
  - "nextCookies() always last plugin in Better Auth config"

requirements-completed: [PLAT-01, PLAT-02, PLAT-03]

# Metrics
duration: 9min
completed: 2026-03-14
---

# Phase 1 Plan 1: Auth + Database Foundation Summary

**Better Auth email/password with organization-based multi-tenancy, Drizzle ORM schema with 8 tables, sign-in/sign-up pages, and protected dashboard layout on Next.js 16**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-14T03:52:57Z
- **Completed:** 2026-03-14T04:01:58Z
- **Tasks:** 3 completed
- **Files modified:** 26

## Accomplishments
- Scaffolded Next.js 16 project with all core dependencies (Better Auth, Drizzle ORM, Neon driver, shadcn/ui, Vitest)
- Configured Better Auth with email/password auth and organization plugin for multi-tenancy
- Created complete Drizzle schema: 7 auth tables (user, session, account, verification, organization, member, invitation) + company_profiles table with organizationId tenant scoping
- Built sign-up flow: creates user, creates organization, sets active org, redirects to onboarding
- Built sign-in flow: authenticates user, redirects to dashboard
- Created protected dashboard layout with server-side session validation and onboarding guard
- Set up Vitest with jsdom, path aliases, and test helpers for mock sessions and company profiles

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project, dependencies, schema, test infra** - `a7702a4` (feat)
2. **Task 2: Better Auth config, auth API route, auth pages** - `2504f82` (feat)
3. **Task 3: Protected dashboard layout, onboarding guard** - `56f519f` (feat)

## Files Created/Modified

- `src/lib/auth.ts` - Better Auth server configuration with email/password + organization plugin
- `src/lib/auth-client.ts` - Better Auth client with organization client plugin
- `src/lib/db/index.ts` - Drizzle ORM client connected to Neon PostgreSQL
- `src/lib/db/schema/auth.ts` - 7 Better Auth tables (user, session, account, verification, organization, member, invitation)
- `src/lib/db/schema/company-profiles.ts` - Company profile table with organizationId, HQ coords, equipment types, service radius
- `src/lib/db/schema/index.ts` - Schema barrel export
- `src/lib/validators/auth.ts` - Zod schemas for sign-up and sign-in forms
- `src/lib/utils.ts` - cn() utility (shadcn standard)
- `src/types/index.ts` - EquipmentType union type, EQUIPMENT_TYPES array, Drizzle type aliases
- `src/app/api/auth/[...all]/route.ts` - Better Auth API catch-all route handler
- `src/app/(auth)/layout.tsx` - Centered auth layout (no nav chrome)
- `src/app/(auth)/sign-in/page.tsx` - Sign-in page
- `src/app/(auth)/sign-up/page.tsx` - Sign-up page
- `src/app/(dashboard)/layout.tsx` - Protected dashboard layout with session + onboarding guard
- `src/app/(dashboard)/dashboard/page.tsx` - Placeholder dashboard with welcome message
- `src/app/layout.tsx` - Root layout with Inter font, metadata, Toaster
- `src/app/page.tsx` - Root redirect hub based on auth state
- `src/components/auth/sign-up-form.tsx` - Sign-up form with name, email, password, company name
- `src/components/auth/sign-in-form.tsx` - Sign-in form with email, password
- `src/components/auth/sign-out-button.tsx` - Client component for sign-out
- `drizzle.config.ts` - Drizzle Kit configuration for PostgreSQL
- `vitest.config.ts` - Vitest configuration with jsdom and path aliases
- `.env.example` - All required environment variables documented
- `tests/setup.ts` - Test setup with mock env vars
- `tests/helpers/auth.ts` - Mock session factory for testing
- `tests/helpers/db.ts` - Mock company profile factory for testing
- `tests/smoke.test.ts` - Smoke tests validating test infrastructure

## Decisions Made
- Used Inter font instead of Geist for the root layout (cleaner for SaaS applications)
- Created SignOutButton as a separate client component to work within the Server Component dashboard layout
- Used sonner instead of deprecated toast component (shadcn/ui v4 deprecated toast in favor of sonner)
- Root page (/) serves as a redirect hub checking auth state rather than rendering content
- Zod v4 shipped with latest npm -- compatible with existing API patterns and @hookform/resolvers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock session helper null handling**
- **Found during:** Task 1 (test helper creation)
- **Issue:** `createMockSessionNoOrg` passed `null` for activeOrganizationId but the nullish coalescing operator (`??`) in `createMockSession` treated `null` as nullish and replaced it with a default value
- **Fix:** Changed to explicit `"activeOrganizationId" in overrides` check to properly handle `null` values
- **Files modified:** tests/helpers/auth.ts
- **Verification:** All 5 smoke tests pass including null org test
- **Committed in:** a7702a4 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added SignOutButton client component**
- **Found during:** Task 3 (dashboard layout)
- **Issue:** Plan specified sign-out button in dashboard layout but didn't account for needing a client component since the layout is a Server Component
- **Fix:** Created `src/components/auth/sign-out-button.tsx` as a "use client" component that calls authClient.signOut()
- **Files modified:** src/components/auth/sign-out-button.tsx
- **Verification:** Build succeeds, component properly imported in server layout
- **Committed in:** 56f519f (Task 3 commit)

**3. [Rule 3 - Blocking] Used sonner instead of deprecated toast**
- **Found during:** Task 1 (shadcn/ui setup)
- **Issue:** shadcn/ui v4 deprecated the toast component in favor of sonner
- **Fix:** Installed sonner component instead, used Toaster from @/components/ui/sonner in root layout
- **Files modified:** src/components/ui/sonner.tsx, src/app/layout.tsx
- **Verification:** Build succeeds with Toaster component
- **Committed in:** a7702a4 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and compatibility. No scope creep.

## Issues Encountered
- Database schema push (`npx drizzle-kit push`) not executed because DATABASE_URL is not yet configured with a real Neon connection string. This is expected -- the user must set up their Neon project first. The command is documented in .env.example.

## User Setup Required

Before the application can run in development mode, the user must:
1. Create a Neon PostgreSQL project at https://console.neon.tech
2. Copy the connection string to `.env.local` as `DATABASE_URL`
3. Generate a Better Auth secret: `openssl rand -base64 32` and set as `BETTER_AUTH_SECRET`
4. Run `npx drizzle-kit push` to create the database tables

## Next Phase Readiness
- Auth foundation complete with email/password and organization-based multi-tenancy
- Schema tables ready for data -- needs `npx drizzle-kit push` after DATABASE_URL is configured
- Dashboard layout has onboarding guard ready for the onboarding wizard (Plan 01-02)
- Sign-up flow redirects to /onboarding which Plan 01-02 will create
- Test infrastructure ready for integration tests

## Self-Check: PASSED

All 22 claimed files exist. All 3 task commits verified (a7702a4, 2504f82, 56f519f).

---
*Phase: 01-platform-foundation*
*Completed: 2026-03-14*
