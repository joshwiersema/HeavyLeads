# Phase 10: Query Optimizations - Research

**Researched:** 2026-03-15
**Domain:** Database query optimization, pagination, deduplication (Next.js + Drizzle ORM + Neon Postgres)
**Confidence:** HIGH

## Summary

This phase addresses four distinct performance and correctness issues in the HeavyLeads application: (1) the lead feed currently loads all leads at once with no pagination, (2) the bookmarks page fires N+1 individual `getLeadById` queries, (3) the digest email generator fires one `getFilteredLeads` query per saved search per user, and (4) non-permit leads (news, bid, deep-web) can create duplicate records when the same source URL is scraped on successive pipeline runs.

All four requirements are well-scoped, affect existing code with clear before/after states, and can be implemented using the existing stack (Drizzle ORM 0.45+, Neon HTTP driver, Next.js 16 server components). No new libraries are needed. The main complexity lies in correctly interacting with the existing FETCH_MULTIPLIER over-fetch pattern (PERF-01), extracting the enrichment logic from `getLeadById` into a reusable function (PERF-02), merging saved search filter parameters into a single "widest" query (PERF-03), and creating a partial unique index on `source_url` scoped to non-permit source types (PERF-04).

**Primary recommendation:** Implement offset-based pagination with URL-persisted page state; replace N+1 bookmark queries with a single `inArray` batch; refactor digest to compute widest filter envelope and query once; add partial unique index on `source_url WHERE source_type != 'permit'` and use `onConflictDoNothing` during pipeline insert.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Lead feed supports page navigation with Previous/Next controls, page indicator, and URL-based page state that preserves all existing filters | Offset pagination pattern in getFilteredLeads (already has limit/offset params), URL searchParams pattern in dashboard/page.tsx and lead-filters.tsx |
| PERF-02 | Bookmarks page fetches all bookmarked leads in a single batch query using inArray instead of individual getLeadById calls | Drizzle `inArray` operator, existing bookmark schema with userId/orgId/leadId, enrichment functions (inferEquipmentNeeds, scoreLead, getFreshnessBadge, mapTimeline) extracted from getLeadById |
| PERF-03 | Digest generator runs one merged query per user (widest filters) instead of one query per saved search, then filters in memory per search | Existing digest-generator.ts loop structure, saved search schema with explicit filter columns, applyInMemoryFilters + filterByEquipment already exported from queries.ts |
| PERF-04 | Non-permit leads are deduplicated by sourceUrl via partial unique index; dedup check uses sourceUrl as primary key when available | Leads schema source_url column, Drizzle uniqueIndex with .where(sql`...`) for partial index, pipeline.ts non-permit insert path at line 200-222 |
</phase_requirements>

## Standard Stack

### Core (already installed, no changes needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Database ORM, query builder | Already in use; provides `inArray`, `sql` template, `uniqueIndex` with `.where()` |
| next | 16.1.6 | Framework with server components | Already in use; `searchParams` in server components for URL-persisted pagination |
| @neondatabase/serverless | ^1.0.2 | Neon HTTP driver | Already in use via `drizzle-orm/neon-http` |

### Supporting (no new installs)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | ^0.31.9 | Schema push/migrations | `npm run db:push` after adding partial unique index to schema |
| vitest | ^4.1.0 | Test runner | Tests for pagination, batch queries, dedup |

**Installation:** No new packages needed. All functionality exists in current dependencies.

## Architecture Patterns

### Recommended Changes by Requirement

```
src/
├── lib/
│   ├── leads/
│   │   └── queries.ts              # PERF-01: Add getFilteredLeadsWithCount()
│   │                                # PERF-02: Add getBookmarkedLeadsEnriched()
│   │                                #   (batch query with inArray + enrichment)
│   ├── email/
│   │   └── digest-generator.ts      # PERF-03: Merge search filters, single query
│   ├── scraper/
│   │   └── pipeline.ts             # PERF-04: Use onConflictDoNothing with sourceUrl
│   └── db/
│       └── schema/
│           └── leads.ts            # PERF-04: Add partial unique index on source_url
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           ├── page.tsx            # PERF-01: Parse page param, render pagination
│           ├── pagination.tsx      # PERF-01: New client component for Prev/Next
│           └── bookmarks/
│               └── page.tsx        # PERF-02: Replace N+1 with batch query
```

### Pattern 1: Offset Pagination with FETCH_MULTIPLIER (PERF-01)

