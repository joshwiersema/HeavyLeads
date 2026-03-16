---
phase: 13-schema-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, postgis, migrations, schema, geometry]

# Dependency graph
requires:
  - phase: 09-scraper-foundation
    provides: pipeline_runs table, leads table, bookmarks table
provides:
  - organization industry column for multi-industry routing
  - organization_profiles with expanded profile columns (specializations, certifications, service types)
  - leads with contentHash dedup, applicableIndustries, valueTier, severity, deadline, PostGIS location
  - bookmarks with notes and pipelineStatus for CRM-lite workflow
  - lead_enrichments table for external data caching
  - scraper_runs table for per-adapter execution tracking
  - 9 ordered migration SQL files with journal
affects: [13-02-schema-types, 14-onboarding, 15-scoring, 16-scrapers, 17-storm-alerts]

# Tech tracking
tech-stack:
  added: [postgis-geometry-via-drizzle]
  patterns: [expand-then-contract-migrations, hand-written-sql-for-renames, backward-compat-alias-exports]

key-files:
  created:
    - src/lib/db/schema/organization-profiles.ts
    - src/lib/db/schema/lead-enrichments.ts
    - src/lib/db/schema/scraper-runs.ts
    - src/lib/db/migrations/0000_create_postgis_extension.sql
    - src/lib/db/migrations/0001_rename_company_profiles.sql
    - src/lib/db/migrations/0002_add_org_profile_columns.sql
    - src/lib/db/migrations/0003_add_org_industry.sql
    - src/lib/db/migrations/0004_add_lead_columns.sql
    - src/lib/db/migrations/0005_add_postgis_geometry.sql
    - src/lib/db/migrations/0006_add_bookmark_columns.sql
    - src/lib/db/migrations/0007_create_lead_enrichments.sql
    - src/lib/db/migrations/0008_create_scraper_runs.sql
    - src/lib/db/migrations/meta/_journal.json
    - tests/schema/schema-definitions.test.ts
  modified:
    - drizzle.config.ts
    - src/lib/db/schema/auth.ts
    - src/lib/db/schema/company-profiles.ts
    - src/lib/db/schema/leads.ts
    - src/lib/db/schema/bookmarks.ts
    - src/lib/db/schema/index.ts

key-decisions:
  - "Retained company-profiles.ts as backward-compat re-export shim to avoid breaking 30+ consumer imports"
  - "Hand-wrote all 9 migrations to prevent drizzle-kit from interpreting table rename as drop+create"
  - "PostGIS geometry uses mode xy with srid 4326 for WGS84 coordinate system"
  - "content_hash unique index uses WHERE NOT NULL to accommodate existing leads without hash"
  - "All new columns nullable or defaulted for zero-disruption to existing heavy-equipment users"

patterns-established:
  - "Backward-compat alias: when renaming schema exports, keep old file as re-export shim"
  - "Hand-written migrations for table renames: never let drizzle-kit auto-generate rename operations"
  - "PostGIS convention: x=longitude, y=latitude in ST_MakePoint and geometry mode xy"

requirements-completed: [SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, SCHM-06, SCHM-07]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 13 Plan 01: Schema Definitions Summary

**Drizzle schema expanded for multi-industry orgs, PostGIS lead locations, CRM bookmarks, lead enrichments, and per-adapter scraper tracking with 9 hand-written additive migrations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T17:11:19Z
- **Completed:** 2026-03-16T17:17:20Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN)
- **Files modified:** 20 (10 created, 10 modified/shimmed)

## Accomplishments
- Expanded organization table with industry column defaulting to heavy_equipment for backward compat
- Renamed company_profiles to organization_profiles with 7 new multi-industry columns while keeping backward-compat shim
- Added 6 new columns to leads table including PostGIS geometry(Point, 4326) with GiST spatial index and content_hash dedup index
- Added CRM-lite columns (notes, pipeline_status) to bookmarks
- Created lead_enrichments and scraper_runs tables with proper FK relationships
- Wrote 9 ordered, independently deployable migration files with zero destructive operations
- 21 schema definition tests all passing via Vitest

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Schema definition tests** - `63b82ea` (test)
2. **Task 1 (GREEN): Schema files + passing tests** - `b1f5894` (feat)
3. **Task 2: Ordered database migrations** - `db031e0` (feat)

