# Phase 3: Lead Intelligence and Dashboard - Research

**Researched:** 2026-03-14
**Domain:** Equipment inference engine, lead scoring, geographic filtering, filterable dashboard UI, map integration
**Confidence:** HIGH

## Summary

This phase builds the first user-facing feature: a daily lead feed where sales reps see scored, filtered construction project leads with inferred equipment needs. The technical surface spans four domains: (1) a rule-based equipment inference engine mapping project types/descriptions to equipment categories, (2) a lead scoring algorithm combining equipment match, geographic distance, and project value, (3) a server-rendered dashboard with URL-based filter state for equipment type and geographic radius, and (4) a lead detail view with map pin and timeline.

The existing codebase provides strong foundations -- the leads table already has lat/lng, projectType, description, and applicantName fields. The company_profiles table has equipmentTypes, hqLat, hqLng, and serviceRadiusMiles. The established EQUIPMENT_TYPES constant (12 categories) in `src/types/index.ts` provides the shared taxonomy. Drizzle ORM's `sql` template tag enables Haversine distance calculations directly in PostgreSQL without PostGIS. The dashboard layout, auth guards, and tenant-scoping patterns are already in place from Phase 1.

The primary architectural decision is keeping the inference and scoring logic as pure TypeScript functions in a `src/lib/leads/` module, computed at query time for MVP volumes (<100k records). This avoids premature optimization (materialized columns, background jobs) while remaining easy to refactor if performance demands it later. Filter state lives in URL search params for shareability and server-component compatibility.

**Primary recommendation:** Build equipment inference and lead scoring as pure functions in `src/lib/leads/`, use Drizzle's `sql` template for Haversine geo-filtering at the DB level, manage filter state via native Next.js searchParams (no new dependencies for URL state), and use `@vis.gl/react-google-maps` for the detail view map.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation decisions are at Claude's discretion. No locked decisions from user.

### Claude's Discretion
- **Dashboard layout**: Clean, scannable card-based daily feed -- optimized for a sales rep quickly scanning leads each morning. Sort by recency and relevance score
- **Freshness indicators**: Badge system -- "New" (today), "This Week" (2-7 days), "Older" (7+ days) based on `scrapedAt` timestamp
- **Equipment inference**: Rule-based mapping from project type/description keywords to equipment categories (e.g., "excavation" -> Excavators, "roofing" -> Boom Lifts). Use the same equipment type taxonomy from onboarding
- **Lead scoring**: Score 0-100 based on: equipment type match with dealer profile (primary factor), geographic distance from dealer HQ (secondary), project value if available (tertiary). Higher score = more relevant to this specific dealer
- **Timeline mapping**: Map construction project phases to equipment-need windows (e.g., "Site Prep" phase -> excavators/bulldozers needed now, "Framing" -> cranes/boom lifts needed soon, "Finishing" -> aerial platforms needed later)
- **Equipment type filter**: Multi-select filter defaulting to show-all, matching the equipment categories from onboarding. Filter by what equipment the lead needs, not what the dealer sells
- **Geographic filter**: Radius slider from company HQ (10-500 miles), defaulting to the dealer's configured service radius
- **Lead detail view**: Full project info, map with pin at geocoded location, key contacts (applicant/contractor name from permit), estimated equipment needs with timeline, source attribution with link to original permit
- **Empty states**: Friendly messaging when no leads match filters, with suggestions to adjust filter criteria
- **Data flow**: Query leads table, filter by geography (radius from HQ lat/lng), enrich with equipment inference and scoring at query time or via background job

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAD-01 | System infers equipment needs from project type and description (rule-based mapping) | Equipment inference engine: keyword-to-category mapping using shared EQUIPMENT_TYPES taxonomy, pure function in `src/lib/leads/equipment-inference.ts` |
| LEAD-02 | System scores leads by relevance to dealer's configured equipment types and service radius | Lead scoring function: weighted formula (equipment match 50%, geo distance 30%, project value 20%), pure function in `src/lib/leads/scoring.ts` |
| LEAD-03 | System maps project phase to equipment-need timeline windows | Timeline mapping: project phase detection from description keywords, mapped to equipment-need urgency (Now/Soon/Later), constant mapping in `src/lib/leads/timeline.ts` |
| LEAD-04 | Lead detail view shows project info, location on map, key contacts, estimated equipment needs, source attribution | Detail page at `/dashboard/leads/[id]` using `@vis.gl/react-google-maps` for map, server component data fetching |
| LEAD-05 | User can filter leads by equipment type with show-all default | Multi-select equipment filter using URL searchParams, checkboxes matching EQUIPMENT_TYPES taxonomy |
| LEAD-06 | User can filter leads by geographic radius from company HQ | Haversine distance formula in PostgreSQL via Drizzle `sql` template, radius slider 10-500mi defaulting to company serviceRadiusMiles |
| UX-01 | User sees a daily lead feed dashboard with fresh leads sorted by recency and relevance | Dashboard page replacing current placeholder, server component with sorted query, pagination |
| UX-05 | Leads display freshness indicators (discovered date, age badges: New, This Week, Older) | Badge component with conditional styling based on scrapedAt timestamp age calculation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, Server Components | Already installed; async searchParams for filter state |
| Drizzle ORM | 0.45.1 | Database queries with `sql` template for Haversine | Already installed; enables raw SQL for geo calculations |
| @vis.gl/react-google-maps | latest | Map component for lead detail view | Official Google-maintained React wrapper, supports AdvancedMarker with mapId |
| shadcn/ui (Badge, Select, Slider, Skeleton) | v4 | Filter controls, freshness badges, loading states | Already initialized in project; add missing components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.6 | Validation of filter params, inference rules | Already installed; validate searchParams before DB query |
| lucide-react | 0.577.0 | Icons for cards, filters, empty states | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native searchParams | nuqs | nuqs adds type-safe URL state with parsers and caching, but adds a dependency for only 2 filters. Native searchParams is simpler and sufficient for this phase. Revisit if filter complexity grows in Phase 5. |
| @vis.gl/react-google-maps | Google Maps Static API (iframe) | Static is simpler but not interactive. Detail view benefits from zoom/pan. @vis.gl is official Google library with small footprint. |
| @vis.gl/react-google-maps | @react-google-maps/api | @react-google-maps/api is older community library. @vis.gl is Google's official React wrapper (maintained by vis.gl team with Google sponsorship). |
| Query-time inference | Background job / materialized columns | Background job adds complexity; query-time is fine for MVP volumes. Refactor path is clear if needed later. |

