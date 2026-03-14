# Phase 5: Lead Management and Notifications - Research

**Researched:** 2026-03-14
**Domain:** Lead status tracking, saved searches/bookmarks, email digests, keyword/filter search
**Confidence:** HIGH

## Summary

Phase 5 adds four user-facing capabilities on top of the existing lead feed dashboard: (1) per-user lead status tracking with a five-state workflow, (2) saved search configurations and lead bookmarks, (3) daily email digest of new matching leads, and (4) keyword search with date range and project size filters. All four features build on the existing architecture -- Next.js 16 server components/actions, Drizzle ORM on Neon PostgreSQL, Better Auth multi-tenancy -- without introducing new architectural paradigms.

The key technical decision is that lead statuses, bookmarks, and saved searches are **per-user, per-organization** data, requiring new database tables that join the existing `leads` table to user/organization identity. The existing `leads` table is tenant-agnostic (global pool, matched to tenants at query time), so all new tables must scope to `userId + organizationId`. Email digests use **Resend** with **React Email** components for templating, triggered by a new daily cron job that runs after the scraper pipeline and queries each user's saved search criteria. Keyword search uses PostgreSQL `ILIKE` for MVP (sufficient for <100k records), with a GIN tsvector upgrade path documented for later.

**Primary recommendation:** Add three new Drizzle schema tables (`lead_statuses`, `bookmarks`, `saved_searches`), extend the existing `getFilteredLeads` query with keyword/date/size filters, build the email digest as a Resend + React Email pipeline triggered post-scrape, and use Next.js server actions with `revalidatePath` for all mutations (status updates, bookmark toggles, saved search CRUD).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-02 | User can track lead status (New / Viewed / Contacted / Won / Lost) | New `lead_statuses` table scoped to userId+orgId, server action for status mutation, status badge on lead cards and detail page |
| UX-03 | User can save searches and bookmark individual leads for quick re-access | New `saved_searches` and `bookmarks` tables, server actions for CRUD, sidebar nav additions for saved searches and bookmarks pages |
| UX-04 | User receives a daily email digest summarizing new matching leads with links to dashboard | Resend API + React Email template, new cron job post-scrape, queries based on each user's saved search or company profile defaults |
| UX-06 | User can search leads by keyword and filter by date range and project size | Extend `getFilteredLeads` with `ilike` for keyword, `gte`/`lte` for date range on `scrapedAt`, `gte`/`lte` for `estimatedValue` range |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Database ORM for new tables + extended queries | Already in project, type-safe schema definitions |
| resend | ^4.x | Transactional email API | Developer-friendly, free tier 3k emails/month, React component support |
| @react-email/components | ^0.x | Email HTML template components | Works directly with Resend's `react` param, cross-client HTML compatibility |
| next (server actions) | 16.1.6 | Mutations for status/bookmark/search CRUD | Already in project, `revalidatePath` for cache invalidation |
| node-cron | ^4.2.1 | Schedule email digest after scraper pipeline | Already in project for daily scraper scheduling |
| zod | ^4.3.6 | Validate server action inputs | Already in project for all form validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Icons for status badges, bookmark toggle, search UI | Already in project, used throughout dashboard |
| sonner | ^2.0.7 | Toast notifications for action feedback | Already in project, used for settings updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Nodemailer + SMTP | Nodemailer requires SMTP server config; Resend is simpler, free tier sufficient for MVP |
| ILIKE search | PostgreSQL tsvector full-text search | FTS is better at scale but ILIKE is simpler to implement, sufficient for <100k records, upgrade path documented |
| react-email | Plain HTML strings | React Email ensures cross-client compatibility; plain HTML is fragile across Outlook/Gmail |

**Installation:**
```bash
npm install resend @react-email/components
```

## Architecture Patterns

### New Database Tables

```
src/lib/db/schema/
  lead-statuses.ts     # User lead status tracking (UX-02)
  bookmarks.ts         # Individual lead bookmarks (UX-03)
  saved-searches.ts    # Saved search configurations (UX-03)
```

### New Server Actions

```
src/actions/
  lead-status.ts       # updateLeadStatus(leadId, status)
  bookmarks.ts         # toggleBookmark(leadId), getBookmarks()
  saved-searches.ts    # createSavedSearch(), deleteSavedSearch(), etc.
```

