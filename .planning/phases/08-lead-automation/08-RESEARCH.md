# Phase 8: Lead Automation - Research

**Researched:** 2026-03-15
**Domain:** Vercel Cron Jobs, API route security, rate limiting, pipeline automation, empty state UX
**Confidence:** HIGH

## Summary

Phase 8 replaces the dead `node-cron` scheduler with Vercel Cron Jobs, adds a first-login pipeline trigger, implements on-demand "Refresh Leads" with rate limiting, secures all scraper API routes, and provides an informative empty-state dashboard. The existing scraping pipeline (`runPipeline()`) and adapter infrastructure are fully built and tested -- this phase is about triggering that pipeline correctly and presenting feedback to users.

The key technical challenge is the Vercel Cron model: cron jobs invoke a **GET** request to an API route on the production deployment. The existing `/api/scraper/run` route is a POST handler with no authentication. This must be converted to a GET handler for cron invocation, secured with `CRON_SECRET` verification, and a separate user-triggered endpoint must be added with session auth and rate limiting.

**Primary recommendation:** Create a new `/api/cron/scrape` GET route for Vercel Cron (CRON_SECRET auth), repurpose the existing `/api/scraper/run` POST route for user-triggered runs (session auth + DB-based rate limiting), add a `pipeline_runs` table for tracking run history and rate limit state, and fire the pipeline from the onboarding completion action via an internal fetch call.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | Vercel Cron runs scraping pipeline daily (replace dead node-cron) | Vercel Cron configuration in vercel.json, GET route handler with CRON_SECRET auth, maxDuration configuration for long-running pipeline |
| AUTO-02 | First-login trigger fires pipeline after onboarding so new users see leads immediately | Fire-and-forget fetch to /api/scraper/run from completeOnboarding action or post-onboarding redirect, track via pipeline_runs table |
| AUTO-03 | Dashboard shows progress indicator while pipeline runs | pipeline_runs table with status column (pending/running/completed/failed), polling or query from dashboard page component |
| AUTO-04 | On-demand "Refresh Leads" button in dashboard (rate-limited 1/hour per org) | DB-based rate limiting using pipeline_runs table, check last run timestamp for org, session-authenticated POST route |
| AUTO-05 | Scraper API route is secured with auth (CRON_SECRET for cron, session for user-triggered) | Two separate routes: GET /api/cron/scrape (CRON_SECRET Bearer auth), POST /api/scraper/run (Better Auth session verification) |
| PLSH-02 | Empty dashboard state with informative messaging (not blank page) | Replace current "No leads found" card with context-aware empty state distinguishing "pipeline running" from "no leads yet" from "filtered out" |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel Cron Jobs | N/A (platform feature) | Daily scheduled pipeline execution | Replaces node-cron, serverless-native, zero infra management |
| Next.js Route Handlers | 16.1.6 (current) | API endpoints for cron + user triggers | Already in use, GET for cron, POST for user triggers |
| Better Auth | 1.5.5 (current) | Session auth for user-triggered routes | Already in use for all auth flows |
| Drizzle ORM | 0.45.1 (current) | pipeline_runs table, rate limit queries | Already in use for all DB access |
| Neon PostgreSQL | Current | Rate limit state, pipeline run tracking | Already in use, no additional infra needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 (current) | RefreshCw icon for Refresh Leads button | Button icon |
| sonner | 2.0.7 (current) | Toast notifications for pipeline trigger feedback | User feedback on refresh |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-based rate limiting | Upstash Redis (@upstash/ratelimit) | Adds a new service dependency for a single 1/hour check; DB query is simpler for this low-frequency rate limit |
| In-memory rate limiting | Map<string, timestamp> | Does not persist across serverless cold starts; unreliable on Vercel |
| QStash/Inngest for pipeline | Direct invocation | Over-engineering for a daily cron + occasional user trigger; add later if pipeline needs become complex |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/
    api/
      cron/
        scrape/
          route.ts           # NEW: GET handler for Vercel Cron (CRON_SECRET auth)
      scraper/
        run/
          route.ts           # MODIFY: POST handler for user-triggered runs (session auth + rate limit)
  lib/
    scraper/
      pipeline.ts            # EXISTING: No changes needed
      scheduler.ts           # DELETE or DEPRECATE: node-cron scheduler replaced by Vercel Cron
      rate-limit.ts          # NEW: DB-based rate limiting for on-demand refreshes
    db/
      schema/
        pipeline-runs.ts     # NEW: pipeline_runs table schema
  components/
    dashboard/
      refresh-leads-button.tsx  # NEW: Client component for Refresh Leads
      pipeline-progress.tsx     # NEW: Progress indicator while pipeline runs
      empty-state.tsx           # NEW: Informative empty state component
  actions/
    onboarding.ts            # MODIFY: Add first-login pipeline trigger