**Installation:**
```bash
npm install @vis.gl/react-google-maps
npx shadcn@latest add badge select slider skeleton
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    leads/
      equipment-inference.ts   # Rule-based project type -> equipment mapping
      scoring.ts               # Lead relevance scoring (0-100)
      timeline.ts              # Project phase -> equipment timeline windows
      queries.ts               # Drizzle queries: filtered feed, detail, Haversine
      types.ts                 # Shared types for enriched leads
  app/
    (dashboard)/
      dashboard/
        page.tsx               # Lead feed (replace placeholder) - Server Component
        lead-filters.tsx       # Client component: equipment + radius filters
        lead-card.tsx           # Server component: individual lead card
        lead-card-skeleton.tsx  # Loading skeleton for Suspense
        leads/
          [id]/
            page.tsx           # Lead detail view - Server Component
            lead-map.tsx       # Client component: Google Map with marker
            lead-timeline.tsx  # Equipment need timeline display
  types/
    index.ts                   # Add enriched lead types alongside EQUIPMENT_TYPES
```

### Pattern 1: Haversine Distance Filtering in Drizzle
**What:** Calculate geographic distance between lead coordinates and dealer HQ using the Haversine formula directly in PostgreSQL, avoiding PostGIS dependency.
**When to use:** Every lead feed query when geographic filtering is active.
**Example:**
```typescript
// Source: Drizzle docs (sql template) + PostgreSQL math functions
import { sql } from "drizzle-orm";
import { leads } from "@/lib/db/schema/leads";

// Earth radius in miles = 3959
function haversineDistance(hqLat: number, hqLng: number) {
  return sql<number>`
    3959 * acos(
      cos(radians(${hqLat}))
      * cos(radians(${leads.lat}))
      * cos(radians(${leads.lng}) - radians(${hqLng}))
      + sin(radians(${hqLat}))
      * sin(radians(${leads.lat}))
    )
  `.mapWith(Number);
}

// Usage in query:
const distance = haversineDistance(profile.hqLat, profile.hqLng);
const results = await db
  .select({
    ...getTableColumns(leads),
    distance,
  })
  .from(leads)
  .where(sql`${distance} <= ${radiusMiles}`)
  .orderBy(sql`${distance} ASC`);
```

