# Phase 13: Schema Foundation - Research

**Researched:** 2026-03-16
**Domain:** Database schema evolution (Drizzle ORM + Neon PostgreSQL + PostGIS), auth hardening (Better Auth), billing fix
**Confidence:** HIGH

## Summary

Phase 13 is a pure foundation phase -- database schema changes, auth sign-up hardening, and a billing params fix, with no new user-facing features beyond improved error messages on the sign-up form. The central challenge is evolving a live production database schema without disrupting existing heavy-equipment users. Every schema change must be additive (new columns nullable with defaults, new tables created alongside existing ones) following expand-then-contract discipline. The `company_profiles` table rename to `organization_profiles` is the highest-risk operation because Drizzle's diff engine interprets a table name change as "drop old table + create new table," which destroys all existing profile data if the generated migration SQL is applied without manual review.

The phase has three distinct concerns: (1) schema evolution -- adding industry support to organizations, enrichment columns to leads, PostGIS geometry column, new tables for lead enrichments and scraper runs, and CRM-lite bookmark expansion; (2) auth hardening -- making sign-up atomic (user + org + setActive in one operation with cleanup on failure), adding confirm-password, and fixing the sign-in redirect; (3) billing fix -- correcting the `buildCheckoutSessionParams` return value to eliminate the double-nested `params` key.

**Primary recommendation:** Use `drizzle-kit generate` (never `push`) for all schema changes, manually review every generated `.sql` file for DROP statements, and write the `company_profiles` rename as a custom migration using `ALTER TABLE RENAME`. Add the `industry` column to the `organization` table via Better Auth's `additionalFields` configuration so the plugin's CRUD operations automatically include it. Make sign-up atomic by moving org creation into a Better Auth `databaseHooks.user.create.after` hook with cleanup on failure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHM-01 | Organization has industry field, existing orgs backfilled as heavy_equipment | Better Auth `additionalFields` on organization table + backfill migration |
| SCHM-02 | Organization profiles store industry-specific specializations, service areas, certifications, target project values | Rename `company_profiles` to `organization_profiles` via custom ALTER TABLE migration, add nullable columns |
| SCHM-03 | Leads have source type, cross-industry relevance tags, value tier, severity, deadline, content-hash dedup | Add columns to existing `leads` table with nullable defaults |
| SCHM-04 | Lead enrichments stored in separate table | New `lead_enrichments` table with FK to leads |
| SCHM-05 | Bookmarks support notes and pipeline status | Add `notes` and `pipelineStatus` columns to existing `bookmarks` table |
| SCHM-06 | Scraper runs tracked per-adapter with status, counts, error logging | New `scraper_runs` table replacing/extending `pipeline_runs` |
| SCHM-07 | PostGIS extension enabled with geometry column on leads | Manual `CREATE EXTENSION postgis`, add `geometry(Point, 4326)` column alongside existing lat/lng |
| AUTH-02v3 | Atomic sign-up (user + org + active org in single transaction or cleanup on failure) | Better Auth `databaseHooks.user.create.after` hook + `hooks.after` middleware for org creation |
| AUTH-03v3 | Specific error messages (email in use, password too weak, org name taken) | Better Auth error codes + client-side error mapping |
| AUTH-04v3 | Sign-in redirects to /dashboard not / | One-line fix in `sign-in-form.tsx` line 73 |
| AUTH-05v3 | Confirm password field on sign-up form | Zod `.refine()` on signUpSchema + new input field |
| BILL-02v3 | Fix double-nested checkout params | Verify and correct `buildCheckoutSessionParams` return value format |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM with TypeScript-first schema definitions | Already in use, handles PostGIS `geometry()` type natively since v0.31 |
| drizzle-kit | ^0.31.9 | Migration generation and application | `generate` + `migrate` workflow for production; custom migrations for table renames |
| better-auth | ^1.5.5 | Auth framework with organization plugin | `additionalFields` supports adding `industry` to the organization table |
| @better-auth/stripe | ^1.5.5 | Stripe billing integration | `getCheckoutSessionParams` API needs params format verification |
| @neondatabase/serverless | ^1.0.2 | Neon PostgreSQL HTTP driver | Compatible with PostGIS geometry types (verified: Neon supports PostGIS extension natively) |
| zod | ^4.3.6 | Schema validation | Existing pattern for form validation; add confirm-password refinement |
| react-hook-form | ^7.71.2 | Form state management | Existing sign-up form pattern |