vercel.json                  # NEW: Cron configuration
```

### Pattern 1: Vercel Cron Route Handler with CRON_SECRET Auth

**What:** A GET route handler that verifies the Vercel-injected CRON_SECRET Bearer token before running the pipeline.
**When to use:** For the daily automated cron invocation.
**Example:**
```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// File: src/app/api/cron/scrape/route.ts
import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/scraper/pipeline";
import { initializeAdapters } from "@/lib/scraper/adapters";
import { getRegisteredAdapters, clearAdapters } from "@/lib/scraper/registry";

export const maxDuration = 300; // 5 minutes for pipeline execution

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    initializeAdapters();
    const adapters = getRegisteredAdapters();
    const result = await runPipeline(adapters);
    clearAdapters();
    return Response.json(result);
  } catch (error) {
    clearAdapters();
    return Response.json(
      { error: error instanceof Error ? error.message : "Pipeline error" },
      { status: 500 }
    );
  }
}
```

### Pattern 2: vercel.json Cron Configuration

**What:** Declarative cron schedule in vercel.json.
**When to use:** Configuring the daily 06:00 UTC schedule.
**Example:**
```json
// Source: https://vercel.com/docs/cron-jobs/quickstart
// File: vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Pattern 3: Session-Authenticated User-Triggered Route with DB Rate Limiting

**What:** POST route that verifies session auth and checks the last pipeline run time for the org.
**When to use:** For the "Refresh Leads" button.
**Example:**
```typescript
// File: src/app/api/scraper/run/route.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, and, desc, gte } from "drizzle-orm";

export const maxDuration = 300;

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session.activeOrganizationId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.session.activeOrganizationId;

  // Rate limit: check last run within the past hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRun = await db.query.pipelineRuns.findFirst({
    where: and(
      eq(pipelineRuns.organizationId, orgId),
      gte(pipelineRuns.startedAt, oneHourAgo)
    ),
    orderBy: [desc(pipelineRuns.startedAt)],
  });

  if (recentRun) {
    const nextAllowed = new Date(recentRun.startedAt.getTime() + 60 * 60 * 1000);
    return Response.json(
      { error: "Rate limited", nextAllowedAt: nextAllowed.toISOString() },
      { status: 429 }
    );
  }

  // Record run start
  const [run] = await db.insert(pipelineRuns).values({
    organizationId: orgId,
    triggeredBy: session.user.id,
    triggerType: "manual",
    status: "running",
  }).returning();

  // Run pipeline (fire-and-forget would be ideal but Vercel has no background tasks)
  // Instead, run synchronously and update status
  try {
    // ... run pipeline, update run record with results
  } catch (error) {
    // ... update run record with error
  }
}
```

### Pattern 4: First-Login Pipeline Trigger

**What:** After onboarding completes, fire the pipeline for the new org.
**When to use:** AUTO-02 requirement.
**Example:**
```typescript
// In completeOnboarding action or on the post-onboarding page
// Use an internal fetch to the scraper/run endpoint
// OR: Call pipeline directly from a server action (avoids HTTP overhead)
// RECOMMENDED: Trigger via fetch from the client after redirect to dashboard,
// so the user sees the progress indicator immediately.
```

