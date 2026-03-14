# Phase 1: Platform Foundation - Research

**Researched:** 2026-03-13
**Domain:** Authentication, Multi-Tenancy, Onboarding, Next.js SaaS Foundation
**Confidence:** HIGH

## Summary

This phase establishes the entire application foundation for HeavyLeads -- a greenfield Next.js SaaS application for heavy machinery lead intelligence. The core deliverables are: user authentication with session persistence, multi-tenant company accounts with data isolation, a company onboarding wizard (HQ location, equipment types, service radius), and account/company profile management.

The recommended stack is **Next.js 16** (current stable, released October 2025) with the **App Router**, **Better Auth** for authentication and organization management, **Drizzle ORM** with **PostgreSQL** (Neon serverless), **shadcn/ui** for the component library, and **React Hook Form + Zod** for form handling. This stack is the fastest path to a production-quality SaaS foundation because Better Auth's organization plugin provides built-in multi-tenancy with roles, invitations, and session-scoped tenant context -- eliminating weeks of custom multi-tenant infrastructure.

**Primary recommendation:** Use Better Auth with its organization plugin for auth + multi-tenancy in one solution, Drizzle ORM for type-safe database access, and Neon PostgreSQL for serverless hosting. This combination provides the most integrated, fastest-to-ship approach for the requirements.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- all implementation decisions are at Claude's discretion per user request for "most efficient approach with no consultation."

### Claude's Discretion
- **Auth**: Use the most practical managed or self-hosted auth solution for a Next.js SaaS app -- prioritize speed to implement, session persistence, and future extensibility (OAuth, magic links can be added later)
- **Multi-tenancy**: Row-level data isolation via tenant ID on all records -- simplest model that meets the "Company A cannot see Company B's data" requirement
- **Onboarding wizard**: Multi-step form (HQ location, equipment types, service radius) -- clean, minimal, functional
- **Equipment type selection**: Predefined list of common heavy machinery categories (excavators, boom lifts, forklifts, telehandlers, cranes, skid steers, etc.) with multi-select
- **Service radius**: Numeric input in miles from HQ location
- **HQ location**: Address input with geocoding to lat/lng for future radius queries
- **Roles**: Simple admin/member model -- company creator is admin, can invite others
- **User joining**: Invite-based (admin sends invite link or email) -- no open registration to companies
- **Account settings**: Users can edit name, email, password. Admins can edit company profile (name, HQ, equipment types, radius)
- **Tech stack**: Choose whatever is fastest to ship a production-quality SaaS foundation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-01 | User can sign up with email and password | Better Auth email/password auth built-in; server-side session creation via Server Actions |
| PLAT-02 | User session persists across browser refresh | Better Auth database sessions with auto-refreshing cookies via nextCookies plugin |
| PLAT-03 | Multi-tenant company accounts with data isolation between competing dealers | Better Auth organization plugin provides organizationId on sessions; all tenant data tables include organizationId column with application-level scoping |
| PLAT-04 | Company onboarding wizard: set HQ location, equipment types sold/rented, service radius | Multi-step form with React Hook Form + Zod; shadcn/ui components; geocoding via Google Maps Geocoding API or OpenCage |
| PLAT-06 | User can manage account settings and company profile | Better Auth profile update API; custom company profile table with admin-only edit permissions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x (latest stable) | Full-stack React framework | Current stable release (Oct 2025); App Router, Turbopack default, Server Components, Server Actions |
| React | 19.2.x | UI library | Ships with Next.js 16; View Transitions, useEffectEvent, Activity API |
| Better Auth | 1.5.x | Authentication + organization management | Built-in email/password, session management, organization plugin with roles/invitations/member management; Drizzle adapter; 50+ plugins for future extensibility |
| Drizzle ORM | 1.x | Type-safe database ORM | SQL-like syntax, full TypeScript support, migration kit, RLS support, native Neon/Supabase support |
| PostgreSQL (Neon) | 17 | Serverless PostgreSQL database | Free tier (0.5GB storage, 100 CU-hours/month), connection pooling, scale-to-zero, branching for dev/staging |
| TypeScript | 5.x | Type safety | Required by Next.js 16; enables end-to-end type safety with Drizzle |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest (CLI v4) | UI component library | All UI components -- copy-paste Radix primitives with Tailwind styling; Server Component compatible |
| Tailwind CSS | 4.x | Utility-first CSS | Ships with Next.js 16 create-next-app; all styling |
| React Hook Form | 7.x | Form state management | All forms (signup, login, onboarding wizard, settings) |
| Zod | 3.x | Schema validation | Shared client/server validation schemas; zodResolver for React Hook Form |
| @hookform/resolvers | latest | RHF + Zod bridge | Connect Zod schemas to React Hook Form |
| Lucide React | latest | Icons | Icon library used by shadcn/ui |
| drizzle-kit | latest | Migration CLI | Schema generation, migration management |
| @neondatabase/serverless | latest | Neon database driver | Serverless-optimized PostgreSQL connection for Neon |