**CRITICAL NOTE:** The Haversine WHERE clause cannot reference a SELECT alias directly in PostgreSQL. You must either: (a) repeat the full expression in the WHERE clause, or (b) use a CTE/subquery. Option (a) is simpler for MVP. PostgreSQL's query optimizer will not compute it twice.

### Pattern 2: URL SearchParams for Server-Side Filtering
**What:** Use Next.js async searchParams to read filter state in the server component page, passing parsed values to the database query.
**When to use:** Dashboard page to read equipment type and radius filters.
**Example:**
```typescript
// Source: Next.js 16 docs (searchParams as Promise)
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const equipmentFilter = typeof params.equipment === "string"
    ? params.equipment.split(",")
    : [];
  const radius = params.radius ? Number(params.radius) : undefined;

  // Pass to query function
  const leads = await getFilteredLeads({
    organizationId: session.session.activeOrganizationId,
    equipmentTypes: equipmentFilter.length > 0 ? equipmentFilter : undefined,
    radiusMiles: radius,
  });
}
```

### Pattern 3: Client-Side Filter Controls with router.push
**What:** Client component with filter UI that updates URL search params using `useRouter().push()` or `useRouter().replace()`, triggering a server re-render.
**When to use:** Equipment type checkboxes and radius slider.
**Example:**
```typescript
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function LeadFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function updateFilters(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }
}
```

### Pattern 4: Equipment Inference as Pure Function
**What:** A stateless function that takes project type + description and returns an array of inferred equipment categories from the EQUIPMENT_TYPES taxonomy.
**When to use:** Called per-lead during feed query enrichment.
**Example:**
```typescript
import { EQUIPMENT_TYPES, type EquipmentType } from "@/types";

interface InferredEquipment {
  type: EquipmentType;
  confidence: "high" | "medium" | "low";
  reason: string;
}

function inferEquipmentNeeds(
  projectType: string | null,
  description: string | null
): InferredEquipment[] {
  // Match against keyword rules
  // Return sorted by confidence
}
```

### Anti-Patterns to Avoid
- **Computing Haversine in JavaScript:** Never fetch all leads and filter in JS. Always push geo-filtering to the database. Even 10k leads would be slow and wasteful.
- **Storing inference results prematurely:** Don't add columns to the leads table for inferred equipment at this stage. Compute at query time. The inference rules will change frequently as the product matures.
- **Using client-side state for filters:** Don't use useState for filter values. URL searchParams ensure bookmarkability, shareability, and server-component compatibility. The page re-renders on the server with fresh data.
- **Blocking page render on map load:** The map is a heavy client component (~240KB JS). Use dynamic import or place it below the fold in the detail view. Never load Google Maps JS on the feed page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geographic distance calculation | Custom JS distance math | PostgreSQL Haversine via Drizzle `sql` | DB-level filtering is orders of magnitude faster; avoids fetching all rows |
| Interactive map with marker | Custom canvas/SVG map | `@vis.gl/react-google-maps` (Map + AdvancedMarker + Pin) | Google Maps handles tiles, zoom, pan, mobile gestures; ~5 lines of code |
| URL state management | Custom parse/serialize for searchParams | URLSearchParams API (native) | Built into the browser; handles encoding, multiple values, edge cases |
| Badge/tag UI components | Custom styled spans | shadcn/ui Badge component | Accessible, themed, variant system built-in |
| Slider component | Custom range input | shadcn/ui Slider (Radix) | Accessible, keyboard navigable, customizable styling |
| Loading skeletons | Custom animated divs | shadcn/ui Skeleton component | Consistent pulse animation, composable with card layouts |

**Key insight:** This phase is primarily about business logic (inference rules, scoring algorithm, timeline mapping) wrapped in standard UI patterns. The technical infrastructure (geo queries, maps, filters) should use existing solutions so development time is spent on the domain-specific logic that makes HeavyLeads valuable.

## Common Pitfalls