### Supporting (no new packages needed)

This phase requires zero new npm dependencies. PostGIS is a PostgreSQL extension, not an npm package. All schema changes use existing Drizzle column types. The `geometry()` column type is built into `drizzle-orm/pg-core`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth `additionalFields` for org.industry | Direct Drizzle column addition | `additionalFields` keeps Better Auth's org CRUD in sync; direct column risks plugin not knowing about the field |
| `drizzle-kit generate` + manual review | `drizzle-kit push` | `push` applies changes directly without SQL review -- unacceptable for production with rename operations |
| Custom `ALTER TABLE RENAME` migration | Let Drizzle generate the diff | Drizzle generates DROP + CREATE for table renames, destroying all data |
| `databaseHooks.user.create.after` for atomic signup | Client-side 3-step flow (current) | Hooks run server-side in the auth transaction context; client-side has no rollback capability |

## Architecture Patterns

### Migration Workflow (CRITICAL)

**The production-safe migration workflow for this phase:**

```
1. Edit Drizzle schema files (TypeScript)
2. Run: npx drizzle-kit generate
3. REVIEW the generated .sql file for DROP statements
4. If DROP TABLE or DROP COLUMN found: DELETE the generated file,
   write a custom migration instead
5. For table renames: use drizzle-kit generate --custom --name=rename-xyz
   and write ALTER TABLE RENAME manually
6. Test on a Neon branch (not production)
7. Run: npx drizzle-kit migrate
8. Deploy code that reads the new columns
```

**Never use `drizzle-kit push` against production.**

### Recommended Migration Order

```
Migration 1: CREATE EXTENSION IF NOT EXISTS postgis
Migration 2: ALTER TABLE company_profiles RENAME TO organization_profiles
Migration 3: Add columns to organization_profiles (specializations, certifications, etc.)
Migration 4: Add industry column to organization table + backfill
Migration 5: Add columns to leads table (content_hash, applicable_industries, etc.)
Migration 6: Add geometry column to leads + GiST index
Migration 7: Add columns to bookmarks (notes, pipeline_status)
Migration 8: CREATE TABLE lead_enrichments
Migration 9: CREATE TABLE scraper_runs
```

Each migration is independently deployable. If any fails, subsequent migrations are not affected because there are no cross-migration dependencies except:
- Migration 1 (PostGIS) must precede Migration 6 (geometry column)
- Migration 2 (rename) must precede Migration 3 (add columns to renamed table)

### Schema Changes Detail

**Organization table (Better Auth managed):**
```typescript
// In auth.ts -- add via additionalFields
organization({
  schema: {
    organization: {
      additionalFields: {
        industry: {
          type: "string",
          required: false,  // nullable for backfill
          defaultValue: "heavy_equipment",
          input: true,  // accepted during org creation
        },
      },
    },
  },
})
```

**Organization profiles (renamed from company_profiles):**
```typescript
// New columns (all nullable for backward compat):
specializations: text("specializations").array(),
serviceTypes: text("service_types").array(),
certifications: text("certifications").array(),
targetProjectValueMin: integer("target_project_value_min"),
targetProjectValueMax: integer("target_project_value_max"),
yearsInBusiness: integer("years_in_business"),
companySize: text("company_size"),
```