### New Pages/Routes

```
src/app/(dashboard)/dashboard/
  page.tsx                         # MODIFY: add keyword/date/size filter params + status badges
  lead-filters.tsx                 # MODIFY: add keyword input, date range pickers, size slider
  lead-card.tsx                    # MODIFY: add status badge + bookmark toggle button
  bookmarks/page.tsx               # NEW: bookmarked leads list
  saved-searches/page.tsx          # NEW: saved search management
  leads/[id]/page.tsx              # MODIFY: add status dropdown + bookmark button
  leads/[id]/lead-status-select.tsx  # NEW: client component for status dropdown

src/app/api/email-digest/route.ts  # NEW: API route for cron-triggered digest
```

### Email Template

```
src/components/emails/
  daily-digest.tsx     # React Email template for daily lead digest
```

### Pattern 1: Per-User Lead Status Table

**What:** A junction table linking users to leads with a status column, scoped by organization.
**When to use:** Whenever tracking user-specific state against a shared resource pool.
**Example:**

```typescript
// Source: Drizzle ORM pgTable pattern (existing project convention)
import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const leadStatuses = pgTable(
  "lead_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    status: text("status").notNull().default("new"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_statuses_user_lead_idx").on(
      table.userId,
      table.leadId,
      table.organizationId
    ),
  ]
);
```

**Status values:** `"new" | "viewed" | "contacted" | "won" | "lost"` -- stored as text (not pgEnum) to match project convention of text columns with TypeScript type constraints.

### Pattern 2: Saved Search Configuration

**What:** A table storing serialized filter criteria that can be re-applied as URL search params.
**When to use:** When users want to save and re-execute parameterized queries.
**Example:**

```typescript
import { pgTable, text, uuid, timestamp, integer, real } from "drizzle-orm/pg-core";

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  // Serialized filter criteria
  equipmentFilter: text("equipment_filter").array(),
  radiusMiles: real("radius_miles"),
  keyword: text("keyword"),
  dateFrom: timestamp("date_from"),
  dateTo: timestamp("date_to"),
  minProjectSize: integer("min_project_size"),
  maxProjectSize: integer("max_project_size"),
  isDigestEnabled: boolean("is_digest_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Key design choice:** Store filter criteria as explicit columns (not a JSON blob) for query-time use in digest generation. The `isDigestEnabled` flag determines which saved searches drive the email digest.

### Pattern 3: Bookmark Toggle

**What:** A simple junction table for user-lead bookmarks with upsert/delete toggle.
**When to use:** Binary user-resource relationships.
**Example:**

```typescript
import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bookmarks_user_lead_idx").on(
      table.userId,
      table.leadId,
      table.organizationId
    ),
  ]
);
```

### Pattern 4: Extending getFilteredLeads with Keyword + Date + Size Filters

**What:** Add optional filter parameters to the existing query function.
**When to use:** When the base query needs progressive enhancement.
**Example:**

```typescript
// Source: Drizzle ORM docs (operators)
import { ilike, gte, lte, or, and } from "drizzle-orm";

// Add to GetFilteredLeadsParams interface:
interface GetFilteredLeadsParams {
  // ... existing params ...
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minProjectSize?: number;
  maxProjectSize?: number;
}

// Build WHERE conditions array:
const conditions = [
  isNotNull(leads.lat),
  isNotNull(leads.lng),
  // ... existing haversine condition ...
];

if (keyword) {
  conditions.push(
    or(
      ilike(leads.title, `%${keyword}%`),
      ilike(leads.description, `%${keyword}%`),
      ilike(leads.address, `%${keyword}%`),
      ilike(leads.applicantName, `%${keyword}%`),
      ilike(leads.contractorName, `%${keyword}%`)
    )!
  );
}

if (dateFrom) {
  conditions.push(gte(leads.scrapedAt, dateFrom));
}

if (dateTo) {
  conditions.push(lte(leads.scrapedAt, dateTo));
}

if (minProjectSize != null) {
  conditions.push(gte(leads.estimatedValue, minProjectSize));
}