### Pitfall 1: Haversine NaN for NULL Coordinates
**What goes wrong:** The Haversine formula returns NaN/NULL when either the lead's lat/lng or the dealer's HQ lat/lng is NULL, which can silently exclude valid leads or crash the query.
**Why it happens:** Some leads fail geocoding (stored with NULL lat/lng). The `acos()` function produces NaN for NULL inputs.
**How to avoid:** Add a `WHERE leads.lat IS NOT NULL AND leads.lng IS NOT NULL` guard before the Haversine calculation. Also validate that company profile has hqLat/hqLng before running geo-filtered queries.
**Warning signs:** Dashboard shows fewer leads than expected; empty feed despite seeded data.

### Pitfall 2: Haversine acos Domain Error
**What goes wrong:** Due to floating-point precision, the argument to `acos()` can exceed the [-1, 1] range, producing NaN.
**Why it happens:** Very small distances (same point) or floating-point rounding errors.
**How to avoid:** Wrap the acos argument with `LEAST(1.0, GREATEST(-1.0, ...))` to clamp the value.
**Warning signs:** Random leads returning NULL distance.

### Pitfall 3: Equipment Inference Returns Empty for Unknown Project Types
**What goes wrong:** Permit data has highly variable projectType values (e.g., "BLDG-COM", "Residential Remodel", "New Construction"). A strict keyword match misses many leads.
**Why it happens:** Every municipality uses different permit type taxonomies.
**How to avoid:** Use fuzzy/inclusive keyword matching. Match against both projectType AND description fields. Include a fallback "General Construction" catch-all that maps to common equipment. Log unmatched project types for iterative rule improvement.
**Warning signs:** High percentage of leads with zero inferred equipment.

### Pitfall 4: Slider onChange Fires Too Frequently
**What goes wrong:** Radius slider triggers a server re-render on every pixel of drag, causing excessive network requests and UI jank.
**Why it happens:** The Radix Slider fires `onValueChange` continuously during drag.
**How to avoid:** Use `onValueCommit` (fires on pointer release) instead of `onValueChange` for the URL update. Show the current value visually during drag using local state, but only update the URL on commit.
**Warning signs:** Dashboard flickers/reloads constantly while dragging slider.

### Pitfall 5: searchParams Type Mismatch in Next.js 16
**What goes wrong:** Code treats searchParams as a synchronous object instead of a Promise, causing runtime errors.
**Why it happens:** Next.js 15+ changed searchParams to be async (Promise). Many tutorials and examples still show the old synchronous pattern.
**How to avoid:** Always `await searchParams` in async server components. In client components, use `useSearchParams()` hook (which is synchronous).
**Warning signs:** TypeScript errors about Promise; "Cannot read properties of undefined" at runtime.

### Pitfall 6: Google Maps API Key Exposure
**What goes wrong:** The Maps JavaScript API key is exposed in client-side bundle, which is expected but must be restricted.
**Why it happens:** Unlike server-side geocoding, the Maps JS API runs in the browser and requires a client-visible key.
**How to avoid:** Use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for the client-side map. Restrict the key in Google Cloud Console to HTTP referrers (your domain) and Maps JavaScript API only. Keep the server-side `GOOGLE_MAPS_API_KEY` (already used for geocoding) separate and restricted to Geocoding API.
**Warning signs:** Billing alerts from Google; key usage from unknown referrers.

## Code Examples

### Haversine Distance Query with Drizzle
```typescript
// Source: PostgreSQL math functions + Drizzle sql template
// https://orm.drizzle.team/docs/sql
import { sql, getTableColumns, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";

export async function getLeadsWithinRadius(
  hqLat: number,
  hqLng: number,
  radiusMiles: number,
  limit = 50,
  offset = 0
) {
  const distanceExpr = sql<number>`
    3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${hqLat}))
        * cos(radians(${leads.lat}))
        * cos(radians(${leads.lng}) - radians(${hqLng}))
        + sin(radians(${hqLat}))
        * sin(radians(${leads.lat}))
      ))
    )
  `.mapWith(Number);

  return db
    .select({
      ...getTableColumns(leads),
      distance: distanceExpr,
    })
    .from(leads)
    .where(
      and(
        isNotNull(leads.lat),
        isNotNull(leads.lng),
        sql`3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${hqLat}))
            * cos(radians(${leads.lat}))
            * cos(radians(${leads.lng}) - radians(${hqLng}))
            + sin(radians(${hqLat}))
            * sin(radians(${leads.lat}))
          ))
        ) <= ${radiusMiles}`
      )
    )
    .orderBy(sql`${leads.scrapedAt} DESC`)
    .limit(limit)
    .offset(offset);
}
```