### Pattern 5: Pipeline Runs Tracking Table

**What:** A DB table that records every pipeline execution for rate limiting and progress tracking.
**When to use:** Rate limiting (AUTO-04) and progress indicator (AUTO-03).
**Example:**
```typescript
// File: src/lib/db/schema/pipeline-runs.ts
import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id"),  // null for cron-triggered (global) runs
  triggeredBy: text("triggered_by"),         // user ID or "cron"
  triggerType: text("trigger_type").notNull(), // "cron" | "manual" | "first-login"
  status: text("status").notNull().default("pending"), // "pending" | "running" | "completed" | "failed"
  recordsScraped: integer("records_scraped"),
  recordsStored: integer("records_stored"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

### Anti-Patterns to Avoid

- **Using node-cron on Vercel:** Node-cron requires a persistent process. Vercel serverless functions are stateless and ephemeral -- node-cron will never fire. This is the existing broken pattern that Phase 8 replaces.
- **In-memory rate limiting on serverless:** A `Map<string, Date>` in module scope will be lost on cold start. For a 1-hour rate limit window, this is unreliable. Use the database.
- **Running pipeline synchronously in onboarding action:** The pipeline takes minutes. Do not block the onboarding completion response. Fire-and-forget or trigger from client-side after redirect.
- **Single route for both cron and user triggers:** Different auth mechanisms (CRON_SECRET vs session) and different rate limiting rules. Keep them separate for clarity and security.
- **Polling pipeline status too aggressively:** If implementing a progress indicator, poll at most every 5-10 seconds. The pipeline takes minutes, not milliseconds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom scheduler, node-cron on serverless | Vercel Cron Jobs (vercel.json) | node-cron requires persistent process; Vercel Cron is native to the platform |
| Auth verification for API routes | Custom token parsing | `auth.api.getSession()` (Better Auth) | Already used throughout the app, handles cookies and session validation |
| CRON_SECRET verification | Complex auth middleware | Simple header comparison (`Bearer ${process.env.CRON_SECRET}`) | Vercel injects the header automatically; pattern is 3 lines of code |
| Rate limiting storage | Redis, in-memory cache | PostgreSQL query on pipeline_runs table | Already have Neon PG; 1/hour rate limit is a simple timestamp query, not high-throughput |

**Key insight:** This phase connects existing infrastructure (pipeline, auth, DB) with Vercel platform features (Cron). There is very little to build from scratch -- it is primarily wiring and UX.

## Common Pitfalls

### Pitfall 1: Vercel Cron Uses GET, Not POST
**What goes wrong:** The existing `/api/scraper/run` route only exports a POST handler. Vercel Cron invokes GET requests. If you add the cron config pointing to this route, it will return 405 Method Not Allowed silently.
**Why it happens:** Developers assume cron works like a webhook (POST). Vercel Cron is a simple GET request.
**How to avoid:** Create a dedicated GET route at `/api/cron/scrape` for cron invocations. Keep the POST route at `/api/scraper/run` for user-triggered runs.
**Warning signs:** Cron job logs show 405 errors; pipeline never runs on schedule.

### Pitfall 2: Function Timeout on 8 Sequential Adapters
**What goes wrong:** The pipeline runs 8 adapters sequentially (3 permit + 1 bid + 3 news + 1 dorking), each making external HTTP requests. If any external API is slow, the function can exceed the default timeout.
**Why it happens:** Vercel Functions default to 300s (5 min) with Fluid Compute. The pipeline has no parallelization and no individual adapter timeout.
**How to avoid:** Set `export const maxDuration = 300;` on the cron route (5 minutes should be sufficient for sequential adapters). Monitor and consider parallelizing adapters with `Promise.allSettled()` if timeouts occur in production.
**Warning signs:** Pipeline runs complete with some adapters never finishing; function logs show timeout errors.

### Pitfall 3: Cron Runs Only on Production Deployments
**What goes wrong:** Developers test cron configuration on preview deployments and wonder why it never fires.
**Why it happens:** Vercel explicitly only invokes cron jobs on production deployments.
**How to avoid:** Test the cron route locally by making a direct GET request with the Authorization header: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/scrape`. For production testing, deploy to production and check cron job logs in Vercel dashboard.
**Warning signs:** "My cron job isn't working" -- check if you're on a preview deployment.