**What:** The current `getFilteredLeads` already accepts `limit` and `offset` params, but the dashboard always calls it with defaults (limit=50, offset=0). The function over-fetches by FETCH_MULTIPLIER=4 (200 rows), enriches/scores in memory, then slices to 50. For pagination, the page number must be part of the URL and the offset must be calculated from page number.

**Critical interaction with FETCH_MULTIPLIER:** The current design over-fetches 4x the limit, then filters/scores in memory and slices. This means:
- SQL `OFFSET` is NOT the same as the user-facing page offset
- For page 2 with limit=50, you cannot simply pass `offset=50` because the in-memory filtering after the 4x over-fetch changes which leads appear
- Two viable approaches:
  1. **Simple approach (recommended per Out of Scope: "Cursor-based pagination"):** Fetch ALL leads within radius (remove FETCH_MULTIPLIER), do all scoring/filtering in memory, then slice for the requested page. This is acceptable because the Out of Scope notes say "Offset pagination sufficient for current data volumes (<100k records)" and the Haversine WHERE clause already limits the result set significantly.
  2. **Alternative:** Keep FETCH_MULTIPLIER, pass adjusted SQL offset, accept that pages may have slightly inconsistent sizes due to post-fetch filtering. This is confusing and buggy.

**Recommended approach:** For pagination, the query function should return both the paginated slice AND the total count, so the UI can show "Page X of Y". The simplest approach: modify `getFilteredLeads` to accept `page` instead of raw `offset`, and internally handle the over-fetch + slice math. Or create a wrapper `getFilteredLeadsPage` that returns `{ leads, totalCount, page, totalPages }`.

**URL state:** Parse `page` from `searchParams` alongside existing filter params. All existing filters (equipment, radius, keyword, dateFrom, dateTo, minProjectSize, maxProjectSize) must be preserved when navigating between pages.

**Example:**
```typescript
// In dashboard/page.tsx -- parse page from URL
const pageParam = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
const currentPage = pageParam > 0 ? pageParam : 1;
const PAGE_SIZE = 20; // items per page

// Pass to query
const { leads, totalCount } = await getFilteredLeadsWithCount({
  ...filterParams,
  page: currentPage,
  pageSize: PAGE_SIZE,
});

const totalPages = Math.ceil(totalCount / PAGE_SIZE);
```

```typescript
// Pagination component (client component)
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button disabled={currentPage <= 1} onClick={() => navigate(currentPage - 1)}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button disabled={currentPage >= totalPages} onClick={() => navigate(currentPage + 1)}>
        Next
      </button>
    </div>
  );
}
```

### Pattern 2: Batch Bookmark Query with inArray (PERF-02)

**What:** Replace the N+1 pattern `bookmarkedIds.map(id => getLeadById(id, ...))` with a single SQL query using `inArray(leads.id, bookmarkedIds)`.

**Key insight from STATE.md:** "Bookmarks batch query must extract enrichLead() before batching to preserve lead card data." The `getLeadById` function does enrichment inline (equipment inference, scoring, freshness, timeline). This enrichment logic must be extracted and applied to batch results.

**Example:**
```typescript
// In queries.ts -- new function
import { inArray } from "drizzle-orm";

export async function getLeadsbyIds(
  ids: string[],
  params?: GetLeadByIdParams
): Promise<EnrichedLead[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.id, ids));

  return rows.map((row) => enrichLead(row, params));
}

// Extract enrichment into a reusable function
function enrichLead(
  row: InferSelectModel<typeof leads>,
  params?: GetLeadByIdParams
): EnrichedLead {
  const inferred = inferEquipmentNeeds(row.projectType, row.description);
  const inferredTypes = inferred.map((i) => i.type);

  let distance: number | null = null;
  if (params?.hqLat != null && params?.hqLng != null && row.lat != null && row.lng != null) {
    distance = haversineDistance(params.hqLat, params.hqLng, row.lat, row.lng);
  }

  const score = params?.dealerEquipment && params?.serviceRadiusMiles && distance != null
    ? scoreLead({
        inferredEquipment: inferredTypes,
        dealerEquipment: params.dealerEquipment,
        distanceMiles: distance,
        serviceRadiusMiles: params.serviceRadiusMiles,
        estimatedValue: row.estimatedValue,
      })
    : 0;

  return {
    ...row,
    distance,
    inferredEquipment: inferred,
    score,
    freshness: getFreshnessBadge(row.scrapedAt),
    timeline: mapTimeline(row.projectType, row.description),
  };
}
```