### Geocoding (for HQ location)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Maps Geocoding API | v3 | Address-to-coordinates | Primary option: well-documented, reliable, free $200/month credit covers ~40k geocode requests |
| OpenCage Geocoding API | REST | Address-to-coordinates (alternative) | Budget alternative: 2,500 free requests/day for testing; $50/month for 10k/day production |

**Recommendation:** Use Google Maps Geocoding API for address input. The free $200/month credit is more than sufficient for an early SaaS product. Geocoding is a server-side operation (address -> lat/lng) called only during onboarding and profile updates, so volume will be minimal.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth | Auth.js v5 (NextAuth) | Auth.js is more mature but lacks built-in organization/multi-tenant support; would require building invitation, roles, and org management from scratch |
| Better Auth | Clerk | Excellent DX and pre-built components, but $0.02/MAU after 10k; vendor lock-in; cannot self-host; Better Auth is free/open-source |
| Better Auth | Supabase Auth | Good with Supabase ecosystem but couples you to Supabase platform; Better Auth is framework-agnostic |
| Drizzle ORM | Prisma | Prisma has larger ecosystem but heavier runtime, slower cold starts in serverless, less SQL control |
| Neon PostgreSQL | Supabase PostgreSQL | Supabase bundles more (auth, storage, realtime) but we chose Better Auth separately; Neon is simpler/focused |
| Neon PostgreSQL | Local PostgreSQL | Local PG needs manual hosting; Neon provides serverless with free tier suitable for MVP |

**Installation:**
```bash
# Create Next.js 16 project
npx create-next-app@latest heavyleads --typescript --tailwind --app

# Core dependencies
npm install better-auth drizzle-orm @neondatabase/serverless zod react-hook-form @hookform/resolvers

# Dev dependencies
npm install -D drizzle-kit

# shadcn/ui initialization
npx shadcn@latest init

# Add shadcn components as needed
npx shadcn@latest add button card input label form select dialog tabs toast separator badge checkbox
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/                    # Route group for auth pages (no layout chrome)
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   ├── sign-up/
│   │   │   └── page.tsx
│   │   └── layout.tsx             # Minimal auth layout
│   ├── (dashboard)/               # Route group for authenticated pages
│   │   ├── onboarding/
│   │   │   └── page.tsx           # Multi-step onboarding wizard
│   │   ├── settings/
│   │   │   ├── account/
│   │   │   │   └── page.tsx       # User account settings
│   │   │   └── company/
│   │   │       └── page.tsx       # Company profile (admin only)
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Main dashboard (placeholder for Phase 3)
│   │   └── layout.tsx             # Dashboard layout with nav, org context
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts       # Better Auth API handler
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Landing/redirect
├── components/
│   ├── ui/                        # shadcn/ui components (generated)
│   ├── auth/                      # Auth-specific components
│   │   ├── sign-in-form.tsx
│   │   └── sign-up-form.tsx
│   ├── onboarding/                # Onboarding wizard components
│   │   ├── wizard-shell.tsx       # Step navigation + progress
│   │   ├── step-location.tsx      # HQ address input
│   │   ├── step-equipment.tsx     # Equipment type multi-select
│   │   └── step-radius.tsx        # Service radius input
│   └── settings/                  # Settings page components
│       ├── account-form.tsx
│       └── company-form.tsx
├── lib/
│   ├── auth.ts                    # Better Auth server config
│   ├── auth-client.ts             # Better Auth client config
│   ├── db/
│   │   ├── index.ts               # Drizzle client instance
│   │   ├── schema/
│   │   │   ├── auth.ts            # Better Auth tables (users, sessions, accounts, etc.)
│   │   │   ├── organizations.ts   # Organization tables (from Better Auth org plugin)
│   │   │   └── company-profiles.ts # Custom company profile table (HQ, equipment, radius)
│   │   └── migrations/            # Drizzle migration files
│   ├── validators/                # Shared Zod schemas
│   │   ├── auth.ts                # Sign-in/sign-up validation
│   │   ├── onboarding.ts          # Onboarding wizard validation
│   │   └── settings.ts            # Settings form validation
│   └── utils.ts                   # Shared utilities
├── actions/                       # Server Actions
│   ├── onboarding.ts              # Complete onboarding, geocode address
│   └── settings.ts                # Update account/company settings
└── types/
    └── index.ts                   # Shared TypeScript types
```