### Pitfall 4: CRON_SECRET Not Set in Environment Variables
**What goes wrong:** The cron endpoint returns 401 for every invocation because CRON_SECRET env var is missing or doesn't match.
**Why it happens:** Vercel auto-injects the CRON_SECRET in the Authorization header but the app must also have it in its env to compare against.
**How to avoid:** Add CRON_SECRET to Vercel project environment variables (Settings > Environment Variables). Use a random 16+ character string. Also add it to `.env.local` for local testing.
**Warning signs:** Cron job logs show 401 Unauthorized responses.

### Pitfall 5: Rate Limiting Cron-Triggered Runs
**What goes wrong:** The cron job is rate-limited by the same logic as user-triggered runs, causing the daily run to be blocked.
**Why it happens:** Sharing a single route/logic for both cron and user triggers without distinguishing the trigger type.
**How to avoid:** Separate routes for cron and user triggers. Cron route (`/api/cron/scrape`) has no rate limiting. User route (`/api/scraper/run`) has 1/hour per org rate limit. The `pipeline_runs` table distinguishes trigger types.
**Warning signs:** Daily cron shows as rate-limited; pipeline_runs show a "manual" run was recorded recently for the same org.

### Pitfall 6: Blocking Onboarding with Pipeline Execution
**What goes wrong:** The `completeOnboarding` server action calls `runPipeline` directly and blocks for minutes while the pipeline scrapes 8 sources.
**Why it happens:** Trying to ensure the user sees leads immediately by running the pipeline synchronously.
**How to avoid:** Fire the pipeline trigger asynchronously. Options: (a) After onboarding completes and user lands on dashboard, the dashboard component detects "first visit + no leads" and triggers the pipeline via fetch, or (b) the onboarding action fires a non-blocking fetch to the scraper endpoint. The dashboard shows a progress indicator while waiting.
**Warning signs:** Onboarding "Complete Setup" button hangs for minutes; user thinks the app is broken.

### Pitfall 7: Vercel Cron May Double-Deliver Events
**What goes wrong:** The pipeline runs twice for the same scheduled invocation, potentially creating duplicate leads.
**Why it happens:** Vercel's event-driven system can occasionally deliver the same cron event more than once (documented behavior).
**How to avoid:** The existing pipeline already handles idempotency through upserts (`onConflictDoUpdate` for permits, existence checks for non-permits). The dedup engine also runs post-pipeline. This is already safe, but be aware of it.
**Warning signs:** pipeline_runs table shows two entries at nearly the same timestamp with triggerType "cron".

## Code Examples

Verified patterns from official sources and existing codebase:

### Vercel Cron Route with CRON_SECRET Auth
```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// File: src/app/api/cron/scrape/route.ts
import type { NextRequest } from "next/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... run pipeline
  return Response.json({ success: true });
}
```

### vercel.json Cron Configuration
```json
// Source: https://vercel.com/docs/cron-jobs/quickstart
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Session Auth for User-Triggered Route
```typescript
// Pattern from existing codebase: src/app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.session.activeOrganizationId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... rate limit check, then run pipeline
}
```

### DB-Based Rate Limit Check
```typescript
// Using existing Drizzle patterns from codebase
import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema/pipeline-runs";
import { eq, and, gte, desc } from "drizzle-orm";