**Bookmarks page refactor:** Replace `Promise.all(bookmarkedIds.map(...))` with single `getLeadsbyIds(bookmarkedIds, params)`. This changes from N+1 queries to exactly 1 query. Leads must still show score, equipment, freshness, distance -- same as main feed's LeadCard.

### Pattern 3: Widest-Filter Digest Query (PERF-03)

**What:** Instead of looping `for (const search of group.searches)` and calling `getFilteredLeads` per search, compute the "widest" filter envelope across all searches and issue one query, then filter in memory per search for assignment.

**Widest filter logic:**
- `radiusMiles`: use the maximum across all searches (or service radius if none set)
- `keyword`: skip (cannot merge keywords into a single SQL query meaningfully); use null for SQL, filter in memory
- `dateFrom`: use the earliest dateFrom (or 24h ago)
- `dateTo`: use the latest dateTo (or null for no upper bound)
- `equipmentFilter`: skip (merge to null/empty = no filter at SQL level, filter in memory)
- `minProjectSize`: use the lowest minProjectSize
- `maxProjectSize`: use the highest maxProjectSize

**Then in memory:** For each search's specific filters, run `applyInMemoryFilters` and `filterByEquipment` (both already exported from queries.ts) to determine which leads match that specific search. Deduplicate across searches for the final digest.

**Example:**
```typescript
// Compute widest envelope
const widest = {
  radiusMiles: Math.max(...group.searches.map(s => s.radiusMiles ?? serviceRadius)),
  dateFrom: group.searches.reduce((earliest, s) => {
    const d = s.dateFrom ?? twentyFourHoursAgo;
    return d < earliest ? d : earliest;
  }, twentyFourHoursAgo),
  dateTo: group.searches.reduce((latest, s) => {
    if (!s.dateTo) return null; // null = no upper bound
    if (latest === null) return null;
    return s.dateTo > latest ? s.dateTo : latest;
  }, new Date(0) as Date | null),
  minProjectSize: Math.min(...group.searches.map(s => s.minProjectSize ?? 0)),
  maxProjectSize: Math.max(...group.searches.map(s => s.maxProjectSize ?? Infinity)),
};

// Single query with widest params
const allLeads = await getFilteredLeads({
  ...baseParams,
  radiusMiles: widest.radiusMiles,
  dateFrom: widest.dateFrom,
  dateTo: widest.dateTo ?? undefined,
  minProjectSize: widest.minProjectSize > 0 ? widest.minProjectSize : undefined,
  maxProjectSize: widest.maxProjectSize < Infinity ? widest.maxProjectSize : undefined,
  // keyword: undefined -- broadest possible
  // equipmentFilter: undefined -- broadest possible
});

// Then filter per search in memory
for (const search of group.searches) {
  const filtered = filterByEquipment(
    applyInMemoryFilters(allLeads, {
      keyword: search.keyword ?? undefined,
      dateFrom: search.dateFrom ?? twentyFourHoursAgo,
      dateTo: search.dateTo ?? undefined,
      minProjectSize: search.minProjectSize ?? undefined,
      maxProjectSize: search.maxProjectSize ?? undefined,
    }),
    search.equipmentFilter ?? undefined
  );
  // Deduplicate into allLeads set
  for (const lead of filtered) {
    if (!allLeadIds.has(lead.id)) {
      allLeadIds.add(lead.id);
      allDigestLeads.push({ ... });
    }
  }
}
```

**Vercel function timeout consideration:** The current approach runs N queries sequentially. With widest-filter, it runs 1 query + in-memory filtering. This is dramatically faster and should easily complete within Vercel's 10s (hobby) or 60s (pro) function timeout.

### Pattern 4: sourceUrl-Based Dedup with Partial Unique Index (PERF-04)

**What:** Non-permit leads (bid, news, deep-web) currently check for duplicates via `eq(leads.sourceId, sourceId), eq(leads.title, externalId ?? "")` which misses cases where the same source URL produces different titles on different days. Add a partial unique index on `(source_id, source_url)` filtered to non-permit source types, and use `onConflictDoNothing` for the insert.

**Schema change (leads.ts):**
```typescript
// Add to the index array in pgTable third argument:
uniqueIndex("leads_source_url_dedup_idx")
  .on(table.sourceId, table.sourceUrl)
  .where(sql`source_type != 'permit' AND source_url IS NOT NULL`)
```

**Important Drizzle bug workaround:** Do NOT use `eq()` or `ne()` in `.where()` for index definitions -- Drizzle Kit generates parameterized placeholders ($1) instead of literal values. Use raw `sql` template literal instead.