### Pattern 1: Better Auth Organization-Based Multi-Tenancy
**What:** Use Better Auth's organization plugin to handle all multi-tenant concerns. Each "company" in HeavyLeads maps to a Better Auth "organization." The session stores `activeOrganizationId`, and all data queries are scoped by this ID.
**When to use:** Every database query that touches tenant-specific data.
**Example:**
```typescript
// Source: https://better-auth.com/docs/plugins/organization
// lib/auth.ts - Server configuration
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 50,
      schema: {
        organization: {
          modelName: "organization", // maps to "organization" table
        },
      },
    }),
    nextCookies(), // MUST be last plugin
  ],
});

// lib/auth-client.ts - Client configuration
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
```

### Pattern 2: Tenant-Scoped Data Access
**What:** All custom data tables include an `organizationId` column. A helper function wraps queries to automatically scope by the active organization from the session.
**When to use:** Any data access for company-specific records.
**Example:**
```typescript
// lib/db/schema/company-profiles.ts
import { pgTable, text, real, uuid, timestamp, varchar } from "drizzle-orm/pg-core";

export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().unique(), // FK to Better Auth org
  hqAddress: text("hq_address"),
  hqLat: real("hq_lat"),
  hqLng: real("hq_lng"),
  serviceRadiusMiles: real("service_radius_miles"),
  equipmentTypes: text("equipment_types").array(), // PostgreSQL text array
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// actions/onboarding.ts - Tenant-scoped server action
"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";

export async function completeOnboarding(data: OnboardingData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.session.activeOrganizationId) {
    throw new Error("No active organization");
  }

  const orgId = session.session.activeOrganizationId;

  // Geocode the address (server-side)
  const { lat, lng } = await geocodeAddress(data.hqAddress);

  await db.insert(companyProfiles).values({
    organizationId: orgId,
    hqAddress: data.hqAddress,
    hqLat: lat,
    hqLng: lng,
    serviceRadiusMiles: data.serviceRadius,
    equipmentTypes: data.equipmentTypes,
  });
}
```

### Pattern 3: Multi-Step Onboarding Wizard with React Hook Form + Zod
**What:** A client-side multi-step form using React Hook Form for state management across steps, Zod for validation, and shadcn/ui for components. Form state persists across steps without a global state manager.
**When to use:** The onboarding wizard (3 steps: location, equipment, radius).
**Example:**
```typescript
// lib/validators/onboarding.ts - Shared validation schema
import { z } from "zod";

export const onboardingSchema = z.object({
  hqAddress: z.string().min(5, "Please enter a valid address"),
  equipmentTypes: z.array(z.string()).min(1, "Select at least one equipment type"),
  serviceRadius: z.number().min(10, "Minimum 10 miles").max(500, "Maximum 500 miles"),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

export const EQUIPMENT_TYPES = [
  "Excavators",
  "Boom Lifts",
  "Forklifts",
  "Telehandlers",
  "Cranes",
  "Skid Steers",
  "Bulldozers",
  "Backhoes",
  "Wheel Loaders",
  "Compactors",
  "Aerial Work Platforms",
  "Generators",
] as const;

// components/onboarding/wizard-shell.tsx
"use client";
import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingFormData } from "@/lib/validators/onboarding";

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      hqAddress: "",
      equipmentTypes: [],
      serviceRadius: 50,
    },
  });

  const steps = [StepLocation, StepEquipment, StepRadius];
  const CurrentStep = steps[step];

  async function onSubmit(data: OnboardingFormData) {
    // Call server action
    await completeOnboarding(data);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <CurrentStep />
        {/* Step navigation buttons */}
      </form>
    </FormProvider>
  );
}
```