**Leads table (new columns):**
```typescript
contentHash: text("content_hash"),  // SHA-256 for dedup
applicableIndustries: text("applicable_industries").array().default([]),
valueTier: text("value_tier"),  // low/medium/high/premium
severity: text("severity"),  // informational/moderate/urgent/critical
deadline: timestamp("deadline"),
location: geometry("location", { type: "point", mode: "xy", srid: 4326 }),
```

**Bookmarks table (new columns):**
```typescript
notes: text("notes"),
pipelineStatus: text("pipeline_status").default("saved"),
```

**New lead_enrichments table:**
```typescript
export const leadEnrichments = pgTable("lead_enrichments", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  enrichmentType: text("enrichment_type").notNull(), // weather, property, incentive
  data: text("data").notNull(), // JSON stringified
  source: text("source"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
```

**New scraper_runs table:**
```typescript
export const scraperRuns = pgTable("scraper_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineRunId: uuid("pipeline_run_id").references(() => pipelineRuns.id),
  adapterId: text("adapter_id").notNull(),
  adapterName: text("adapter_name").notNull(),
  industry: text("industry"),
  status: text("status").notNull().default("pending"),
  recordsFound: integer("records_found"),
  recordsStored: integer("records_stored"),
  recordsSkipped: integer("records_skipped"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

### PostGIS Integration Pattern

```typescript
// Column definition in leads schema
import { geometry } from "drizzle-orm/pg-core";

location: geometry("location", { type: "point", mode: "xy", srid: 4326 }),

// GiST spatial index
index("leads_location_gist_idx").using("gist", table.location),

// Insert with xy mode
await db.insert(leads).values({
  // ... other fields
  location: { x: lng, y: lat },  // Note: x=longitude, y=latitude
});

// Spatial query with ST_DWithin (meters for geography, degrees for geometry)
import { sql } from "drizzle-orm";

const point = sql`ST_SetSRID(ST_MakePoint(${hqLng}, ${hqLat}), 4326)`;
const radiusMeters = radiusMiles * 1609.34;

// For geography-cast distance queries:
const withinRadius = sql`ST_DWithin(
  ${leads.location}::geography,
  ${point}::geography,
  ${radiusMeters}
)`;
```

**Source:** [Drizzle ORM PostGIS Guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point)

### Atomic Sign-Up Pattern

The current sign-up is 3 separate client-side API calls (sign-up user, create org, set active org). If step 2 fails, an orphaned user exists. If step 3 fails, the user has an org but no active org, causing redirect loops.

**Recommended approach: Server-side hook + client-side wrapper**

```typescript
// In auth.ts -- use databaseHooks or hooks.after
// Option A: databaseHooks.user.create.after (runs in auth context)
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        // NOTE: Known issue -- auth.api.createOrganization may fail
        // in after hook due to user not yet committed to DB in some
        // transaction modes. Use hooks.after instead if this happens.
      },
    },
  },
},