**Pipeline change (pipeline.ts):**
Replace the non-permit insert path (lines 200-222 in current pipeline.ts) with:
```typescript
// Non-permit records: upsert by sourceId + sourceUrl when sourceUrl is available
if (record.sourceUrl) {
  const result = await db
    .insert(leads)
    .values(values)
    .onConflictDoNothing({
      target: [leads.sourceId, leads.sourceUrl],
    })
    .returning({ id: leads.id });

  if (result.length === 0) {
    // Conflict -- lead already exists, find existing ID for lead_sources tracking
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.sourceId, sourceId), eq(leads.sourceUrl, record.sourceUrl)))
      .limit(1);
    if (existing.length > 0) leadId = existing[0].id;
    else continue; // Edge case: should not happen
  } else {
    leadId = result[0].id;
  }
} else {
  // Fallback for records without sourceUrl: existing title-based check
  // ...existing logic...
}
```

**Out of Scope note from REQUIREMENTS.md:** "Retroactive dedup -- Risk of data loss; forward-only dedup is safer." This is important: the partial unique index only prevents future duplicates. Existing duplicates in the database are left alone.

### Anti-Patterns to Avoid

- **Cursor-based pagination:** Explicitly out of scope per REQUIREMENTS.md. Offset pagination is sufficient for current data volumes.
- **Retroactive dedup migration:** Explicitly out of scope. Do not write a migration to find and merge existing duplicate non-permit leads.
- **Adding modules to db/index.ts:** Per project decisions, never add side-effect imports to db/index.ts -- caused production 500.
- **Env var startup validation:** Per project decisions, env var validation at module load caused production 500. Do not add.
- **Changing the FETCH_MULTIPLIER for non-pagination paths:** The existing limit=50 with 4x over-fetch works well for the main feed. Only change the pagination-specific path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array-based WHERE clause | Manual SQL string concatenation for `IN (...)` | Drizzle `inArray(column, values)` | Handles escaping, empty array edge case, type safety |
| Partial unique index | Raw SQL migration file | Drizzle `uniqueIndex().where(sql\`...\`)` + `db:push` | Keeps schema declarative in code, syncs with drizzle-kit |
| URL param management | Custom URL builder | `URLSearchParams` + `useSearchParams()` | Already used in lead-filters.tsx, battle-tested browser API |
| In-memory filtering | New filter functions for digest | Existing `applyInMemoryFilters` + `filterByEquipment` from queries.ts | Already exported, already tested, exact same logic as SQL filters |

**Key insight:** The codebase already has all the utility functions needed for in-memory filtering (applyInMemoryFilters, filterByEquipment). The digest optimization is primarily about restructuring the query pattern, not writing new filter logic.

## Common Pitfalls

### Pitfall 1: FETCH_MULTIPLIER Breaks Offset Pagination
**What goes wrong:** If you naively pass `offset = (page - 1) * pageSize` to the current `getFilteredLeads`, the function multiplies the limit by 4 and applies the offset at the SQL level. But the in-memory scoring/filtering then removes some leads and re-sorts. The actual leads shown to the user have no stable relationship to the SQL offset, causing leads to appear on multiple pages or be skipped entirely.
**Why it happens:** `FETCH_MULTIPLIER = 4` means the function fetches 4x the requested limit, then filters and slices. The SQL offset moves the window of what gets fetched, but the in-memory operations can produce wildly different results.
**How to avoid:** For the paginated path, either (a) fetch all leads in the radius (no multiplier), score/filter, then paginate the full in-memory list, or (b) increase the multiplier enough to cover all pages and paginate the in-memory results. Option (a) is simpler and the Out of Scope section confirms current data volumes are manageable.
**Warning signs:** Leads appearing on multiple pages, leads "disappearing" between pages, page count changing as user navigates.

### Pitfall 2: Empty inArray Produces Invalid SQL
**What goes wrong:** Calling `inArray(leads.id, [])` with an empty array generates `WHERE id IN ()` which is invalid SQL in PostgreSQL.
**Why it happens:** Edge case when user has no bookmarks.
**How to avoid:** Guard with `if (ids.length === 0) return [];` before the query. Drizzle ORM may handle this in recent versions but the guard is defensive and correct.
**Warning signs:** SQL syntax error in Neon logs when bookmarks page loads for user with no bookmarks.

