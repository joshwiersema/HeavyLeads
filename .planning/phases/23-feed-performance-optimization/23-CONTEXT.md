# Phase 23: Feed Performance Optimization - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize the lead feed for 50K+ leads: SQL-level LIMIT on all queries, PostGIS spatial index activation on existing location column, cross-source dedup to catch same permit from overlapping city/county portals. Dashboard must load in < 3 seconds at scale.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure performance optimization phase.

**Key optimizations from research:**

1. **SQL LIMIT on all queries:**
   - `getFilteredLeadsWithCount()` currently fetches ALL within-radius leads with no SQL LIMIT
   - Add SQL LIMIT + COUNT query for total
   - `getFilteredLeads()` already has FETCH_MULTIPLIER but can be tightened

2. **PostGIS spatial index:**
   - `leads.location` column (geometry Point, 4326) already exists with GiST index
   - Column is never populated or queried — it's write-only
   - Populate location from lat/lng during pipeline insert
   - Replace Haversine SQL expression with `ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_meters)`
   - Dramatically faster for large datasets

3. **Cross-source deduplication:**
   - Same permit can appear on city Socrata portal AND county Socrata portal
   - Current content-hash dedup only catches exact duplicates within a source
   - Need fuzzy dedup: address + date + approximate value match across sources
   - Run as post-pipeline step similar to existing deduplicateNewLeads()

4. **Dashboard < 3 seconds:**
   - Combine SQL LIMIT + PostGIS for fast queries
   - Consider short-TTL caching on API routes if needed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/leads/queries.ts` — getFilteredLeadsCursor(), getFilteredLeadsWithCount(), getFilteredLeads()
- `src/lib/scraper/dedup.ts` — deduplicateNewLeads(), isLikelyDuplicate()
- `src/lib/db/schema/leads.ts` — leads table with location column and GiST index

### Established Patterns
- Haversine distance computed as SQL expression in WHERE clause
- In-memory scoring after DB fetch
- FETCH_MULTIPLIER = 4 for over-fetching

### Integration Points
- `src/lib/scraper/pipeline.ts` — processRecords() inserts leads (populate location here)
- `src/lib/leads/queries.ts` — all feed queries (optimize here)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard SQL/PostGIS optimization patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
