# Phase 3: Lead Intelligence and Dashboard - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Equipment inference engine, lead scoring, timeline mapping, filterable daily feed dashboard, and lead detail view. This is the first user-facing feature beyond auth/onboarding — sales reps open the app and see actionable leads. No lead status tracking, saved searches, or notifications (Phase 5). No multi-source dedup (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation decisions for this phase are at Claude's discretion. User requested autonomous execution with no consultation. The following guidelines apply:

- **Dashboard layout**: Clean, scannable card-based daily feed — optimized for a sales rep quickly scanning leads each morning. Sort by recency and relevance score
- **Freshness indicators**: Badge system — "New" (today), "This Week" (2-7 days), "Older" (7+ days) based on `scrapedAt` timestamp
- **Equipment inference**: Rule-based mapping from project type/description keywords to equipment categories (e.g., "excavation" → Excavators, "roofing" → Boom Lifts). Use the same equipment type taxonomy from onboarding
- **Lead scoring**: Score 0-100 based on: equipment type match with dealer profile (primary factor), geographic distance from dealer HQ (secondary), project value if available (tertiary). Higher score = more relevant to this specific dealer
- **Timeline mapping**: Map construction project phases to equipment-need windows (e.g., "Site Prep" phase → excavators/bulldozers needed now, "Framing" → cranes/boom lifts needed soon, "Finishing" → aerial platforms needed later)
- **Equipment type filter**: Multi-select filter defaulting to show-all, matching the equipment categories from onboarding. Filter by what equipment the lead needs, not what the dealer sells
- **Geographic filter**: Radius slider from company HQ (10-500 miles), defaulting to the dealer's configured service radius
- **Lead detail view**: Full project info, map with pin at geocoded location, key contacts (applicant/contractor name from permit), estimated equipment needs with timeline, source attribution with link to original permit
- **Empty states**: Friendly messaging when no leads match filters, with suggestions to adjust filter criteria
- **Data flow**: Query leads table, filter by geography (radius from HQ lat/lng), enrich with equipment inference and scoring at query time or via background job

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly requested autonomous execution with full Claude discretion.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/schema/leads.ts`: Leads table with lat/lng, projectType, description, contractorName — all needed for inference and display
- `src/lib/db/index.ts`: Drizzle ORM client
- `src/lib/geocoding.ts`: Geocoding utility — could be reused for map display coordinates
- `src/lib/db/schema/company-profiles.ts`: Company profile with equipmentTypes, hqLat, hqLng, serviceRadiusMiles — needed for scoring and filtering
- shadcn/ui components: Card, Badge, Button, Select, etc. already initialized
- Better Auth session: `auth.api.getSession()` pattern for getting active org and scoping queries

### Established Patterns
- Server Components for data fetching (dashboard layout pattern from Phase 1)
- Server Actions for mutations
- Zod validation for data schemas
- Tenant-scoped queries via `activeOrganizationId` from session

### Integration Points
- Dashboard page at `src/app/(dashboard)/dashboard/page.tsx` exists as placeholder — replace with lead feed
- Leads table provides raw data; equipment inference and scoring layer sits between DB and UI
- Company profile provides dealer's equipment types and HQ location for personalized scoring
- Navigation in dashboard layout needs "Leads" as primary nav item

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-lead-intelligence-and-dashboard*
*Context gathered: 2026-03-14*