### Equipment Inference Rule Structure
```typescript
// Source: Domain knowledge + EQUIPMENT_TYPES from src/types/index.ts
import type { EquipmentType } from "@/types";

interface InferenceRule {
  keywords: string[];
  equipment: EquipmentType[];
  phase?: string;
}

// Rules matched against projectType + description (case-insensitive)
const INFERENCE_RULES: InferenceRule[] = [
  {
    keywords: ["excavat", "earthwork", "grading", "site prep", "demolition", "trenching"],
    equipment: ["Excavators", "Bulldozers", "Compactors"],
    phase: "Site Preparation",
  },
  {
    keywords: ["foundation", "concrete", "footing", "slab"],
    equipment: ["Excavators", "Backhoes", "Compactors"],
    phase: "Foundation",
  },
  {
    keywords: ["framing", "structural", "steel", "erect"],
    equipment: ["Cranes", "Boom Lifts", "Forklifts"],
    phase: "Framing/Structural",
  },
  {
    keywords: ["roofing", "roof", "exterior", "facade", "siding"],
    equipment: ["Boom Lifts", "Aerial Work Platforms", "Cranes"],
    phase: "Exterior/Roofing",
  },
  {
    keywords: ["interior", "finish", "drywall", "painting", "hvac", "plumbing", "electrical"],
    equipment: ["Aerial Work Platforms", "Forklifts", "Telehandlers"],
    phase: "Interior Finishing",
  },
  {
    keywords: ["paving", "asphalt", "road", "parking"],
    equipment: ["Compactors", "Bulldozers", "Wheel Loaders"],
    phase: "Paving/Roadwork",
  },
  {
    keywords: ["landscap", "grade", "backfill"],
    equipment: ["Skid Steers", "Excavators", "Wheel Loaders"],
    phase: "Landscaping",
  },
  {
    keywords: ["commercial", "warehouse", "industrial", "office"],
    equipment: ["Cranes", "Boom Lifts", "Telehandlers", "Forklifts"],
    phase: "Commercial Construction",
  },
  {
    keywords: ["residential", "house", "dwelling", "apartment", "condo"],
    equipment: ["Excavators", "Skid Steers", "Telehandlers"],
    phase: "Residential Construction",
  },
  {
    keywords: ["generator", "power", "temporary"],
    equipment: ["Generators"],
  },
];
```

### Lead Scoring Formula
```typescript
// Score 0-100 based on weighted factors
interface ScoringInput {
  inferredEquipment: EquipmentType[];
  dealerEquipment: string[];
  distanceMiles: number;
  serviceRadiusMiles: number;
  estimatedValue: number | null;
}

function scoreLead(input: ScoringInput): number {
  // Equipment match: 50 points max
  const matchCount = input.inferredEquipment.filter(
    (e) => input.dealerEquipment.includes(e)
  ).length;
  const equipmentScore = input.inferredEquipment.length > 0
    ? (matchCount / input.inferredEquipment.length) * 50
    : 0;

  // Geographic proximity: 30 points max (linear decay within service radius)
  const geoScore = input.distanceMiles <= input.serviceRadiusMiles
    ? (1 - input.distanceMiles / input.serviceRadiusMiles) * 30
    : 0;

  // Project value: 20 points max (logarithmic scale, capped)
  let valueScore = 0;
  if (input.estimatedValue && input.estimatedValue > 0) {
    // $1M+ = full 20 points, scales down logarithmically
    valueScore = Math.min(20, (Math.log10(input.estimatedValue) / 6) * 20);
  }

  return Math.round(equipmentScore + geoScore + valueScore);
}
```

### Freshness Badge Logic
```typescript
// Source: CONTEXT.md decisions
type FreshnessBadge = "New" | "This Week" | "Older";

function getFreshnessBadge(scrapedAt: Date): FreshnessBadge {
  const now = new Date();
  const diffMs = now.getTime() - scrapedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "New";
  if (diffDays <= 7) return "This Week";
  return "Older";
}
```