async function checkRateLimit(orgId: string): Promise<{ allowed: boolean; nextAllowedAt?: Date }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRun = await db.query.pipelineRuns.findFirst({
    where: and(
      eq(pipelineRuns.organizationId, orgId),
      gte(pipelineRuns.startedAt, oneHourAgo)
    ),
    orderBy: [desc(pipelineRuns.startedAt)],
  });

  if (recentRun) {
    return {
      allowed: false,
      nextAllowedAt: new Date(recentRun.startedAt.getTime() + 60 * 60 * 1000),
    };
  }
  return { allowed: true };
}
```

### Empty State Component Pattern
```typescript
// Based on existing dashboard page patterns in src/app/(dashboard)/dashboard/page.tsx
// Context-aware: distinguishes "pipeline running" vs "no leads yet" vs "filtered out"
interface EmptyStateProps {
  hasFilters: boolean;
  pipelineRunning: boolean;
  hasEverHadLeads: boolean;
}

function DashboardEmptyState({ hasFilters, pipelineRunning, hasEverHadLeads }: EmptyStateProps) {
  if (pipelineRunning) {
    return /* "Finding leads for you..." with spinner/progress */;
  }
  if (!hasEverHadLeads) {
    return /* "Welcome! We're setting up your lead pipeline..." with Refresh button */;
  }
  if (hasFilters) {
    return /* "No leads match your filters" with suggestions to adjust */;
  }
  return /* "No leads available yet" with info about next scheduled run */;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron in-process scheduling | Vercel Cron Jobs via vercel.json | Vercel Cron GA ~2023 | Serverless-compatible scheduling; node-cron is dead on Vercel |
| POST-based cron endpoints | GET-based cron endpoints | Vercel Cron design | Must use GET handler, not POST, for cron-invoked routes |
| Serverless 10s default timeout | Fluid Compute 300s default (5 min) | Vercel Fluid Compute ~2024 | Sufficient for 8-adapter sequential pipeline without parallelization |
| Unauthenticated cron routes | CRON_SECRET Bearer token auth | Vercel CRON_SECRET feature | Platform-native security for cron endpoints |

**Deprecated/outdated:**
- `node-cron` on Vercel: Does not work in serverless. The existing `src/lib/scraper/scheduler.ts` using node-cron is dead code.
- `@types/node-cron` dev dependency: Can be removed after scheduler.ts is deprecated.

## Open Questions

1. **Pipeline execution time under production conditions**
   - What we know: 8 adapters run sequentially; each makes HTTP requests to external APIs. The 5-minute default maxDuration should suffice.
   - What's unclear: Actual wall-clock time for a full pipeline run in production with real external APIs.
   - Recommendation: Set `maxDuration = 300` (5 min), monitor in production. If timeouts occur, parallelize adapters with `Promise.allSettled()`. The pipeline already has error isolation per adapter.

2. **First-login trigger timing**
   - What we know: Onboarding completes, user redirects to /billing, then /dashboard. Pipeline must fire after onboarding but not block the user flow.
   - What's unclear: Best trigger point -- from onboarding action (server-side fetch) or from dashboard mount (client-side fetch)?
   - Recommendation: Trigger from dashboard. On first visit (no leads exist + pipeline never run for this org), the dashboard detects this condition and auto-fires the pipeline, showing the progress indicator. This avoids coupling pipeline logic into the onboarding flow and handles the case where a user navigates back to dashboard without completing billing first.

3. **Cron pipeline scope: global vs per-org**
   - What we know: The current pipeline scrapes public data sources that are not org-specific. All orgs see the same leads, filtered by their geo/equipment settings.
   - What's unclear: Should the cron pipeline record a run for each org, or just a global run?
   - Recommendation: The cron-triggered pipeline should record ONE global run (organizationId = null, triggerType = "cron"). User-triggered runs record per-org runs. The progress indicator checks for any recent pipeline run (global or org-specific).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/scraper/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Cron route returns 401 without valid CRON_SECRET | unit | `npx vitest run tests/scraper/cron-route.test.ts -t "returns 401" -x` | Wave 0 |
| AUTO-01 | Cron route triggers pipeline with valid CRON_SECRET | unit | `npx vitest run tests/scraper/cron-route.test.ts -t "triggers pipeline" -x` | Wave 0 |
| AUTO-02 | First-login detection triggers pipeline for new orgs | unit | `npx vitest run tests/scraper/first-login.test.ts -x` | Wave 0 |
| AUTO-03 | Progress indicator renders when pipeline is running | unit | `npx vitest run tests/dashboard/pipeline-progress.test.tsx -x` | Wave 0 |
| AUTO-04 | Rate limiter blocks runs within 1 hour | unit | `npx vitest run tests/scraper/rate-limit.test.ts -t "blocks" -x` | Wave 0 |
| AUTO-04 | Rate limiter allows runs after 1 hour | unit | `npx vitest run tests/scraper/rate-limit.test.ts -t "allows" -x` | Wave 0 |
| AUTO-05 | User-triggered route requires session auth | unit | `npx vitest run tests/scraper/user-trigger.test.ts -t "requires auth" -x` | Wave 0 |
| AUTO-05 | Cron route rejects non-CRON_SECRET auth | unit | `npx vitest run tests/scraper/cron-route.test.ts -t "returns 401" -x` | Wave 0 |
| PLSH-02 | Empty state shows correct messaging per state | unit | `npx vitest run tests/dashboard/empty-state.test.tsx -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/scraper/ tests/dashboard/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/scraper/cron-route.test.ts` -- covers AUTO-01, AUTO-05 (cron auth)
- [ ] `tests/scraper/rate-limit.test.ts` -- covers AUTO-04
- [ ] `tests/scraper/user-trigger.test.ts` -- covers AUTO-05 (session auth)
- [ ] `tests/scraper/first-login.test.ts` -- covers AUTO-02
- [ ] `tests/dashboard/pipeline-progress.test.tsx` -- covers AUTO-03
- [ ] `tests/dashboard/empty-state.test.tsx` -- covers PLSH-02
- [ ] `src/lib/db/schema/pipeline-runs.ts` -- schema needed before tests can import it
- [ ] Database migration for pipeline_runs table
- [ ] `CRON_SECRET` env var in `tests/setup.ts`

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Jobs Overview](https://vercel.com/docs/cron-jobs) -- How cron jobs work, cron expressions, GET invocation model
- [Vercel Cron Quickstart](https://vercel.com/docs/cron-jobs/quickstart) -- vercel.json configuration, route handler setup
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) -- CRON_SECRET auth pattern, code examples, duration limits, idempotency guidance, concurrency control
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- 100 cron jobs per project, Hobby = once/day, Pro = once/minute
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- maxDuration export, Fluid Compute defaults (300s default, 800s max on Pro)
- Existing codebase: `src/lib/scraper/pipeline.ts`, `src/lib/scraper/scheduler.ts`, `src/app/api/scraper/run/route.ts` -- current pipeline infrastructure

### Secondary (MEDIUM confidence)
- [Vercel CRON_SECRET Issue #11303](https://github.com/vercel/vercel/issues/11303) -- Known issues with CRON_SECRET injection (resolved)
- Community patterns for Next.js rate limiting with database-backed approaches

### Tertiary (LOW confidence)
- None -- all critical claims verified against official Vercel documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use; Vercel Cron is well-documented platform feature
- Architecture: HIGH -- patterns directly from Vercel official docs; codebase structure is well-understood
- Pitfalls: HIGH -- all pitfalls sourced from official Vercel docs (GET not POST, production-only, CRON_SECRET, idempotency)
- Rate limiting: HIGH -- simple DB timestamp check on existing Neon PG; pattern is straightforward

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable platform feature, unlikely to change)