### Pitfall 3: Partial Unique Index WHERE Clause Uses Parameterized Placeholders
**What goes wrong:** Using `ne(leads.sourceType, 'permit')` in the `.where()` clause of a `uniqueIndex` definition causes Drizzle Kit to generate `WHERE source_type != $1` instead of `WHERE source_type != 'permit'`. Index creation fails because DDL statements cannot use parameterized placeholders.
**Why it happens:** Known Drizzle ORM bug (issue #4790). The `eq()`/`ne()` functions generate parameterized queries, which works for DML but not DDL.
**How to avoid:** Use raw SQL template: `.where(sql\`source_type != 'permit' AND source_url IS NOT NULL\`)`.
**Warning signs:** `drizzle-kit push` fails with SQL syntax error about parameterized placeholders.

### Pitfall 4: Digest Widest-Filter Mishandles null vs undefined
**What goes wrong:** Saved search columns use `null` for "not set" but `getFilteredLeads` uses `undefined` for "no filter". Passing `null` where `undefined` is expected can cause incorrect filtering (e.g., `null` date might be compared via `>=` and produce unexpected results).
**Why it happens:** Drizzle schema uses SQL nulls, but TypeScript functions distinguish null vs undefined.
**How to avoid:** Always coerce `null` to `undefined` when passing saved search values to getFilteredLeads: `search.keyword ?? undefined`.
**Warning signs:** Digest includes leads that should have been filtered out, or excludes leads that should match.

### Pitfall 5: onConflictDoNothing Returns Empty Array on Conflict
**What goes wrong:** When using `onConflictDoNothing().returning()`, a conflict causes the insert to be skipped AND `.returning()` returns an empty array. If you expect `result[0].id` to always exist, you get a runtime error.
**Why it happens:** PostgreSQL's `ON CONFLICT DO NOTHING` silently skips the row, so there's nothing to return.
**How to avoid:** After `onConflictDoNothing`, check `result.length === 0`, then do a separate SELECT to find the existing row's ID for lead_sources tracking.
**Warning signs:** TypeError: Cannot read property 'id' of undefined in pipeline.ts.

### Pitfall 6: Pagination Page Count Changes Between Navigations
**What goes wrong:** If the total count is fetched as a separate query from the leads, and new leads arrive between page navigations, the total page count changes and users may see inconsistent navigation (e.g., "Page 3 of 5" becomes "Page 3 of 6").
**Why it happens:** Lead feed data changes as scraper runs. Two separate queries (count + leads) are not atomic.
**How to avoid:** This is acceptable for the current app -- it's a known limitation of offset pagination listed in Out of Scope. Do not over-engineer; the count and lead query can run in the same function call for consistency within a single page load.
**Warning signs:** Not a bug per se, but be aware of this tradeoff in testing.

## Code Examples

### Drizzle inArray for Batch Query
```typescript
// Source: https://orm.drizzle.team/docs/operators
import { inArray } from "drizzle-orm";

// Fetch multiple leads by ID in a single query
const rows = await db
  .select()
  .from(leads)
  .where(inArray(leads.id, bookmarkedLeadIds));
```

### Drizzle Partial Unique Index
```typescript
// Source: https://orm.drizzle.team/docs/indexes-constraints + workaround for bug #4790
import { uniqueIndex, sql } from "drizzle-orm/pg-core";

// In leads pgTable definition, third argument (indexes array):
uniqueIndex("leads_source_url_dedup_idx")
  .on(table.sourceId, table.sourceUrl)
  .where(sql`source_type != 'permit' AND source_url IS NOT NULL`)
```

### onConflictDoNothing with returning
```typescript
// Source: Drizzle ORM docs
const result = await db
  .insert(leads)
  .values(values)
  .onConflictDoNothing()
  .returning({ id: leads.id });

// result is [] if conflict occurred, [{ id: "..." }] if inserted
```

### Next.js Server Component searchParams for Pagination
```typescript
// Already used pattern in dashboard/page.tsx:
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  // ... use page for offset calculation
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getLeadById` per bookmark (N+1) | `inArray` batch query (1 query) | This phase | O(N) queries -> O(1) queries |
| One `getFilteredLeads` per saved search | One widest-filter query + in-memory filter | This phase | O(S) queries -> O(1) queries per user |
| Title-based non-permit dedup | sourceUrl partial unique index | This phase | Prevents duplicates at DB level |
| No pagination (all leads at once) | Offset pagination with URL state | This phase | Supports large lead sets |

**Deprecated/outdated:**
- None -- all patterns are additive optimizations to existing code.

## Open Questions

1. **Page size for pagination**
   - What we know: Current limit is 50 leads per load. No explicit requirement for page size.
   - What's unclear: Whether 20 or 25 per page is better UX for the lead cards.
   - Recommendation: Use 20 per page (standard for card-based layouts). This is a UI constant that can be adjusted easily.

2. **FETCH_MULTIPLIER behavior with pagination**
   - What we know: FETCH_MULTIPLIER=4 causes the query to over-fetch for scoring diversity. For paginated results, this creates complexity because in-memory scoring changes the order.
   - What's unclear: Whether fetching all leads in radius is too expensive for large datasets.
   - Recommendation: For the paginated code path, fetch all leads within radius (drop FETCH_MULTIPLIER), score/sort in memory, then paginate. The Out of Scope section confirms data volumes under 100k are expected, and the Haversine WHERE clause limits the result set. If this proves slow later, cursor-based pagination can be added (but is currently out of scope).

3. **Handling existing non-permit duplicates**
   - What we know: The partial unique index only prevents future duplicates. Existing duplicates remain.
   - What's unclear: How many existing duplicates exist in production.
   - Recommendation: Per REQUIREMENTS.md Out of Scope: "Retroactive dedup -- Risk of data loss; forward-only dedup is safer." Do not attempt to clean up existing data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Pagination returns correct slice and total count | unit | `npx vitest run tests/leads/pagination.test.ts -x` | No -- Wave 0 |
| PERF-01 | Page param persisted in URL with filters | unit | `npx vitest run tests/leads/pagination.test.ts -x` | No -- Wave 0 |
| PERF-02 | Batch bookmark query returns enriched leads | unit | `npx vitest run tests/leads/bookmarks-batch.test.ts -x` | No -- Wave 0 |
| PERF-02 | Empty bookmarks returns empty array (no SQL error) | unit | `npx vitest run tests/leads/bookmarks-batch.test.ts -x` | No -- Wave 0 |
| PERF-03 | Digest uses single query with widest filters | unit | `npx vitest run tests/email/digest-optimization.test.ts -x` | No -- Wave 0 |
| PERF-03 | Per-search in-memory filtering produces correct per-search matches | unit | `npx vitest run tests/email/digest-optimization.test.ts -x` | No -- Wave 0 |
| PERF-04 | Partial unique index defined in schema | unit | `npx vitest run tests/scraper/source-url-dedup.test.ts -x` | No -- Wave 0 |
| PERF-04 | Pipeline skips non-permit duplicate by sourceUrl | unit | `npx vitest run tests/scraper/source-url-dedup.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/leads/pagination.test.ts tests/leads/bookmarks-batch.test.ts tests/email/digest-optimization.test.ts tests/scraper/source-url-dedup.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/leads/pagination.test.ts` -- covers PERF-01
- [ ] `tests/leads/bookmarks-batch.test.ts` -- covers PERF-02
- [ ] `tests/email/digest-optimization.test.ts` -- covers PERF-03
- [ ] `tests/scraper/source-url-dedup.test.ts` -- covers PERF-04

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM operators docs](https://orm.drizzle.team/docs/operators) - `inArray` syntax and usage
- [Drizzle ORM indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints) - `uniqueIndex` with `.where()` syntax
- Codebase inspection - `src/lib/leads/queries.ts`, `src/lib/email/digest-generator.ts`, `src/lib/scraper/pipeline.ts`, `src/lib/scraper/dedup.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/bookmarks/page.tsx`

### Secondary (MEDIUM confidence)
- [Drizzle ORM GitHub issue #4790](https://github.com/drizzle-team/drizzle-orm/issues/4790) - Bug: eq() in partial unique index WHERE clause generates parameterized query
- [Drizzle ORM GitHub issue #4727](https://github.com/drizzle-team/drizzle-orm/issues/4727) - Feature request for CREATE UNIQUE INDEX ... WHERE
- `.planning/STATE.md` - Accumulated context notes on FETCH_MULTIPLIER pagination interaction and enrichLead extraction

### Tertiary (LOW confidence)
- None -- all findings are from codebase inspection and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new packages needed; all functionality verified in existing dependencies
- Architecture: HIGH - Patterns based on direct codebase inspection; existing utility functions support the approach
- Pitfalls: HIGH - FETCH_MULTIPLIER interaction identified from codebase; Drizzle partial index bug verified via GitHub issues; other pitfalls from PostgreSQL semantics
- Code examples: HIGH - Based on official Drizzle docs and existing codebase patterns

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain -- Drizzle ORM, PostgreSQL, Next.js patterns unlikely to change)