### Google Maps Detail View Component
```typescript
// Source: @vis.gl/react-google-maps docs
// https://visgl.github.io/react-google-maps/docs/api-reference/components/advanced-marker
"use client";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

interface LeadMapProps {
  lat: number;
  lng: number;
  title: string;
}

export function LeadMap({ lat, lng, title }: LeadMapProps) {
  const position = { lat, lng };
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        defaultCenter={position}
        defaultZoom={14}
        mapId="lead-detail-map"
        className="h-[300px] w-full rounded-lg"
      >
        <AdvancedMarker position={position} title={title}>
          <Pin background="#0f9d58" borderColor="#006425" glyphColor="#60d98f" />
        </AdvancedMarker>
      </Map>
    </APIProvider>
  );
}
```

### Timeline Window Mapping
```typescript
// Equipment-need urgency based on detected project phase
type TimelineUrgency = "Now" | "Soon" | "Later";

interface TimelineWindow {
  phase: string;
  equipment: EquipmentType[];
  urgency: TimelineUrgency;
  description: string;
}

// Map detected project phases to equipment timeline
const PHASE_TIMELINE: Record<string, { urgency: TimelineUrgency; description: string }> = {
  "Site Preparation": { urgency: "Now", description: "Equipment needed immediately for site work" },
  "Foundation": { urgency: "Now", description: "Equipment needed for foundation work" },
  "Framing/Structural": { urgency: "Soon", description: "Equipment needed once framing begins" },
  "Exterior/Roofing": { urgency: "Soon", description: "Equipment needed for exterior work" },
  "Interior Finishing": { urgency: "Later", description: "Equipment needed during finish phase" },
  "Paving/Roadwork": { urgency: "Now", description: "Equipment needed for paving operations" },
  "Commercial Construction": { urgency: "Now", description: "Equipment needed throughout project" },
  "Residential Construction": { urgency: "Now", description: "Equipment needed for build" },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostGIS for geo queries | Haversine on plain real columns | Project decision (Phase 02-01) | Avoids Neon driver compatibility unknowns; sufficient for MVP |
| @react-google-maps/api | @vis.gl/react-google-maps | 2023+ | Google-maintained; better React 19/Server Component compat |
| Synchronous searchParams | Async searchParams (Promise) | Next.js 15+ | Must `await searchParams` in server components |
| shadcn/ui v3 toast | sonner (shadcn v4) | Project decision (Phase 01-01) | Already using sonner |
| Zod v3 coerce | Zod v4 (different coerce API) | Project decision (Phase 01-02) | Use valueAsNumber on inputs, not z.coerce |

**Deprecated/outdated:**
- `@react-google-maps/api`: Community library, not Google-maintained. Use `@vis.gl/react-google-maps` instead.
- Synchronous `searchParams` in Next.js page props: Deprecated since Next.js 15; will be removed. Always use `await searchParams`.

## Open Questions

1. **Google Maps API key for client-side**
   - What we know: The project already has `GOOGLE_MAPS_API_KEY` for server-side geocoding. Client-side Maps JS API requires a separate `NEXT_PUBLIC_` prefixed key (or the same key with broader restrictions).
   - What's unclear: Whether the existing key has Maps JavaScript API enabled, or if a separate restricted key is needed.
   - Recommendation: Use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var. If not set, hide the map and show a static address instead. Document the setup requirement.

2. **Google Maps mapId requirement**
   - What we know: AdvancedMarker requires a Cloud Map ID (cloud-based map styling). Without it, the marker component fails silently.
   - What's unclear: Whether the user has created a Map ID in Google Cloud Console.
   - Recommendation: Use `"DEMO_MAP_ID"` for development (Google provides this). Document that production requires creating a Cloud Map ID. Fall back gracefully if mapId is not configured.

3. **Permit projectType taxonomy variance**
   - What we know: Dallas uses "permit_type", Austin uses "permit_type_desc", Atlanta uses "permit_type" -- all with different value sets.
   - What's unclear: The full range of projectType values across jurisdictions.
   - Recommendation: Build inference rules to be inclusive (match substrings, case-insensitive). Log unmatched types for iterative improvement. Include a "General Construction" fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAD-01 | Equipment inference maps project types to equipment categories | unit | `npx vitest run tests/leads/equipment-inference.test.ts -x` | No - Wave 0 |
| LEAD-02 | Lead scoring produces 0-100 score based on equipment match, distance, value | unit | `npx vitest run tests/leads/scoring.test.ts -x` | No - Wave 0 |
| LEAD-03 | Timeline mapping assigns urgency windows to equipment needs | unit | `npx vitest run tests/leads/timeline.test.ts -x` | No - Wave 0 |
| LEAD-04 | Lead detail page renders project info, map, contacts, equipment, source | smoke | `npx vitest run tests/leads/detail-view.test.tsx -x` | No - Wave 0 |
| LEAD-05 | Equipment filter narrows leads by inferred equipment type | unit | `npx vitest run tests/leads/filtering.test.ts -x` | No - Wave 0 |
| LEAD-06 | Geographic filter narrows leads by Haversine distance from HQ | unit | `npx vitest run tests/leads/geo-filter.test.ts -x` | No - Wave 0 |
| UX-01 | Dashboard renders lead feed sorted by recency and relevance | smoke | `npx vitest run tests/leads/feed.test.tsx -x` | No - Wave 0 |
| UX-05 | Freshness badges display correct label based on scrapedAt age | unit | `npx vitest run tests/leads/freshness.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/leads/equipment-inference.test.ts` -- covers LEAD-01 (pure function, multiple project types, edge cases)
- [ ] `tests/leads/scoring.test.ts` -- covers LEAD-02 (weight verification, boundary values, missing data)
- [ ] `tests/leads/timeline.test.ts` -- covers LEAD-03 (phase detection, urgency mapping)
- [ ] `tests/leads/freshness.test.ts` -- covers UX-05 (badge logic for today, 3 days, 10 days)
- [ ] `tests/leads/geo-filter.test.ts` -- covers LEAD-06 (Haversine SQL expression generation, NULL handling)
- [ ] `tests/leads/filtering.test.ts` -- covers LEAD-05 (equipment type filter logic)
- [ ] `tests/leads/feed.test.tsx` -- covers UX-01 (component render smoke test)
- [ ] `tests/leads/detail-view.test.tsx` -- covers LEAD-04 (component render smoke test)
- [ ] `tests/helpers/leads.ts` -- shared test fixtures (mock leads with various project types, coordinates)

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - sql template operator](https://orm.drizzle.team/docs/sql) - Custom SQL expressions, parameterization, typing
- [Drizzle ORM - Select](https://orm.drizzle.team/docs/select) - Computed columns, getTableColumns, mapWith
- [Next.js 16 - page.js API reference](https://nextjs.org/docs/app/api-reference/file-conventions/page) - Async searchParams, PageProps helper
- [Next.js - Adding Search and Pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) - URL state for server-side filtering
- [@vis.gl/react-google-maps - AdvancedMarker](https://visgl.github.io/react-google-maps/docs/api-reference/components/advanced-marker) - Map + marker component API
- [shadcn/ui - Slider](https://ui.shadcn.com/docs/components/radix/slider) - Radix-based slider component
- [shadcn/ui - Badge](https://ui.shadcn.com/docs/components/radix/badge) - Badge component variants

### Secondary (MEDIUM confidence)
- [PostgreSQL Haversine formula gist](https://gist.github.com/carlzulauf/1724506) - Verified formula: 3959 * acos(cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + sin(radians(lat1)) * sin(radians(lat2)))
- [Drizzle + Haversine blog post](https://www.troypoulter.com/blog/calculating-the-distance-between-coordinates-with-drizzleorm-and-sqlite/) - Pattern for extras with distance, WHERE on computed column
- [nuqs docs](https://nuqs.dev/) - Evaluated and deferred; native searchParams sufficient for current scope

### Tertiary (LOW confidence)
- Equipment-to-project-type mapping rules: Based on construction industry domain knowledge from multiple sources. Rules need iteration with real permit data. Flag for validation with actual scraped data.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed or well-documented official packages
- Architecture: HIGH - Patterns follow established Next.js App Router + Drizzle conventions from Phases 1-2
- Equipment inference rules: MEDIUM - Domain-specific mapping needs validation against real permit data; rules are reasonable starting point
- Haversine implementation: HIGH - PostgreSQL math functions are standard; formula verified against multiple sources
- Pitfalls: HIGH - Based on documented PostgreSQL behavior and Next.js 16 breaking changes

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain; inference rules may need iteration sooner)