_Note: Task 1 was TDD with RED (failing tests) and GREEN (implementation) commits_

## Files Created/Modified
- `drizzle.config.ts` - Added strict: true and verbose: true
- `src/lib/db/schema/auth.ts` - Added industry column to organization table
- `src/lib/db/schema/organization-profiles.ts` - New file: renamed table with expanded columns
- `src/lib/db/schema/company-profiles.ts` - Converted to backward-compat re-export shim
- `src/lib/db/schema/leads.ts` - Added contentHash, applicableIndustries, valueTier, severity, deadline, location (PostGIS)
- `src/lib/db/schema/bookmarks.ts` - Added notes and pipelineStatus columns
- `src/lib/db/schema/lead-enrichments.ts` - New table for external enrichment data
- `src/lib/db/schema/scraper-runs.ts` - New table for per-adapter tracking
- `src/lib/db/schema/index.ts` - Updated re-exports for new modules
- `src/lib/db/migrations/0000-0008` - 9 ordered SQL migration files
- `src/lib/db/migrations/meta/_journal.json` - Drizzle migration journal
- `tests/schema/schema-definitions.test.ts` - 21 schema validation tests

## Decisions Made
- **Backward-compat shim for company-profiles.ts:** 30+ files import `companyProfiles` from the old path. Instead of updating all consumers (scope of a later plan), kept `company-profiles.ts` as a re-export shim that points to `organization-profiles.ts`. The alias `companyProfiles = organizationProfiles` ensures all existing code works unchanged.
- **Hand-written migrations:** Table rename from company_profiles to organization_profiles would be interpreted by drizzle-kit as DROP + CREATE, destroying data. All 9 migrations are hand-written SQL with ALTER TABLE RENAME.
- **Partial unique index on content_hash:** Existing leads have no content_hash, so the unique index uses WHERE content_hash IS NOT NULL to avoid null conflicts.
- **PostGIS backfill in migration 5:** Existing lat/lng values are backfilled into the new geometry column using ST_MakePoint(lng, lat) with SRID 4326.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retained company-profiles.ts as backward-compat shim**
- **Found during:** Task 1 (Schema file updates)
- **Issue:** Plan said to delete company-profiles.ts, but 30+ files across the codebase directly import from it. Deleting would break TypeScript compilation and Next.js build.
- **Fix:** Converted company-profiles.ts to a re-export shim instead of deleting it. The new organization-profiles.ts is the canonical source, and the old file re-exports both `organizationProfiles` and `companyProfiles`.
- **Files modified:** src/lib/db/schema/company-profiles.ts
- **Verification:** `npx tsc --noEmit` shows no errors in schema files; `npx next build` succeeds
- **Committed in:** b1f5894 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed table name introspection in tests**
- **Found during:** Task 1 (Test implementation)
- **Issue:** Plan suggested `table._.name` for accessing table name, but Drizzle v0.45 uses `getTableName()` utility function instead of internal `._` property.
- **Fix:** Used `getTableName()` from `drizzle-orm` instead of accessing `._name`
- **Files modified:** tests/schema/schema-definitions.test.ts
- **Verification:** All 21 tests pass
- **Committed in:** b1f5894 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. Backward-compat shim prevents breaking existing code. API fix aligns tests with actual Drizzle API. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors exist in tests/leads/bookmarks*.test.ts and tests/leads/lead-status.test.ts (Mock type mismatches). These are unrelated to schema changes and were not introduced by this plan.

## User Setup Required
None - no external service configuration required. PostGIS extension creation is handled by migration 0000 (will need Neon to have PostGIS available when migrations are run).

## Next Phase Readiness
- Schema definitions complete and tested, ready for Plan 02 (TypeScript types and Zod validators)
- Migrations are ready to deploy but require PostGIS extension support on Neon (noted in STATE.md blockers)
- All downstream phases (onboarding, scoring, scrapers) can now reference the expanded schema

## Self-Check: PASSED

All 8 key files verified present. All 3 task commits verified in git log.

---
*Phase: 13-schema-foundation*
*Completed: 2026-03-16*