if (maxProjectSize != null) {
  conditions.push(lte(leads.estimatedValue, maxProjectSize));
}
```

### Pattern 5: Email Digest with Resend + React Email

**What:** Daily digest email sent after scraper pipeline completes.
**When to use:** When users need proactive notifications about new data matching their criteria.
**Example:**

```typescript
// src/lib/email/send-digest.ts
import { Resend } from "resend";
import { DailyDigestEmail } from "@/components/emails/daily-digest";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDigest(
  to: string,
  userName: string,
  leads: DigestLead[],
  dashboardUrl: string
) {
  await resend.emails.send({
    from: "HeavyLeads <digest@yourdomain.com>",
    to: [to],
    subject: `${leads.length} new lead${leads.length !== 1 ? "s" : ""} matching your criteria`,
    react: DailyDigestEmail({ userName, leads, dashboardUrl }),
  });
}
```

### Anti-Patterns to Avoid

- **Storing status on the leads table directly:** The leads table is a global pool shared across all tenants. User-specific status MUST be in a separate junction table scoped by userId + organizationId.
- **JSON blob for saved search criteria:** Storing filters as a JSON column prevents SQL-level querying when generating digests. Use explicit columns.
- **Client-side email sending:** Never expose Resend API keys to the client. All email operations go through server actions or API routes.
- **Polling for email digest:** Use cron scheduling (already established pattern), not client-initiated polling.
- **pgEnum for lead status:** The project consistently uses text columns with TypeScript type constraints rather than pgEnum. Stay consistent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom HTML string templates | @react-email/components | Cross-client rendering (Outlook, Gmail, Apple Mail) is deceptively complex; React Email handles inline styles, table layouts, and dark mode |
| Email delivery | Custom SMTP connection | Resend API | Deliverability, bounce handling, reputation management are entire disciplines |
| Date range picker UI | Custom date input logic | Native HTML `<input type="date">` | Works cross-browser in 2026, consistent with the project's minimal-dependency approach |
| Keyword sanitization | Manual SQL escaping | Drizzle ORM's `ilike()` operator | Parameterized queries prevent SQL injection automatically |

**Key insight:** Email is the primary "don't hand-roll" risk area. Building email templates with raw HTML and delivering through SMTP is a multi-week rabbit hole of cross-client compatibility testing that Resend + React Email eliminates.

## Common Pitfalls

### Pitfall 1: Status Defaults and "New" vs Null
**What goes wrong:** If a lead has no `lead_statuses` row, is it "New" or undefined? Mixing null (no row) with "new" (explicit row) creates inconsistent filtering.
**Why it happens:** The status table is sparse -- rows are only created on first interaction.
**How to avoid:** Treat absence of a `lead_statuses` row as "new" status at the query/display layer. Use a LEFT JOIN when querying leads with status, and COALESCE to "new" for display. Only insert a row when the user explicitly changes status away from "new".
**Warning signs:** "New" filter shows no results, or status counts don't add up to total leads.

### Pitfall 2: Saved Search Serialization Mismatch
**What goes wrong:** Saved search filter values don't match the URL search param format used by the existing dashboard, causing the "load saved search" action to produce wrong results.
**Why it happens:** The dashboard reads from URL params (strings), but the database stores typed values (numbers, arrays, dates).
**How to avoid:** When loading a saved search, convert database values to URLSearchParams format and redirect to `/dashboard?{params}`. Use the same parsing logic the dashboard already uses.
**Warning signs:** Loaded saved search shows different results than when originally saved.

### Pitfall 3: Email Digest N+1 Queries
**What goes wrong:** For each user, the digest generator runs a full `getFilteredLeads` query with their profile settings, causing O(users * leads) database load.
**Why it happens:** Naive implementation loops over users and calls the same query function.
**How to avoid:** Batch the digest generation: (1) run a single query to find all leads scraped in the last 24 hours, (2) for each user, filter the pre-fetched leads in memory using their saved search criteria. This reduces DB queries to O(1) + O(users) for profile lookups.
**Warning signs:** Digest cron job takes >60 seconds or causes DB connection exhaustion.

### Pitfall 4: Bookmark Toggle Race Conditions
**What goes wrong:** Rapid clicking of the bookmark button creates duplicate inserts or errors.
**Why it happens:** Server action hasn't completed before the next click fires.
**How to avoid:** Use `useOptimistic` for instant UI feedback, and use `ON CONFLICT DO NOTHING` on the unique index for the insert path. The toggle action should check existence first: if exists, delete; if not, insert.
**Warning signs:** Duplicate key errors in logs, or bookmark state flickering.

### Pitfall 5: Missing Organization Scoping
**What goes wrong:** User in org A can see bookmarks/statuses set by users in org B.
**Why it happens:** Queries filter by userId but forget to also filter by organizationId.
**How to avoid:** Every query against lead_statuses, bookmarks, and saved_searches MUST include both `userId` AND `organizationId` in the WHERE clause. The session object provides both.
**Warning signs:** Cross-tenant data leaks -- catastrophic for a multi-tenant SaaS.

## Code Examples

Verified patterns from official sources and project conventions:

### Server Action with Auth Guard (existing project pattern)

```typescript
// Source: src/actions/settings.ts (existing convention)
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateLeadStatus(leadId: string, status: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  // Upsert status
  await db
    .insert(leadStatuses)
    .values({ leadId, userId, organizationId: orgId, status })
    .onConflictDoUpdate({
      target: [leadStatuses.userId, leadStatuses.leadId, leadStatuses.organizationId],
      set: { status, updatedAt: new Date() },
    });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${leadId}`);
}
```

### ILIKE Multi-Column Keyword Search (Drizzle ORM docs)

```typescript
// Source: https://orm.drizzle.team/docs/operators
import { or, ilike } from "drizzle-orm";

// Search across multiple text columns
const keywordCondition = or(
  ilike(leads.title, `%${keyword}%`),
  ilike(leads.description, `%${keyword}%`),
  ilike(leads.address, `%${keyword}%`),
  ilike(leads.applicantName, `%${keyword}%`),
  ilike(leads.contractorName, `%${keyword}%`)
);
```

### Resend Email Send (official docs)

```typescript
// Source: https://resend.com/docs/send-with-nextjs
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "HeavyLeads <digest@yourdomain.com>",
  to: ["user@example.com"],
  subject: "Your daily lead digest",
  react: DailyDigestEmail({ userName: "John", leads, dashboardUrl }),
});
```

### LEFT JOIN for Lead Status Enrichment

```typescript
// Source: Drizzle ORM select pattern
import { eq, and, sql } from "drizzle-orm";

const rows = await db
  .select({
    ...getTableColumns(leads),
    status: sql<string>`COALESCE(${leadStatuses.status}, 'new')`.as("status"),
    isBookmarked: sql<boolean>`${bookmarks.id} IS NOT NULL`.as("is_bookmarked"),
  })
  .from(leads)
  .leftJoin(
    leadStatuses,
    and(
      eq(leadStatuses.leadId, leads.id),
      eq(leadStatuses.userId, userId),
      eq(leadStatuses.organizationId, orgId)
    )
  )
  .leftJoin(
    bookmarks,
    and(
      eq(bookmarks.leadId, leads.id),
      eq(bookmarks.userId, userId),
      eq(bookmarks.organizationId, orgId)
    )
  )
  .where(/* existing filters */);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer + SMTP | Resend API | 2023+ | Simpler setup, built-in React Email support, better deliverability |
| HTML string email templates | React Email components | 2023+ | Type-safe, component-based, cross-client tested |
| pgEnum for status columns | text + TypeScript union types | Project convention | Avoids migration pain when adding new statuses, consistent with existing schema |
| Full-text search from day 1 | ILIKE for MVP, tsvector upgrade path | N/A | ILIKE is sufficient for <100k records, simpler to implement and debug |

**Deprecated/outdated:**
- Nodemailer is not deprecated but is lower-level than needed for this use case
- `useOptimistic` is stable in React 19 (shipped with Next.js 16), not experimental

## Open Questions

1. **Resend Domain Verification**
   - What we know: Resend requires domain verification for production sending (free tier uses `onboarding@resend.dev` for testing)
   - What's unclear: Whether the production domain is set up and verified
   - Recommendation: Use `onboarding@resend.dev` for development/testing, document domain verification as a launch readiness task for Phase 6

2. **Email Digest Opt-In/Opt-Out**
   - What we know: UX-04 requires daily email digest; `isDigestEnabled` flag on saved searches controls per-search opt-in
   - What's unclear: Whether there should be a global digest opt-out at the user level
   - Recommendation: Default to enabled for the user's company profile defaults, add a simple "Unsubscribe" link in the email footer that sets a `digestEnabled` flag on a user preferences column or table

3. **Digest Timing Relative to Scraper**
   - What we know: Scraper runs at 06:00 UTC daily; digest should run after scraper completes
   - What's unclear: How long the scraper typically takes
   - Recommendation: Schedule digest at 07:00 UTC (1 hour after scraper start), or trigger digest as a callback after pipeline completion in scheduler.ts

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/leads/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-02 | Lead status CRUD (new/viewed/contacted/won/lost) | unit | `npx vitest run tests/leads/lead-status.test.ts -x` | No - Wave 0 |
| UX-02 | Status persists across sessions (DB roundtrip) | unit | `npx vitest run tests/leads/lead-status.test.ts -x` | No - Wave 0 |
| UX-02 | Status badge displays correctly on lead card | unit | `npx vitest run tests/leads/lead-card-status.test.tsx -x` | No - Wave 0 |
| UX-03 | Bookmark toggle insert/delete | unit | `npx vitest run tests/leads/bookmarks.test.ts -x` | No - Wave 0 |
| UX-03 | Saved search CRUD | unit | `npx vitest run tests/leads/saved-searches.test.ts -x` | No - Wave 0 |
| UX-03 | Loading saved search applies correct filters | unit | `npx vitest run tests/leads/saved-searches.test.ts -x` | No - Wave 0 |
| UX-04 | Digest email generation with correct lead data | unit | `npx vitest run tests/email/digest.test.ts -x` | No - Wave 0 |
| UX-04 | Digest respects user's saved search criteria | unit | `npx vitest run tests/email/digest.test.ts -x` | No - Wave 0 |
| UX-06 | Keyword search matches across multiple columns | unit | `npx vitest run tests/leads/keyword-search.test.ts -x` | No - Wave 0 |
| UX-06 | Date range filter works correctly | unit | `npx vitest run tests/leads/keyword-search.test.ts -x` | No - Wave 0 |
| UX-06 | Project size filter works correctly | unit | `npx vitest run tests/leads/keyword-search.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/leads/ tests/email/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/leads/lead-status.test.ts` -- covers UX-02 (status CRUD, server action mock, status rendering)
- [ ] `tests/leads/bookmarks.test.ts` -- covers UX-03 (bookmark toggle)
- [ ] `tests/leads/saved-searches.test.ts` -- covers UX-03 (saved search CRUD, filter loading)
- [ ] `tests/email/digest.test.ts` -- covers UX-04 (digest generation, lead filtering for digest)
- [ ] `tests/leads/keyword-search.test.ts` -- covers UX-06 (keyword, date range, project size)
- [ ] `tests/helpers/email.ts` -- shared mock for Resend API

## Sources

### Primary (HIGH confidence)
- Project codebase -- all existing patterns (schema, actions, queries, components) directly inspected
- [Drizzle ORM Operators](https://orm.drizzle.team/docs/operators) -- ilike, gte, lte, between operators
- [Drizzle ORM Full-Text Search Guide](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) -- tsvector/tsquery patterns
- [Resend Next.js Docs](https://resend.com/docs/send-with-nextjs) -- send API, React Email integration

### Secondary (MEDIUM confidence)
- [React Email Components](https://www.npmjs.com/package/@react-email/components) -- component inventory and installation
- [Resend Pricing](https://flexprice.io/blog/detailed-resend-pricing-guide) -- free tier 3k/month, 100/day limit

### Tertiary (LOW confidence)
- None -- all findings verified against official documentation or existing project code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project except Resend + React Email, which are well-documented
- Architecture: HIGH -- follows existing patterns exactly (pgTable, server actions, URL params, cron scheduling)
- Pitfalls: HIGH -- derived from direct code inspection of multi-tenant architecture and existing query patterns
- Email integration: MEDIUM -- Resend is straightforward but domain verification and delivery at scale are untested

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack, no fast-moving dependencies)