### Pattern 4: Route Protection via Server Component Validation
**What:** Validate auth session at the top of each protected page's Server Component. Redirect unauthenticated users. Check org membership for tenant-scoped pages.
**When to use:** All pages under the `(dashboard)` route group.
**Example:**
```typescript
// Source: https://better-auth.com/docs/integrations/next
// app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // If no active org and not on onboarding page, redirect to onboarding
  if (!session.session.activeOrganizationId) {
    redirect("/onboarding");
  }

  return (
    <div>
      <nav>{/* Dashboard navigation */}</nav>
      <main>{children}</main>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side-only auth checks:** Never rely solely on client-side session checks. Always validate on the server (Server Components, Server Actions) before returning data or rendering protected content.
- **Missing tenant scoping on queries:** Every query touching tenant data MUST include `WHERE organization_id = ?`. Never trust client-provided org IDs -- always pull from the authenticated session.
- **Storing sensitive config in client components:** API keys (geocoding, etc.) must only be used in Server Actions or Route Handlers, never in client components.
- **Single massive Zod schema for the wizard:** Split validation per step so users get feedback as they complete each step, not only at final submission.
- **Using middleware.ts for auth:** In Next.js 16, `middleware.ts` is deprecated in favor of `proxy.ts`. However, for auth protection, prefer per-page Server Component validation over proxy/middleware, as Better Auth recommends -- proxy only checks cookie presence, not validity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication | Custom JWT/session system | Better Auth emailAndPassword | Session management, CSRF protection, cookie handling, password hashing are all error-prone; Better Auth handles all securely |
| Organization/tenant management | Custom org tables, invite system, role checks | Better Auth organization plugin | Invitation lifecycle, role hierarchy, member management, session-scoped org context -- all built-in |
| Form validation | Custom validation logic | Zod schemas + React Hook Form | Type inference, shared client/server schemas, composable validation rules |
| UI components | Custom buttons, inputs, dialogs | shadcn/ui | Accessible, themeable, copy-paste components built on Radix primitives |
| Database migrations | Raw SQL migration files | drizzle-kit | Declarative schema diffing, auto-generated migrations, push for rapid dev |
| Geocoding | Custom address parsing | Google Maps Geocoding API | Address normalization, fuzzy matching, worldwide coverage -- impossible to replicate |
| Password security | Custom bcrypt/argon2 integration | Better Auth built-in | Handles hashing algorithm selection, timing-safe comparison, upgrade paths |

**Key insight:** Better Auth's organization plugin eliminates the single largest custom-code surface in this phase. Without it, you'd need to build: organization CRUD, invitation system with email + link flow, role-based access control, member management, session-scoped tenant context, and org-switching -- easily 2-3 weeks of work that Better Auth provides out of the box.

## Common Pitfalls

### Pitfall 1: Forgetting nextCookies Plugin Order
**What goes wrong:** Better Auth cookies don't get set properly in Server Actions, causing session loss after sign-in via Server Actions.
**Why it happens:** The `nextCookies()` plugin must be the LAST plugin in the plugins array. If it's not last, cookie headers may not be properly set.
**How to avoid:** Always add `nextCookies()` as the final plugin in the `betterAuth()` configuration.
**Warning signs:** User signs in successfully but gets redirected back to sign-in page; session is null in Server Components after sign-in.

### Pitfall 2: Not Scoping Data by Organization
**What goes wrong:** Data from Company A leaks to Company B, violating tenant isolation.
**Why it happens:** Developer forgets to include `organizationId` filter in a query, or trusts a client-provided org ID instead of pulling from the session.
**How to avoid:** Create a helper function like `getOrgScopedDb()` that always reads `activeOrganizationId` from the session and includes it in queries. Never accept org ID from client input.
**Warning signs:** Users seeing data they shouldn't; no consistent pattern for how queries are scoped.

### Pitfall 3: Missing Onboarding Flow Guard
**What goes wrong:** Users who sign up but haven't completed onboarding can access the dashboard with incomplete profile data, causing null reference errors.
**Why it happens:** No check for whether the company profile (HQ, equipment, radius) has been set up.
**How to avoid:** In the dashboard layout, check if the active organization has a completed company profile. If not, redirect to `/onboarding`. Store an `onboardingCompleted` boolean on the organization metadata or company profile.
**Warning signs:** Null/undefined errors in dashboard components; users seeing empty states that should never appear.

### Pitfall 4: Geocoding on the Client Side
**What goes wrong:** API key exposed in browser, geocoding fails due to CORS or referrer restrictions.
**Why it happens:** Developer calls Google Maps API directly from a client component.
**How to avoid:** Always geocode in a Server Action or API route. The API key stays server-side. Return only the lat/lng to the client if needed for map display.
**Warning signs:** Geocoding API key visible in browser network tab; CORS errors in console.

### Pitfall 5: Not Handling Better Auth Migration Correctly
**What goes wrong:** Schema mismatches between Better Auth's expected tables and Drizzle schema definitions.
**Why it happens:** Better Auth has its own schema expectations (users, sessions, accounts, verifications tables). If you generate the schema with `npx auth generate` but then modify it incompatibly, migrations break.
**How to avoid:** Run `npx auth generate` first to create the base schema. Then add your custom tables (company_profiles, etc.) separately. Don't rename Better Auth columns unless you also configure the field mapping in the auth config.
**Warning signs:** Runtime errors about missing columns; migration conflicts.

### Pitfall 6: Async APIs in Next.js 16
**What goes wrong:** Build errors or runtime errors from synchronous access to `headers()`, `cookies()`, `params`, or `searchParams`.
**Why it happens:** Next.js 16 enforces async access to these APIs (breaking change from Next.js 15). All must be `await`ed.
**How to avoid:** Always use `await headers()`, `await cookies()`, `await params`, `await searchParams`. This applies in Server Components, Server Actions, and Route Handlers.
**Warning signs:** TypeScript errors about Promise types; runtime errors about "cannot read property of undefined."

## Code Examples

### Better Auth + Drizzle Complete Setup
```typescript
// Source: https://better-auth.com/docs/adapters/drizzle
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/*",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### Server Action with Tenant Scoping
```typescript
// src/actions/settings.ts
"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { settingsSchema } from "@/lib/validators/settings";

export async function updateCompanyProfile(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  // Check admin role
  const member = await auth.api.getActiveMember({
    headers: await headers(),
  });
  if (member?.role !== "owner" && member?.role !== "admin") {
    throw new Error("Only admins can update company profile");
  }

  const orgId = session.session.activeOrganizationId;
  const validated = settingsSchema.parse(Object.fromEntries(formData));

  await db
    .update(companyProfiles)
    .set({
      hqAddress: validated.hqAddress,
      serviceRadiusMiles: validated.serviceRadius,
      equipmentTypes: validated.equipmentTypes,
      updatedAt: new Date(),
    })
    .where(eq(companyProfiles.organizationId, orgId));

  revalidatePath("/settings/company");
}
```

### Geocoding Server Action
```typescript
// src/actions/onboarding.ts (geocoding portion)
"use server";

interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Geocoding API key not configured");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== "OK" || !data.results.length) {
    throw new Error("Unable to geocode address");
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15 with middleware.ts | Next.js 16 with proxy.ts | Oct 2025 (Next.js 16 release) | middleware.ts deprecated; proxy.ts runs on Node.js runtime, clearer naming |
| NextAuth.js v4 (Pages Router) | Better Auth 1.5 or Auth.js v5 | 2025-2026 | Better Auth offers built-in organization/tenant support; Auth.js v5 rewrote for App Router |
| Prisma as default ORM | Drizzle ORM gaining dominance | 2024-2025 | Drizzle is lighter, faster cold starts, SQL-like syntax, better serverless support |
| Webpack bundler | Turbopack (default in Next.js 16) | Oct 2025 | 2-5x faster builds, 10x faster Fast Refresh; no config needed |
| Sync headers()/cookies() | Async headers()/cookies() | Next.js 15+ (enforced in 16) | Must await all Next.js request APIs; breaking change |
| experimental.ppr | cacheComponents | Next.js 16 | PPR flag removed; new Cache Components model with "use cache" directive |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16 in favor of `proxy.ts` (still works but will be removed)
- `next lint` CLI command: Removed in Next.js 16; use ESLint or Biome directly
- `serverRuntimeConfig` / `publicRuntimeConfig`: Removed; use `.env` files
- `experimental.turbopack`: Moved to top-level `turbopack` config key
- Synchronous `params`, `searchParams`, `headers()`, `cookies()`: All must be awaited in Next.js 16

## Open Questions

1. **Geocoding provider final selection**
   - What we know: Google Maps Geocoding API has $200/month free credit (~40k requests). OpenCage offers 2,500/day free for testing. Both work server-side.
   - What's unclear: Whether the project wants to minimize third-party API dependencies or prioritize reliability.
   - Recommendation: Start with Google Maps Geocoding API. Volume will be tiny (only during onboarding and profile updates). Switch to OpenCage later if cost becomes a concern.

2. **Email delivery for invitations**
   - What we know: Better Auth organization plugin supports invitation emails but requires configuring a `sendInvitationEmail` callback.
   - What's unclear: Which email service to use (Resend, SendGrid, AWS SES).
   - Recommendation: Use Resend (generous free tier, excellent DX, simple API). Not a Phase 1 blocker -- invitations can work via link-sharing initially; email sending can be added as an enhancement.

3. **Neon vs local PostgreSQL for development**
   - What we know: Neon has a free tier suitable for MVP. Drizzle supports both Neon serverless driver and standard pg driver.
   - What's unclear: Whether to use Neon for both dev and prod or local PG for dev.
   - Recommendation: Use Neon for everything. The free tier is sufficient, and it eliminates "works on my machine" issues. Neon's branching feature allows dev/staging branches from production data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (recommended for Next.js 16 + TypeScript) |
| Config file | `vitest.config.ts` -- needs Wave 0 creation |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | User can sign up with email and password | integration | `npx vitest run tests/auth/signup.test.ts -t "signup"` | No -- Wave 0 |
| PLAT-01 | User can sign in with email and password | integration | `npx vitest run tests/auth/signin.test.ts -t "signin"` | No -- Wave 0 |
| PLAT-02 | Session persists across refresh | integration | `npx vitest run tests/auth/session.test.ts -t "session persistence"` | No -- Wave 0 |
| PLAT-03 | Tenant data isolation | unit | `npx vitest run tests/db/tenant-isolation.test.ts -t "isolation"` | No -- Wave 0 |
| PLAT-04 | Onboarding wizard validates inputs | unit | `npx vitest run tests/onboarding/validation.test.ts -t "onboarding"` | No -- Wave 0 |
| PLAT-04 | Geocoding returns lat/lng for valid address | unit | `npx vitest run tests/onboarding/geocoding.test.ts -t "geocode"` | No -- Wave 0 |
| PLAT-06 | Account settings update | integration | `npx vitest run tests/settings/account.test.ts -t "account"` | No -- Wave 0 |
| PLAT-06 | Company profile update (admin only) | integration | `npx vitest run tests/settings/company.test.ts -t "company profile"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration with Next.js paths and TypeScript support
- [ ] `tests/setup.ts` -- Test setup file (mock environment variables, db helpers)
- [ ] `tests/helpers/auth.ts` -- Helper to create authenticated test sessions
- [ ] `tests/helpers/db.ts` -- Helper to create/tear down test data with tenant scoping
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom`
- [ ] All test files listed above need creation

## Sources

### Primary (HIGH confidence)
- [Better Auth official docs](https://better-auth.com/) - Authentication setup, organization plugin, Drizzle adapter, Next.js integration
- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization) - Multi-tenant roles, invitations, member management, session-scoped org context
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) - Schema generation, migration workflow, field customization
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) - Route handler, Server Component session access, nextCookies plugin, proxy.ts protection
- [Drizzle ORM RLS docs](https://orm.drizzle.team/docs/rls) - Row-Level Security policy definition, pgPolicy, role management
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) - Breaking changes, new features, migration from Next.js 15
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) - Official auth patterns for App Router
- [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview) - Address-to-coordinates conversion

### Secondary (MEDIUM confidence)
- [shadcn/ui installation for Next.js](https://ui.shadcn.com/docs/installation/next) - Verified compatible with Next.js 16 and React 19
- [shadcn/ui CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) - Latest scaffolding features
- [Neon PostgreSQL pricing](https://neon.com/pricing) - Free tier details (0.5GB, 100 CU-hours/month)
- [Drizzle + Neon setup](https://orm.drizzle.team/docs/connect-neon) - Connection driver configuration
- [OpenCage Geocoding pricing](https://opencagedata.com/pricing) - Alternative geocoding API pricing

### Tertiary (LOW confidence)
- Multi-step form patterns with shadcn/ui and React Hook Form -- sourced from community articles and GitHub discussions; patterns are well-established but no single canonical source
- Better Auth version 1.5.5 as latest -- based on npm registry search; verify at install time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified against official documentation and current releases
- Architecture: HIGH - Patterns derived from official Better Auth docs, Next.js 16 docs, and Drizzle docs
- Pitfalls: HIGH - Documented in official migration guides and community reports; Next.js 16 breaking changes well-documented
- Multi-tenancy approach: HIGH - Better Auth organization plugin is purpose-built for this exact use case

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days -- stable ecosystem, no imminent major releases expected)