// Option B: hooks.after middleware (runs after transaction commits)
hooks: {
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path === "/sign-up/email") {
      const newSession = ctx.context.newSession;
      if (newSession) {
        // Create org and set active here
        // This runs after the user is committed to DB
      }
    }
  }),
},
```

**Client-side: Move org creation to a server action with cleanup:**

```typescript
// src/actions/signup.ts
"use server";
export async function atomicSignUp(data: SignUpFormData) {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    // Step 1: Create user via auth API
    const userResult = await auth.api.signUpEmail({ body: { ... } });
    userId = userResult.user.id;

    // Step 2: Create org via auth API
    const orgResult = await auth.api.createOrganization({
      body: { name: data.companyName, slug: slugify(data.companyName) + "-" + randomSuffix() },
      headers: await headers(),
    });
    orgId = orgResult.id;

    // Step 3: Set active org
    await auth.api.setActiveOrganization({
      body: { organizationId: orgId },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    // Cleanup: delete org if created, delete user if created
    if (orgId) {
      await db.delete(organization).where(eq(organization.id, orgId));
    }
    if (userId) {
      await db.delete(user).where(eq(user.id, userId));
    }
    throw error;
  }
}
```

**Important caveat:** Better Auth's `auth.api.signUpEmail` creates the user and account in one call but does NOT handle org creation. The server action approach with manual cleanup is the most reliable for this codebase because:
1. It does not depend on transaction support in the HTTP driver
2. It handles cleanup explicitly rather than relying on hook timing
3. It can return specific error messages to the client

### Sign-In Redirect Fix

```typescript
// sign-in-form.tsx line 73 -- change:
router.push("/");
// to:
router.push("/dashboard");
```

### Confirm Password Pattern

```typescript
// validators/auth.ts -- update signUpSchema:
export const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
```

### Specific Error Messages Pattern (AUTH-03v3)

Better Auth returns error objects from `signUp.email()` and `organization.create()`. The current code shows generic messages. Map specific errors:

```typescript
// sign-up-form.tsx error handling:
if (signUpResult.error) {
  const msg = signUpResult.error.message ?? "";
  if (msg.includes("already") || msg.includes("exists")) {
    setError("An account with this email already exists. Please sign in instead.");
  } else if (msg.includes("password")) {
    setError("Password must be at least 8 characters.");
  } else {
    setError(msg || "Failed to create account");
  }
  return;
}

// For org creation errors:
if (orgResult.error) {
  const msg = orgResult.error.message ?? "";
  if (msg.includes("slug") || msg.includes("taken")) {
    setError("This company name is already taken. Please choose a different name.");
  } else {
    setError(msg || "Failed to create company");
  }
  return;
}
```

**Note:** Better Auth may return generic success for duplicate emails when `requireEmailVerification` is enabled (to prevent user enumeration). Since email verification is NOT currently enabled (it is deferred to Phase 18 / AUTH-01v3), specific error messages for email-in-use WILL work in this phase.

### Billing Params Fix (BILL-02v3)

The current `buildCheckoutSessionParams` returns `{ params: { line_items: [...] } }` for post-trial checkout. Examining the `@better-auth/stripe` plugin source (v1.5.5, `index.mjs` lines 948-1001), the plugin:

1. Calls `getCheckoutSessionParams()` and stores result in variable `params`
2. Accesses `params?.params` and spreads it into the Stripe session create call
3. Accesses `params?.options` for the Stripe options argument

So the return format `{ params: { ... }, options: { ... } }` is correct per the plugin API. The current code's `{ params: { line_items: [...] } }` is structurally valid.

**The actual bug:** When `line_items` is provided in `params.params`, it completely replaces the plugin's default `line_items` array. But the plugin's default array includes seat-based line items and plan items. By overriding `line_items`, the setup fee case may lose the subscription metadata or seat items that the plugin normally includes.

**Fix approach:** Instead of overriding `line_items` entirely, verify whether the current return format actually works at runtime by testing against Stripe's API. If the override causes Stripe to reject the session (e.g., missing recurring price in subscription mode), adjust to use the plugin's built-in `plan.lineItems` property instead.

If the double-nesting was a historical bug that was already fixed, the task should verify correct runtime behavior and add a test that actually mocks the Stripe API call chain.

### Anti-Patterns to Avoid

- **Using `drizzle-kit push` in production:** Applies changes without SQL review. Cannot review for DROP statements. Never use for rename operations.
- **Renaming a table in the Drizzle schema without a custom migration:** Drizzle interprets as drop + create, destroying all data.
- **Adding non-nullable columns without defaults to existing tables:** Fails on INSERT for existing application code that does not provide the new column.
- **Deploying industry-aware query code before the backfill migration runs:** Existing orgs without `industry` field would be filtered out of all results.
- **Adding side-effect imports to db/index.ts or auth.ts:** Past production incident -- these files are hot-loaded across many routes.
- **Running `CREATE EXTENSION postgis` in a Drizzle migration file:** While valid, if the migration fails (e.g., extension already exists without IF NOT EXISTS), it blocks all subsequent migrations. Use `CREATE EXTENSION IF NOT EXISTS postgis` in a separate first migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table rename in migration | Hand-edit generated SQL after the fact | `drizzle-kit generate --custom` then write `ALTER TABLE RENAME` | Custom migration files are tracked by drizzle-kit and won't be regenerated |
| Industry field on org table | Direct SQL ALTER TABLE on Better Auth's table | `additionalFields` in organization plugin config | Plugin knows about the field, includes it in API responses and CRUD |
| Confirm password validation | Custom comparison logic | Zod `.refine()` on the schema object | Already used in `resetPasswordSchema`, consistent pattern |
| PostGIS geometry serialization | Custom WKT/WKB encoding | Drizzle's built-in `geometry()` column type with `mode: "xy"` | Handles serialization/deserialization automatically since drizzle-orm v0.31 |
| Spatial distance queries | Haversine formula in JavaScript | PostGIS `ST_DWithin()` with GiST index | Orders of magnitude faster at scale, handles edge cases (antimeridian, poles) |
| Content hash for dedup | Custom hashing utility | Node.js built-in `crypto.createHash("sha256")` | Zero dependencies, standard, fast |

## Common Pitfalls

### Pitfall 1: Drizzle Generates DROP TABLE Instead of RENAME
**What goes wrong:** Changing the table name in the Drizzle schema from `company_profiles` to `organization_profiles` causes drizzle-kit to generate a DROP TABLE + CREATE TABLE migration, destroying all existing profile data.
**Why it happens:** Drizzle's diff engine compares schema snapshots and cannot distinguish "renamed table" from "deleted old + created new."
**How to avoid:** Write a custom migration with `ALTER TABLE "company_profiles" RENAME TO "organization_profiles"`. Update the Drizzle schema to reference the new table name. The custom migration file is tracked by drizzle-kit's migration journal.
**Warning signs:** Any generated `.sql` file containing `DROP TABLE "company_profiles"` or `DROP TABLE company_profiles`.

### Pitfall 2: Industry-Aware Queries Before Backfill
**What goes wrong:** If any query filters by `organization.industry = 'heavy_equipment'` and the backfill has not run, existing orgs have NULL industry and are excluded from results.
**Why it happens:** Deploy-then-migrate ordering, or migration failure leaving production with new code but old data.
**How to avoid:** Set `defaultValue: "heavy_equipment"` on the column AND run a backfill UPDATE in the same migration: `UPDATE organization SET industry = 'heavy_equipment' WHERE industry IS NULL`.
**Warning signs:** Existing users report seeing zero leads or empty dashboards after deploy.

### Pitfall 3: PostGIS Extension Not Created Before Geometry Migration
**What goes wrong:** The migration that adds `geometry(Point, 4326)` column fails with "type geometry does not exist."
**Why it happens:** PostGIS is a PostgreSQL extension that must be explicitly enabled. Drizzle does not auto-create extensions.
**How to avoid:** Run `CREATE EXTENSION IF NOT EXISTS postgis` as the first migration in this phase, before any migration that references geometry types.
**Warning signs:** Migration 6 (geometry column) fails; all subsequent migrations are also blocked.

### Pitfall 4: Better Auth additionalFields Not Reflected in DB
**What goes wrong:** Adding `additionalFields` to the organization plugin config does not automatically create the column in the database.
**Why it happens:** Better Auth's config tells the plugin about the field at the application layer, but the actual `ALTER TABLE ADD COLUMN` must be done via migration.
**How to avoid:** After configuring `additionalFields`, generate a migration that adds the corresponding column, or run `npx @better-auth/cli generate` to see what columns are expected, then add them via Drizzle migration.
**Warning signs:** Better Auth throws "column industry does not exist" errors on org creation after deploy.

### Pitfall 5: Orphaned Users on Partial Sign-Up Failure
**What goes wrong:** User is created (step 1) but org creation fails (step 2), leaving a user with no org. On next sign-in, the user has no active org, causing redirect to onboarding, which expects an org to exist.
**Why it happens:** Client-side sign-up is 3 separate API calls with no transactional guarantee.
**How to avoid:** Move to server-side atomic sign-up with explicit cleanup. If org creation fails, delete the created user. If setActive fails, delete both org and user.
**Warning signs:** Users reporting "stuck in redirect loop" or "Unable to load your organization" after failed sign-up.

### Pitfall 6: Geometry Column Mode Confusion (x=lng, y=lat)
**What goes wrong:** Inserting `{ x: lat, y: lng }` instead of `{ x: lng, y: lat }` puts all points in the wrong hemisphere.
**Why it happens:** Geographic convention is (lat, lng) but PostGIS/GeoJSON convention is (lng, lat) mapped to (x, y).
**How to avoid:** Always use `{ x: longitude, y: latitude }` for the `xy` mode. Add a comment at every insert site. Consider writing a helper function: `function toPoint(lat: number, lng: number) { return { x: lng, y: lat }; }`.
**Warning signs:** Distance calculations returning wildly wrong values; points appearing on the map in the ocean.

### Pitfall 7: Schema Index File Not Updated After Adding New Tables
**What goes wrong:** New tables (`lead_enrichments`, `scraper_runs`) are defined in their own schema files but not exported from `src/lib/db/schema/index.ts`. Drizzle ORM cannot see them; `db.query.leadEnrichments` is undefined.
**Why it happens:** Forgetting to add the re-export line.
**How to avoid:** For every new schema file, add `export * from "./new-file"` to `schema/index.ts`. Verify with TypeScript type checking.
**Warning signs:** `Property 'leadEnrichments' does not exist on type` TypeScript errors.

## Code Examples

### Custom Migration: Table Rename

```sql
-- Source: Drizzle Kit Custom Migrations docs
-- https://orm.drizzle.team/docs/kit-custom-migrations

-- Migration: rename company_profiles to organization_profiles
ALTER TABLE "company_profiles" RENAME TO "organization_profiles";
```

### Custom Migration: PostGIS Extension

```sql
-- Must run before any geometry column migration
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Custom Migration: Industry Backfill

```sql
-- Add industry column and backfill existing orgs
ALTER TABLE "organization" ADD COLUMN "industry" TEXT DEFAULT 'heavy_equipment';
UPDATE "organization" SET "industry" = 'heavy_equipment' WHERE "industry" IS NULL;
```

### Drizzle Config for Production Migrations

```typescript
// drizzle.config.ts -- updated for generate+migrate workflow
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/*",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,   // Prompt confirmation on drizzle-kit push
  verbose: true,   // Print all SQL during generate
});
```

**Note:** `strict: true` only affects `drizzle-kit push` (requires confirmation). It does NOT prevent destructive operations in `drizzle-kit generate`. The generate workflow's safety comes from manual SQL review.

### Geometry Column with Backfill

```typescript
// After adding the geometry column, backfill from existing lat/lng:
// In a custom migration or a seeding script:
// UPDATE leads SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
//   WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL;
```

### Updated Schema Index

```typescript
// src/lib/db/schema/index.ts -- after all changes
export * from "./auth";
export * from "./organization-profiles";  // renamed from company-profiles
export * from "./leads";
export * from "./lead-sources";
export * from "./lead-statuses";
export * from "./bookmarks";
export * from "./saved-searches";
export * from "./subscriptions";
export * from "./pipeline-runs";
export * from "./lead-enrichments";   // new
export * from "./scraper-runs";       // new
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit push` for all changes | `drizzle-kit generate` + review + `drizzle-kit migrate` | Always recommended for production | Prevents silent data loss from unreviewed DROP statements |
| Manual PostGIS WKT strings | `geometry()` column type with mode `"xy"` | drizzle-orm v0.31 (2024) | Native insert/select support, no custom types needed |
| Client-side multi-step sign-up | Server action with cleanup on failure | Better Auth v1.3+ hooks | Prevents orphaned users, enables specific error messages |
| `companyProfiles` table name | `organizationProfiles` | This phase | Aligns naming with multi-industry concept (organizations, not just companies) |

## Open Questions

1. **Neon HTTP Driver + PostGIS Binary Types**
   - What we know: Neon supports PostGIS natively. The HTTP driver works for standard types. Drizzle's `geometry()` type handles serialization.
   - What's unclear: Whether the neon-http driver correctly handles PostGIS geometry binary encoding over HTTP, or whether text-mode WKT is used internally.
   - Recommendation: Test with a simple insert + select of a geometry point on the actual Neon project BEFORE writing the migration. If it fails, switch to the neon-ws (WebSocket) driver for geometry operations only.

2. **Better Auth additionalFields + Drizzle Schema Sync**
   - What we know: `additionalFields` tells Better Auth about extra columns. The DB column must exist separately.
   - What's unclear: Whether Drizzle's schema definition for the `organization` table in `auth.ts` needs to include the `industry` column, or if Better Auth handles it transparently.
   - Recommendation: Add the `industry` column to both the Drizzle `organization` pgTable definition AND the Better Auth `additionalFields` config, then generate a migration. If Drizzle generates a conflicting migration, use a custom migration instead.

3. **buildCheckoutSessionParams Runtime Behavior**
   - What we know: The return format `{ params: { line_items: [...] } }` matches the plugin's expected structure at the code level. The plugin spreads `params.params` into the Stripe API call.
   - What's unclear: Whether the line_items override actually works at Stripe's API level for subscription-mode checkouts, or whether it causes a "received unknown parameter" error.
   - Recommendation: Write a test that verifies the full chain: `buildCheckoutSessionParams` return -> plugin spread -> Stripe API call structure. If it works, document it. If it does not, adjust to use `plan.lineItems` in the auth config instead.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHM-01 | Organization has industry field, backfilled as heavy_equipment | unit | `npx vitest run tests/schema/organization-industry.test.ts -x` | Wave 0 |
| SCHM-02 | Organization profiles renamed with new columns | unit | `npx vitest run tests/schema/organization-profiles.test.ts -x` | Wave 0 |
| SCHM-03 | Leads have content hash, industries, value tier, severity, deadline | unit | `npx vitest run tests/schema/leads-expansion.test.ts -x` | Wave 0 |
| SCHM-04 | Lead enrichments table exists and has correct FK | unit | `npx vitest run tests/schema/lead-enrichments.test.ts -x` | Wave 0 |
| SCHM-05 | Bookmarks have notes and pipeline status columns | unit | `npx vitest run tests/schema/bookmarks-expansion.test.ts -x` | Wave 0 |
| SCHM-06 | Scraper runs tracked per-adapter | unit | `npx vitest run tests/schema/scraper-runs.test.ts -x` | Wave 0 |
| SCHM-07 | PostGIS geometry column on leads | unit | `npx vitest run tests/schema/postgis-geometry.test.ts -x` | Wave 0 |
| AUTH-02v3 | Atomic sign-up with cleanup on failure | unit | `npx vitest run tests/auth/atomic-signup.test.ts -x` | Wave 0 |
| AUTH-03v3 | Specific error messages on sign-up | unit | `npx vitest run tests/auth/signup-error-messages.test.tsx -x` | Wave 0 |
| AUTH-04v3 | Sign-in redirects to /dashboard | unit | `npx vitest run tests/regressions/sign-in-redirect.test.tsx -x` | Exists (update needed) |
| AUTH-05v3 | Confirm password field on sign-up | unit | `npx vitest run tests/auth/confirm-password.test.tsx -x` | Wave 0 |
| BILL-02v3 | Checkout params not double-nested | unit | `npx vitest run tests/billing/checkout-params.test.ts -x` | Exists (update needed) |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/schema/organization-industry.test.ts` -- covers SCHM-01
- [ ] `tests/schema/organization-profiles.test.ts` -- covers SCHM-02
- [ ] `tests/schema/leads-expansion.test.ts` -- covers SCHM-03
- [ ] `tests/schema/lead-enrichments.test.ts` -- covers SCHM-04
- [ ] `tests/schema/bookmarks-expansion.test.ts` -- covers SCHM-05
- [ ] `tests/schema/scraper-runs.test.ts` -- covers SCHM-06
- [ ] `tests/schema/postgis-geometry.test.ts` -- covers SCHM-07
- [ ] `tests/auth/atomic-signup.test.ts` -- covers AUTH-02v3
- [ ] `tests/auth/signup-error-messages.test.tsx` -- covers AUTH-03v3
- [ ] `tests/auth/confirm-password.test.tsx` -- covers AUTH-05v3
- [ ] Update `tests/regressions/sign-in-redirect.test.tsx` -- verify /dashboard redirect
- [ ] Update `tests/billing/checkout-params.test.ts` -- verify correct params structure

## Sources

### Primary (HIGH confidence)

- [Drizzle ORM PostGIS Geometry Point Guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point) -- column definition, insert, select, spatial queries, GiST index
- [Drizzle ORM Custom Migrations](https://orm.drizzle.team/docs/kit-custom-migrations) -- `--custom` flag for empty migration files, manual SQL workflow
- [Drizzle ORM drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) -- strict/verbose options, migration table config
- [Drizzle ORM Migrations Overview](https://orm.drizzle.team/docs/migrations) -- generate vs push vs migrate workflow
- [Better Auth Organization Plugin](https://better-auth.com/docs/plugins/organization) -- additionalFields, hooks, schema config, org creation API
- [Better Auth Database Concepts](https://better-auth.com/docs/concepts/database) -- additionalFields on core tables, migration commands
- [Better Auth Hooks](https://better-auth.com/docs/concepts/hooks) -- before/after middleware, databaseHooks, APIError
- [Better Auth Email & Password](https://better-auth.com/docs/authentication/email-password) -- error handling, password config, email verification
- [Better Auth Stripe Plugin](https://better-auth.com/docs/plugins/stripe) -- getCheckoutSessionParams API, return format
- [Neon PostGIS Extension Docs](https://neon.com/docs/extensions/postgis) -- extension setup, compatibility confirmation
- `@better-auth/stripe` plugin source (v1.5.5, node_modules) -- verified `params?.params` spread pattern at line 995

### Secondary (MEDIUM confidence)

- [Better Auth GitHub Issue #4718](https://github.com/better-auth/better-auth/issues/4718) -- createOrganization in after hook returns null
- [Better Auth GitHub Issue #2010](https://github.com/better-auth/better-auth/issues/2010) -- create organization on user sign-up patterns
- [Better Auth GitHub Issue #7260](https://github.com/better-auth/better-auth/issues/7260) -- foreign key constraint in databaseHooks with transactions

### Tertiary (LOW confidence)

- Better Auth `databaseHooks.user.create.after` transaction behavior -- multiple GitHub issues report varying behavior depending on DB driver and transaction mode. Needs testing with Neon HTTP driver specifically.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies, PostGIS support verified in Drizzle and Neon docs
- Architecture: HIGH -- migration workflow verified against Drizzle docs, Better Auth additionalFields verified against official docs, PostGIS patterns verified against official guide
- Pitfalls: HIGH -- 7 pitfalls identified, all verified against codebase inspection and official documentation. Past production incidents confirm risk categories.
- Auth hardening: MEDIUM -- Better Auth hook transaction behavior with Neon HTTP driver needs runtime verification. Server action with cleanup is the safest fallback.
- Billing fix: MEDIUM -- Plugin source confirms `params.params` spread pattern, but runtime behavior with Stripe API needs verification.

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- Drizzle, Better Auth, and PostGIS are mature technologies)
