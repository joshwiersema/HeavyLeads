# Architecture Research: v3.0 LeadForge Multi-Industry Platform

**Domain:** Multi-tenant SaaS lead generation -- multi-industry expansion
**Researched:** 2026-03-16
**Confidence:** HIGH (code analysis of 40+ source files, Vercel docs, Drizzle docs)

This document maps how 11 new features integrate with the existing Next.js App Router + Drizzle ORM + Neon PostgreSQL + Better Auth architecture. For each feature, it identifies integration points with existing code, new vs. modified components, data flow changes, and a build order that minimizes breaking changes while preserving existing data.

---

## System Overview: Current Architecture (v2.1)

```
+------------------------------------------------------------------------+
|                         CLIENT (Browser)                                |
|  +----------------+  +----------------+  +----------------+            |
|  | Auth Forms     |  | Dashboard      |  | Settings       |            |
|  | (sign-in,      |  | (leads feed,   |  | (account,      |            |
|  |  sign-up,      |  |  bookmarks,    |  |  company,      |            |
|  |  forgot-pw,    |  |  saved search, |  |  billing)      |            |
|  |  reset-pw)     |  |  lead detail)  |  |                |            |
|  +-------+--------+  +-------+--------+  +-------+--------+            |
|          |                    |                    |                     |
+----------+--------------------+--------------------+--------------------+
|                    NEXT.JS APP ROUTER (Server)                          |
|  +----------------+  +----------------+  +----------------+            |
|  | (auth)/        |  | (dashboard)/   |  | api/           |            |
|  | layout.tsx     |  | layout.tsx     |  | auth/[...all]  |            |
|  |                |  | (guards:       |  | cron/scrape    |            |
|  |                |  |  session,      |  |                |            |
|  |                |  |  onboarding,   |  |                |            |
|  |                |  |  subscription) |  |                |            |
|  +-------+--------+  +-------+--------+  +-------+--------+            |
|          |                    |                    |                     |
+----------+--------------------+--------------------+--------------------+
|                        LIB / ACTIONS LAYER                              |
|  +----------+  +----------+  +----------+  +----------+               |
|  | auth.ts  |  | leads/   |  | scraper/ |  | email/   |               |
|  | auth-    |  | queries  |  | pipeline |  | digest   |               |
|  | client   |  | scoring  |  | dedup    |  | send     |               |
|  |          |  | equip-   |  | registry |  |          |               |
|  |          |  | infer    |  | adapters |  |          |               |
|  +----+-----+  +----+-----+  +----+-----+  +----+-----+               |
|       |             |             |             |                       |
+-------+-------------+-------------+-------------+----------------------+
|                        DATA LAYER                                       |
|  +---------------------------------------------------------------+    |
|  |  Drizzle ORM (neon-http driver)                                |    |
|  |  10 tables: user, session, account, verification, organization,|    |
|  |    member, invitation, leads, lead_sources, bookmarks,         |    |
|  |    lead_statuses, saved_searches, company_profiles,            |    |
|  |    subscription, pipeline_runs                                 |    |
|  +-------------------------------+-------------------------------+    |
|                                  |                                     |
+----------------------------------+-------------------------------------+
|                    EXTERNAL SERVICES                                    |
|  +----------+  +----------+  +----------+  +----------+               |
|  | Neon PG  |  | Stripe   |  | Resend   |  | Google   |               |
|  |          |  |          |  |          |  | Maps API |               |
|  +----------+  +----------+  +----------+  +----------+               |
+------------------------------------------------------------------------+
```

---

## Target Architecture (v3.0)

```
+------------------------------------------------------------------------+
|                         CLIENT (Browser)                                |
|  +----------------+  +------------------+  +----------------+          |
|  | Auth Forms     |  | Dashboard        |  | Settings       |          |
|  | (unchanged)    |  | (new: filter     |  | (new: industry |          |
|  |                |  |  panel, score    |  |  profile,      |          |
|  |                |  |  badges, match   |  |  notification  |          |
|  |                |  |  reasons, storm  |  |  prefs)        |          |
|  |                |  |  alerts, cursor  |  |                |          |
|  |                |  |  pagination)     |  |                |          |
|  +-------+--------+  +-------+----------+  +-------+--------+          |
|          |                    |                      |                  |
|  +----------------+                                                    |
|  | Onboarding     |                                                    |
|  | (new: 6-step   |                                                    |
|  |  wizard with   |                                                    |
|  |  useReducer)   |                                                    |
|  +-------+--------+                                                    |
|          |                                                             |
+----------+--------------------+--------------------+-------------------+
|                    NEXT.JS APP ROUTER (Server)                          |
|  +----------------+  +----------------+  +-----------------------+     |
|  | (auth)/        |  | (dashboard)/   |  | api/                  |     |
|  | (onboarding)/  |  | layout.tsx     |  | auth/[...all]         |     |
|  |                |  |                |  | cron/scrape            |     |
|  |                |  |                |  | cron/enrichment        |     |
|  |                |  |                |  | cron/digest            |     |
|  |                |  |                |  | cron/weather           |     |
|  |                |  |                |  | cron/dedup-maintenance  |     |
|  |                |  |                |  | unsubscribe/[token]    |     |
|  +-------+--------+  +-------+--------+  +----------+-----------+     |
|          |                    |                       |                 |
+----------+--------------------+-----------------------+----------------+
|                        LIB / ACTIONS LAYER                              |
|  +----------+  +----------+  +------------+  +----------+             |
|  | auth.ts  |  | leads/   |  | scraper/   |  | email/   |             |
|  |          |  | queries  |  | pipeline   |  | digest   |             |
|  |          |  | scoring  |  | dedup      |  | storm    |             |
|  |          |  | enrich   |  | registry   |  | unsub    |             |
|  |          |  | cursor   |  | industry-  |  | react-   |             |
|  |          |  |          |  |   config   |  |   email  |             |
|  |          |  |          |  | adapters/  |  |          |             |
|  |          |  |          |  |   permits/ |  |          |             |
|  |          |  |          |  |   weather/ |  |          |             |
|  |          |  |          |  |   utility/ |  |          |             |
|  +----+-----+  +----+-----+  +-----+------+  +----+-----+             |
|       |             |              |               |                   |
+-------+-------------+--------------+---------------+-------------------+
|                        DATA LAYER                                       |
|  +---------------------------------------------------------------+    |
|  |  Drizzle ORM (neon-http driver)                                |    |
|  |  ~16 tables: (existing 10 modified) +                          |    |
|  |    organization_profiles (renamed from company_profiles),      |    |
|  |    lead_enrichments, scraper_runs,                             |    |
|  |    lead_industries (junction), unsubscribe_tokens              |    |
|  +-------------------------------+-------------------------------+    |
|                                  |                                     |
+----------------------------------+-------------------------------------+
|                    EXTERNAL SERVICES                                    |
|  +--------+ +--------+ +--------+ +--------+ +--------+ +--------+   |
|  |Neon PG | |Stripe  | |Resend  | |Google  | | NOAA   | | FEMA   |   |
|  |        | |        | |        | |Maps API| | API    | | API    |   |
|  +--------+ +--------+ +--------+ +--------+ +--------+ +--------+   |
+------------------------------------------------------------------------+
```

---

## Feature-by-Feature Integration Analysis

### 1. Database Schema Evolution

**Status: MODIFIED (5 existing tables) + NEW (3-4 new tables) + RENAMED (1 table)**

#### Current State

10 tables in `src/lib/db/schema/`:
- `auth.ts`: user, session, account, verification, organization, member, invitation
- `company-profiles.ts`: companyProfiles (organizationId, hqAddress, hqLat/Lng, serviceRadiusMiles, equipmentTypes[], onboardingCompleted)
- `leads.ts`: leads (permit/bid/news/deep-web fields, sourceType, sourceId, lat/lng)
- `lead-sources.ts`: leadSources (junction: lead <-> source)
- `lead-statuses.ts`: leadStatuses (userId, leadId, organizationId, status)
- `bookmarks.ts`: bookmarks (userId, leadId, organizationId)
- `saved-searches.ts`: savedSearches (userId, organizationId, filter params)
- `subscriptions.ts`: subscription (Better Auth Stripe plugin managed)
- `pipeline-runs.ts`: pipelineRuns (run tracking)

#### Migration Strategy

**Critical constraint:** The app is live. All migrations must be additive or use safe rename patterns. Never drop columns with data.

**Step 1: Add `industry` to `organization` table (additive)**

The `organization` table is managed by Better Auth's organization plugin. It has a `metadata` text column that could store industry, but Better Auth controls this table. The safer approach: add an `industry` column directly to the organization table via a custom Drizzle migration.

```sql
-- Migration: Add industry to organization
ALTER TABLE "organization" ADD COLUMN "industry" text;
-- Backfill existing orgs as "heavy_equipment" (the only industry v2.1 supports)
UPDATE "organization" SET "industry" = 'heavy_equipment' WHERE "industry" IS NULL;
-- Then make NOT NULL
ALTER TABLE "organization" ALTER COLUMN "industry" SET NOT NULL;
ALTER TABLE "organization" ALTER COLUMN "industry" SET DEFAULT 'heavy_equipment';
```

**Why modify `organization` instead of using metadata:** The industry field drives query-time scoring, scraper selection, and onboarding flow. It needs to be a first-class indexed column, not a JSON blob. Better Auth's `organization` table accepts custom columns via Drizzle -- the schema file just needs the column added and `drizzle-kit generate` handles the migration.

Update schema file:

| File | Change |
|------|--------|
| `src/lib/db/schema/auth.ts` | Add `industry` column to `organization` table |

**Step 2: Rename `company_profiles` to `organization_profiles` (safe rename)**

Drizzle Kit's `generate` command detects renames and asks whether the column/table was renamed or created fresh. Select "renamed" to get a safe `ALTER TABLE RENAME` migration.

```sql
ALTER TABLE "company_profiles" RENAME TO "organization_profiles";
```

Then add new columns to the renamed table:

```sql
-- New columns for multi-industry support
ALTER TABLE "organization_profiles" ADD COLUMN "specializations" text[] DEFAULT '{}';
ALTER TABLE "organization_profiles" ADD COLUMN "service_types" text[] DEFAULT '{}';
ALTER TABLE "organization_profiles" ADD COLUMN "certifications" text[] DEFAULT '{}';
ALTER TABLE "organization_profiles" ADD COLUMN "company_size" text;
ALTER TABLE "organization_profiles" ADD COLUMN "website" text;
ALTER TABLE "organization_profiles" ADD COLUMN "phone" text;
```

| File | Change |
|------|--------|
| `src/lib/db/schema/company-profiles.ts` | Rename to `organization-profiles.ts`, rename table, add columns |
| `src/lib/db/schema/index.ts` | Update export |
| `src/actions/onboarding.ts` | Update import from `companyProfiles` to `organizationProfiles` |
| `src/actions/settings.ts` | Update import |
| `src/lib/email/digest-generator.ts` | Update import |
| `src/lib/leads/pipeline-status.ts` | No change (doesn't reference company_profiles) |
| `src/types/index.ts` | Update `CompanyProfile` type alias |

**Step 3: Expand `leads` table (additive)**

```sql
ALTER TABLE "leads" ADD COLUMN "content_hash" text;
ALTER TABLE "leads" ADD COLUMN "raw_data" jsonb;
ALTER TABLE "leads" ADD COLUMN "property_type" text;
ALTER TABLE "leads" ADD COLUMN "building_sqft" integer;
ALTER TABLE "leads" ADD COLUMN "year_built" integer;
ALTER TABLE "leads" ADD COLUMN "owner_name" text;
ALTER TABLE "leads" ADD COLUMN "owner_contact" text;
-- Index for hash-based dedup
CREATE UNIQUE INDEX "leads_content_hash_idx" ON "leads" ("content_hash") WHERE "content_hash" IS NOT NULL;
```

| File | Change |
|------|--------|
| `src/lib/db/schema/leads.ts` | Add new columns, add content_hash unique index |

**Step 4: New tables**

| New Table | File | Purpose |
|-----------|------|---------|
| `lead_enrichments` | `src/lib/db/schema/lead-enrichments.ts` | Enrichment data (geocode, property, weather, incentives) stored per-lead |
| `lead_industries` | `src/lib/db/schema/lead-industries.ts` | Junction table: which industries a lead is relevant to |
| `scraper_runs` | `src/lib/db/schema/scraper-runs.ts` | Per-adapter run tracking (replaces aggregate pipeline_runs approach) |
| `unsubscribe_tokens` | `src/lib/db/schema/unsubscribe-tokens.ts` | CAN-SPAM compliant unsubscribe tokens |

**Step 5: Modify `bookmarks` table (additive)**

```sql
ALTER TABLE "bookmarks" ADD COLUMN "notes" text;
ALTER TABLE "bookmarks" ADD COLUMN "pipeline_status" text DEFAULT 'saved';
ALTER TABLE "bookmarks" ADD COLUMN "updated_at" timestamp DEFAULT now();
```

| File | Change |
|------|--------|
| `src/lib/db/schema/bookmarks.ts` | Add notes, pipeline_status, updated_at columns |

#### Migration Execution Order

1. Add `industry` to `organization` + backfill (safe, additive)
2. Rename `company_profiles` to `organization_profiles` + add columns (rename + additive)
3. Add columns to `leads` (additive)
4. Add columns to `bookmarks` (additive)
5. Create new tables (additive, no FK dependencies on steps 1-4 other than leads.id)
6. Update all import paths in application code
7. Deploy -- all changes are backward compatible

**Drizzle migration workflow:**
```bash
# 1. Update schema files
# 2. Generate migration
npx drizzle-kit generate
# 3. Review generated SQL (critical for renames -- verify ALTER TABLE RENAME, not DROP+CREATE)
# 4. Apply
npx drizzle-kit migrate
```

**Files touched:**

| File | Status | Description |
|------|--------|-------------|
| `src/lib/db/schema/auth.ts` | MODIFIED | Add industry to organization |
| `src/lib/db/schema/company-profiles.ts` | RENAMED + MODIFIED | -> organization-profiles.ts, add columns |
| `src/lib/db/schema/leads.ts` | MODIFIED | Add content_hash, raw_data, property columns |
| `src/lib/db/schema/bookmarks.ts` | MODIFIED | Add notes, pipeline_status, updated_at |
| `src/lib/db/schema/lead-enrichments.ts` | NEW | Enrichment data table |
| `src/lib/db/schema/lead-industries.ts` | NEW | Lead-industry junction |
| `src/lib/db/schema/scraper-runs.ts` | NEW | Per-adapter run tracking |
| `src/lib/db/schema/unsubscribe-tokens.ts` | NEW | Unsubscribe tokens |
| `src/lib/db/schema/index.ts` | MODIFIED | Add new exports |
| `src/types/index.ts` | MODIFIED | Update type aliases |
| `src/actions/onboarding.ts` | MODIFIED | Update table reference |
| `src/actions/settings.ts` | MODIFIED | Update table reference |
| `src/lib/email/digest-generator.ts` | MODIFIED | Update table reference |

---

### 2. Multi-Step Onboarding Wizard (6 Steps, Industry-Conditional)

**Status: MODIFIED (wizard-shell.tsx, onboarding action, validator) + NEW (3 step components, useReducer state machine)**

#### Current State

The existing wizard in `src/components/onboarding/wizard-shell.tsx` uses:
- `react-hook-form` with `zodResolver` for validation
- `useState(0)` for step tracking
- 3 steps: Location, Equipment, Radius
- Single `onboardingSchema` Zod schema validates all fields at once
- `completeOnboarding` server action writes to `companyProfiles`

The current pattern is sound for 3 steps but does not scale to 6 steps with industry-conditional rendering because:
1. `useState(0)` cannot express conditional step flows (e.g., skip equipment step for industries that don't use equipment)
2. The single Zod schema includes all fields -- industry-conditional fields require discriminated unions
3. No way to track which steps are complete vs. skipped

#### Integration: useReducer State Machine

Replace `useState(0)` with a `useReducer`-based state machine that manages step navigation, conditional step visibility, and form data accumulation.

**Why useReducer, not XState:** XState is powerful but adds a dependency and learning curve for what is ultimately a linear wizard with conditional skips. `useReducer` with TypeScript discriminated unions provides the same correctness guarantees without the dependency.

**State machine design:**

```typescript
// src/components/onboarding/wizard-state.ts

type Industry = "heavy_equipment" | "hvac" | "roofing" | "solar" | "electrical";

interface WizardState {
  currentStep: number;
  industry: Industry | null;
  completedSteps: Set<number>;
  formData: Partial<OnboardingFormData>;
  visibleSteps: StepConfig[];
}

type WizardAction =
  | { type: "SELECT_INDUSTRY"; industry: Industry }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SET_FIELD"; field: string; value: unknown }
  | { type: "SUBMIT" };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SELECT_INDUSTRY":
      return {
        ...state,
        industry: action.industry,
        visibleSteps: getStepsForIndustry(action.industry),
        formData: { ...state.formData, industry: action.industry },
      };
    case "NEXT":
      return {
        ...state,
        completedSteps: new Set([...state.completedSteps, state.currentStep]),
        currentStep: state.currentStep + 1,
      };
    // ...
  }
}
```

**Step configuration by industry:**

| Step | All Industries | Heavy Equipment | HVAC | Roofing | Solar | Electrical |
|------|---------------|-----------------|------|---------|-------|------------|
| 1. Industry Selection | YES | - | - | - | - | - |
| 2. Company Info | YES | - | - | - | - | - |
| 3. Location + Radius | YES | - | - | - | - | - |
| 4. Specializations | YES | Equipment types | HVAC systems | Roof types | Panel types | License types |
| 5. Service Types | YES | Rental/Sales/Both | Install/Repair/Both | Repair/Replace/New | Residential/Commercial | Residential/Commercial |
| 6. Confirmation | YES | - | - | - | - | - |

**Integration with react-hook-form:** Keep `react-hook-form` for field-level validation and error display. The `useReducer` manages step transitions and conditional visibility, while RHF manages field values and validation. They coexist cleanly because RHF manages form data while the reducer manages wizard navigation.

**Integration pattern:**

```typescript
// wizard-shell.tsx (modified)
const [state, dispatch] = useReducer(wizardReducer, initialState);
const methods = useForm<OnboardingFormData>({
  resolver: zodResolver(getSchemaForStep(state.currentStep, state.industry)),
  // ...
});

// Step navigation uses dispatch, field validation uses methods.trigger()
async function handleNext() {
  const valid = await methods.trigger(state.visibleSteps[state.currentStep].fields);
  if (valid) dispatch({ type: "NEXT" });
}
```

**Server action change:** The `completeOnboarding` action currently writes to `companyProfiles`. After rename, it writes to `organizationProfiles` with the expanded fields. The industry field writes to `organization.industry`.

| File | Status | Description |
|------|--------|-------------|
| `src/components/onboarding/wizard-shell.tsx` | MODIFIED | Replace useState with useReducer, add industry-conditional step logic |
| `src/components/onboarding/wizard-state.ts` | NEW | Reducer, action types, step configuration |
| `src/components/onboarding/step-industry.tsx` | NEW | Industry selection cards |
| `src/components/onboarding/step-company.tsx` | NEW | Company name, website, phone |
| `src/components/onboarding/step-specializations.tsx` | NEW | Industry-conditional specialization picker |
| `src/components/onboarding/step-service-types.tsx` | NEW | Industry-conditional service type picker |
| `src/components/onboarding/step-confirmation.tsx` | NEW | Review and confirm |
| `src/components/onboarding/step-location.tsx` | MODIFIED | Minor: may add radius inline |
| `src/components/onboarding/step-equipment.tsx` | MODIFIED | Becomes heavy_equipment specialization variant |
| `src/components/onboarding/step-radius.tsx` | MODIFIED | May merge into location step |
| `src/lib/validators/onboarding.ts` | MODIFIED | Add industry-conditional schemas using Zod discriminated unions |
| `src/actions/onboarding.ts` | MODIFIED | Write to organization.industry + organizationProfiles with expanded fields |
| `src/app/(onboarding)/onboarding/page.tsx` | MODIFIED | Minor layout adjustments |

**Data flow change:**

```
BEFORE (3 steps, single industry):
  Step 1 (Location) -> Step 2 (Equipment) -> Step 3 (Radius)
      |
      v
  completeOnboarding() -> INSERT companyProfiles

AFTER (6 steps, industry-conditional):
  Step 1 (Industry) -> determines visible steps
      |
      v
  Step 2 (Company Info) -> Step 3 (Location + Radius) ->
  Step 4 (Specializations, industry-specific) ->
  Step 5 (Service Types, industry-specific) ->
  Step 6 (Confirmation)
      |
      v
  completeOnboarding() -> UPDATE organization.industry + INSERT organizationProfiles
```

---

### 3. Scraper Registry Expansion (Industry-Mapped)

**Status: MODIFIED (registry.ts, adapters/index.ts, pipeline.ts) + NEW (industry config, adapter factory, 12+ adapters)**

#### Current State

The registry is a flat `Map<string, ScraperAdapter>`:
- `initializeAdapters()` registers all 8 adapters unconditionally
- `getRegisteredAdapters()` returns all adapters
- The cron job runs ALL adapters every time
- No concept of industry -- all adapters are "construction" focused

#### Target: Industry-Keyed Registry

```typescript
// src/lib/scraper/industry-config.ts (NEW)

export type Industry = "heavy_equipment" | "hvac" | "roofing" | "solar" | "electrical";

export interface IndustryScraperConfig {
  industry: Industry;
  adapters: ScraperAdapter[];
  /** Cron schedule for this industry's scrapers (e.g., "0 6 * * *") */
  schedule: string;
}

// Maps industry to its adapter set
export const INDUSTRY_SCRAPER_MAP: Record<Industry, () => ScraperAdapter[]> = {
  heavy_equipment: () => [
    new AustinPermitsAdapter(),
    new DallasPermitsAdapter(),
    new AtlantaPermitsAdapter(),
    new SamGovBidsAdapter(),
    new EnrNewsAdapter(),
    new ConstructionDiveNewsAdapter(),
    new PrNewswireNewsAdapter(),
    new GoogleDorkingAdapter(),
  ],
  hvac: () => [
    // Permit adapters (shared with construction, filtered by permit type)
    new PermitAdapterFactory("hvac").create(),
    new CodeViolationsAdapter("hvac"),
    new EnergyBenchmarkAdapter(),
  ],
  roofing: () => [
    new PermitAdapterFactory("roofing").create(),
    new NoaaStormAdapter(),
    new FemaDisasterAdapter(),
    new CodeViolationsAdapter("roofing"),
  ],
  solar: () => [
    new PermitAdapterFactory("solar").create(),
    new DsireIncentivesAdapter(),
    new NeviChargingAdapter(),
    new UtilityRateAdapter(),
  ],
  electrical: () => [
    new PermitAdapterFactory("electrical").create(),
    new CodeViolationsAdapter("electrical"),
  ],
};
```

#### Permit Scraper Factory

The existing permit adapters (Austin, Dallas, Atlanta) scrape ALL permits. For multi-industry, permits need to be filtered by type at the adapter level.

**Strategy: Filter, don't duplicate.** Keep the existing Socrata API adapters but add a `permitTypeFilter` parameter. Each adapter instance filters results by permit type keywords.

```typescript
// src/lib/scraper/adapters/permit-factory.ts (NEW)

export class PermitAdapterFactory {
  constructor(private industry: Industry) {}

  create(): ScraperAdapter[] {
    const filters = PERMIT_TYPE_FILTERS[this.industry];
    return PERMIT_CITIES.map(city =>
      new FilteredPermitAdapter(city, filters)
    );
  }
}

const PERMIT_TYPE_FILTERS: Record<Industry, string[]> = {
  heavy_equipment: ["commercial", "industrial", "demolition", "new construction"],
  hvac: ["mechanical", "hvac", "heating", "cooling", "furnace"],
  roofing: ["roofing", "roof", "re-roof", "shingle"],
  solar: ["solar", "photovoltaic", "pv", "electrical solar"],
  electrical: ["electrical", "wiring", "panel upgrade", "service upgrade"],
};
```

The `FilteredPermitAdapter` extends the base Socrata pattern but applies a `sourceType` filter in the `scrape()` method, either via Socrata `$where` clause (if the dataset supports it) or via post-fetch filtering.

#### Registry Modification

```typescript
// src/lib/scraper/registry.ts (MODIFIED)

// Add industry dimension
const adaptersByIndustry = new Map<Industry, Map<string, ScraperAdapter>>();

export function registerAdaptersForIndustry(
  industry: Industry,
  adapters: ScraperAdapter[]
): void {
  const industryMap = new Map<string, ScraperAdapter>();
  for (const adapter of adapters) {
    industryMap.set(adapter.sourceId, adapter);
  }
  adaptersByIndustry.set(industry, industryMap);
}

export function getAdaptersForIndustry(industry: Industry): ScraperAdapter[] {
  return Array.from(adaptersByIndustry.get(industry)?.values() ?? []);
}

// Backward compat: get ALL adapters (for global cron)
export function getAllAdapters(): ScraperAdapter[] {
  const all: ScraperAdapter[] = [];
  for (const industryMap of adaptersByIndustry.values()) {
    all.push(...industryMap.values());
  }
  return all;
}
```

#### ScraperAdapter Interface Extension

The existing `ScraperAdapter` interface needs an industry tag:

```typescript
export interface ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly jurisdiction?: string;
  readonly industries: Industry[];  // NEW: which industries this adapter serves
  scrape(): Promise<RawLeadData[]>;
}
```

Existing adapters get `industries: ["heavy_equipment"]` added. Cross-industry adapters (like permit scrapers that serve multiple industries) list all applicable industries.

| File | Status | Description |
|------|--------|-------------|
| `src/lib/scraper/registry.ts` | MODIFIED | Add industry dimension |
| `src/lib/scraper/adapters/base-adapter.ts` | MODIFIED | Add `industries` to ScraperAdapter interface |
| `src/lib/scraper/industry-config.ts` | NEW | Industry-to-adapter mapping |
| `src/lib/scraper/adapters/permit-factory.ts` | NEW | Parameterized permit adapter factory |
| `src/lib/scraper/adapters/index.ts` | MODIFIED | Use industry config for initialization |
| `src/lib/scraper/adapters/austin-permits.ts` | MODIFIED | Add `industries` field, accept optional type filter |
| `src/lib/scraper/adapters/dallas-permits.ts` | MODIFIED | Same |
| `src/lib/scraper/adapters/atlanta-permits.ts` | MODIFIED | Same |
| `src/lib/scraper/adapters/sam-gov-bids.ts` | MODIFIED | Add `industries` field |
| `src/lib/scraper/adapters/noaa-storms.ts` | NEW | NOAA weather alerts adapter |
| `src/lib/scraper/adapters/fema-disaster.ts` | NEW | FEMA disaster declarations |
| `src/lib/scraper/adapters/code-violations.ts` | NEW | Parameterized code violation adapter |
| `src/lib/scraper/adapters/energy-benchmark.ts` | NEW | Energy benchmarking data |
| `src/lib/scraper/adapters/dsire-incentives.ts` | NEW | DSIRE solar incentives |
| `src/lib/scraper/adapters/nevi-charging.ts` | NEW | NEVI EV charging stations |
| `src/lib/scraper/adapters/utility-rates.ts` | NEW | Utility rate data |
| `src/lib/scraper/pipeline.ts` | MODIFIED | Accept industry parameter, pass to registry |

---

### 4. Query-Time Scoring Engine (5 Dimensions)

**Status: MODIFIED (scoring.ts, queries.ts, types.ts) + NEW (score engine, match reasons)**

#### Current State

`scoreLead()` in `src/lib/leads/scoring.ts` computes a 0-100 score with 3 factors:
- Equipment match: 50 points max (ratio of inferred vs. dealer equipment)
- Geographic proximity: 30 points max (linear decay)
- Project value: 20 points max (logarithmic scale)

Called at query time in `getFilteredLeads()` and `getFilteredLeadsWithCount()` -- already computed per subscriber. This is the correct architecture for multi-industry scoring.

#### Target: 5-Dimension Score

| Dimension | Weight | Description | Computation |
|-----------|--------|-------------|-------------|
| Distance | 25 pts | Geographic proximity to HQ | Same Haversine as now, linear decay |
| Relevance | 30 pts | Industry-specific keyword/type match | Replaces equipment match for non-heavy-equipment |
| Value | 15 pts | Estimated project value | Same logarithmic scale |
| Freshness | 15 pts | How recently the lead was discovered | Exponential decay from scrapedAt |
| Urgency | 15 pts | Time-sensitive signals (deadlines, storms, expiring incentives) | Deadline proximity, weather event recency |

**Integration with existing code:**

```typescript
// src/lib/leads/scoring.ts (MODIFIED)

export interface ScoringInput {
  // Existing
  distanceMiles: number;
  serviceRadiusMiles: number;
  estimatedValue: number | null;
  // Modified
  relevanceFactors: RelevanceInput;  // replaces inferredEquipment + dealerEquipment
  // New
  scrapedAt: Date;
  deadlineDate: Date | null;
  urgencySignals: UrgencySignal[];
}

export interface RelevanceInput {
  industry: Industry;
  /** For heavy_equipment: equipment match ratio */
  equipmentMatch?: { inferred: string[]; dealer: string[] };
  /** For all industries: specialization overlap */
  specializationMatch?: { leadSpecs: string[]; profileSpecs: string[] };
  /** Keyword relevance score from text analysis */
  keywordRelevance?: number;
}

export interface UrgencySignal {
  type: "deadline" | "storm" | "incentive_expiry" | "permit_expiry";
  date: Date;
  weight: number;  // 0-1 multiplier
}
```

The `scoreLead()` function signature changes but the call sites remain the same -- `getFilteredLeads()` and `getFilteredLeadsWithCount()` already call `scoreLead()` inline during enrichment. The change is in what data is passed and how the score is computed.

**Match reasons:** Add a `matchReasons` field to `EnrichedLead` so the UI can show WHY a lead scored highly:

```typescript
export interface MatchReason {
  dimension: "distance" | "relevance" | "value" | "freshness" | "urgency";
  points: number;
  label: string;  // e.g., "12 miles from HQ", "Matches 3 of 4 specializations"
}
```

| File | Status | Description |
|------|--------|-------------|
| `src/lib/leads/scoring.ts` | MODIFIED | 5-dimension scoring, match reasons |
| `src/lib/leads/types.ts` | MODIFIED | Add ScoringInput changes, MatchReason, UrgencySignal |
| `src/lib/leads/queries.ts` | MODIFIED | Pass new scoring inputs (industry, urgency signals) |
| `src/lib/leads/equipment-inference.ts` | MODIFIED | Generalize to industry-specific relevance inference |
| `src/lib/leads/relevance-inference.ts` | NEW | Industry-specific relevance rules (extends equipment-inference pattern) |

**Data flow change:**

```
BEFORE:
  getFilteredLeads() -> inferEquipmentNeeds() -> scoreLead({ inferredEquipment, dealerEquipment, distance, ... })

AFTER:
  getFilteredLeads() -> inferRelevance(industry, lead) -> scoreLead({ relevanceFactors, distance, freshness, urgency, ... })
      |
      v
  Returns EnrichedLead with score + matchReasons[]
```

**Backward compatibility:** Heavy equipment industry retains the equipment match as the primary relevance factor. The `inferEquipmentNeeds()` function is not removed -- it becomes the heavy_equipment implementation of relevance inference. The new `inferRelevance()` function dispatches to industry-specific inference based on the organization's industry.

---

### 5. Cursor-Based Pagination

**Status: MODIFIED (queries.ts, dashboard page) + MODIFIED (pagination component)**

#### Current State

`getFilteredLeadsWithCount()` fetches ALL within-radius leads, enriches them all in memory, sorts by score, then slices a page. This is the pagination approach from Phase 10.

#### Why Cursor Over Offset for v3.0

The v2.1 REQUIREMENTS.md explicitly lists "Cursor-based pagination" as out of scope with rationale "Offset pagination sufficient for current data volumes." The v3.0 PROJECT.md reverses this decision because:

1. Multi-industry = significantly more leads (5x industries = potentially 5x lead volume)
2. Score-based sorting + offset = inconsistent pages (lead scores change per subscriber, offset-based pages shift)
3. Cursor-based is more natural for infinite scroll UX patterns

#### Cursor Design

Use a **composite cursor** of `(score, scrapedAt, id)` to ensure stable sort order:

```typescript
export interface LeadCursor {
  score: number;
  scrapedAt: string;  // ISO 8601
  id: string;         // UUID for tiebreaking
}

// Encode/decode for URL transport
export function encodeCursor(cursor: LeadCursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeCursor(encoded: string): LeadCursor {
  return JSON.parse(atob(encoded));
}
```

**The problem with cursor + in-memory scoring:** The current architecture computes scores in memory after the SQL query. Cursor pagination requires the sort column to exist at the SQL level. This creates a fundamental tension.

**Solution: Two-pass approach.**

1. SQL query fetches leads within radius (same Haversine WHERE), ordered by `scrapedAt DESC, id DESC` (stable, indexable)
2. In-memory enrichment adds scores
3. Re-sort by `(score DESC, scrapedAt DESC, id DESC)`
4. Return page + cursor pointing to last item

For "next page" requests:
1. Decode cursor to get `(lastScore, lastScrapedAt, lastId)`
2. SQL WHERE adds: `scrapedAt <= cursor.scrapedAt` (coarse filter to avoid scanning full table)
3. In-memory: skip all leads until past the cursor position in the `(score, scrapedAt, id)` sort order
4. Return next pageSize leads

**This is a "keyset-ish" approach** -- the SQL uses a time-based cursor for efficiency (leveraging the `leads_scraped_at_idx` index), and the in-memory enrichment step handles the score-based ordering. It is NOT a pure keyset cursor (which would require the sort column in SQL), but it avoids the offset problem of shifting pages.

**Trade-off acknowledged:** This approach still loads more leads than the page size from SQL (similar to FETCH_MULTIPLIER). For v3.0 volumes (estimated <50k leads per industry per radius), this is acceptable. If volumes grow beyond 100k, the scoring must move to SQL (materialized scores or a scoring column updated on profile change).

| File | Status | Description |
|------|--------|-------------|
| `src/lib/leads/queries.ts` | MODIFIED | Replace offset param with cursor, add cursor encoding/decoding |
| `src/lib/leads/cursor.ts` | NEW | Cursor types, encode/decode utilities |
| `src/app/(dashboard)/dashboard/page.tsx` | MODIFIED | Parse cursor from searchParams instead of page number |
| `src/components/dashboard/pagination.tsx` | MODIFIED | Change from page numbers to "Load More" / prev/next with cursor |

---

### 6. Vercel Cron Architecture (10 Jobs)

**Status: MODIFIED (vercel.json, existing cron route) + NEW (5+ cron route handlers)**

#### Current State

Single cron job:
```json
{
  "crons": [{ "path": "/api/cron/scrape", "schedule": "0 6 * * *" }]
}
```

`maxDuration = 300` (5 minutes). Runs all 8 adapters sequentially, then digest, all in one function.

#### Vercel Cron Limits

- **Pro plan:** 100 crons per project, minimum interval 1 minute, per-minute scheduling precision
- **Hobby plan:** 100 crons per project, limited to once-per-day execution
- **Function duration:** Up to 300s without Fluid Compute, up to 800s with Fluid Compute (Pro)
- **Each cron invokes a Vercel Function** -- subject to standard function limits

#### Target: 10 Cron Jobs

| # | Path | Schedule | Duration Budget | Purpose |
|---|------|----------|----------------|---------|
| 1 | `/api/cron/scrape/heavy-equipment` | `0 6 * * *` | 300s | Heavy equipment scrapers |
| 2 | `/api/cron/scrape/hvac` | `0 6 * * *` | 300s | HVAC scrapers |
| 3 | `/api/cron/scrape/roofing` | `0 6 * * *` | 300s | Roofing scrapers (non-weather) |
| 4 | `/api/cron/scrape/solar` | `0 6 * * *` | 300s | Solar scrapers |
| 5 | `/api/cron/scrape/electrical` | `0 6 * * *` | 300s | Electrical scrapers |
| 6 | `/api/cron/weather` | `0 */2 * * *` | 60s | NOAA storm alerts (every 2 hours) |
| 7 | `/api/cron/enrichment` | `30 6 * * *` | 300s | Lead enrichment pipeline (after scrape) |
| 8 | `/api/cron/digest` | `0 7 * * *` | 120s | Email digests (after enrichment) |
| 9 | `/api/cron/dedup-maintenance` | `0 3 * * 0` | 300s | Weekly dedup maintenance |
| 10 | `/api/cron/storm-alerts` | `*/30 * * * *` | 60s | Storm alert emails (every 30 min) |

**Parallel execution:** Vercel crons that fire at the same time (e.g., all 5 industry scrapers at 6 AM) execute as independent function invocations. They share no state and cannot conflict. The only concern is database contention -- 5 concurrent scraper functions all inserting leads simultaneously. Neon handles this fine with row-level locking on the unique indexes.

**Architecture: Shared handler with industry parameter.**

Rather than 5 duplicate route files, use a single parameterized route:

```
src/app/api/cron/scrape/[industry]/route.ts
```

```typescript
// src/app/api/cron/scrape/[industry]/route.ts

export const maxDuration = 300;

const VALID_INDUSTRIES: Industry[] = ["heavy_equipment", "hvac", "roofing", "solar", "electrical"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  const { industry } = await params;
  if (!VALID_INDUSTRIES.includes(industry as Industry)) {
    return new Response("Invalid industry", { status: 400 });
  }
  // Auth check (same CRON_SECRET pattern)
  // Initialize adapters for this industry only
  // Run pipeline
  // Record results in scraper_runs
}
```

**vercel.json:**
```json
{
  "crons": [
    { "path": "/api/cron/scrape/heavy_equipment", "schedule": "0 6 * * *" },
    { "path": "/api/cron/scrape/hvac", "schedule": "0 6 * * *" },
    { "path": "/api/cron/scrape/roofing", "schedule": "0 6 * * *" },
    { "path": "/api/cron/scrape/solar", "schedule": "0 6 * * *" },
    { "path": "/api/cron/scrape/electrical", "schedule": "0 6 * * *" },
    { "path": "/api/cron/weather", "schedule": "0 */2 * * *" },
    { "path": "/api/cron/enrichment", "schedule": "30 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "0 7 * * *" },
    { "path": "/api/cron/dedup-maintenance", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/storm-alerts", "schedule": "*/30 * * * *" }
  ]
}
```

**Decoupling scrape from digest:** Currently the cron/scrape route fires `generateDigests()` after scraping completes. This coupling must be broken -- the digest cron runs independently at 7 AM (after all scrapers have completed at ~6:05 AM).

| File | Status | Description |
|------|--------|-------------|
| `vercel.json` | MODIFIED | 10 cron entries |
| `src/app/api/cron/scrape/route.ts` | REMOVED | Replaced by industry-specific route |
| `src/app/api/cron/scrape/[industry]/route.ts` | NEW | Parameterized industry scraper |
| `src/app/api/cron/weather/route.ts` | NEW | NOAA weather polling |
| `src/app/api/cron/enrichment/route.ts` | NEW | Lead enrichment pipeline |
| `src/app/api/cron/digest/route.ts` | NEW | Email digest generation |
| `src/app/api/cron/dedup-maintenance/route.ts` | NEW | Weekly dedup cleanup |
| `src/app/api/cron/storm-alerts/route.ts` | NEW | Storm alert email dispatch |

---

### 7. Hash-Based Deduplication

**Status: MODIFIED (dedup.ts, pipeline.ts, base-adapter.ts)**

#### Current State

Two dedup mechanisms:
1. **Insert-time:** Permit records use `onConflictDoUpdate` on `(sourceId, permitNumber)`. Non-permit records use `onConflictDoNothing` on `(sourceId, sourceUrl)`.
2. **Post-pipeline:** `deduplicateNewLeads()` uses geographic proximity (Haversine <0.1 miles) AND text similarity (Dice coefficient >0.7) to find cross-source duplicates.

The geographic+text approach is fragile: different text descriptions of the same project at the same address may not match; different geocoding precision creates false negatives.

#### Target: Content Hash

Generate a deterministic hash from normalized lead identity fields. Two leads with the same hash are the same real-world project.

**Hash computation:**

```typescript
// src/lib/scraper/content-hash.ts (NEW)

import { createHash } from "crypto";

export function computeContentHash(lead: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  title?: string | null;
  permitNumber?: string | null;
  sourceType: string;
}): string {
  const normalized = [
    // Geographic identity: round to ~0.01 mile precision
    lead.lat != null ? lead.lat.toFixed(3) : "",
    lead.lng != null ? lead.lng.toFixed(3) : "",
    // Textual identity: normalized address or title
    normalizeForHash(lead.address || lead.title || ""),
    // Permit identity: exact permit number when available
    lead.permitNumber || "",
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
```

**Integration with pipeline:**

```typescript
// In pipeline.ts processRecords():
const contentHash = computeContentHash(record);
const values = { ...existingValues, contentHash };

// Single upsert path for ALL source types:
const result = await db
  .insert(leads)
  .values(values)
  .onConflictDoUpdate({
    target: [leads.contentHash],  // Uses the new unique index
    set: { /* update fields */ },
  })
  .returning({ id: leads.id });
```

**This simplifies the pipeline dramatically.** The current `processRecords()` function has 3 branches (permit with permitNumber, non-permit with sourceUrl, non-permit without sourceUrl). Hash-based dedup collapses these to 1 branch.

**Migration path:** The content hash must be computed for all existing leads. A one-time migration script:

```sql
-- Run after adding content_hash column but before enabling unique constraint
-- This must run as application code (not SQL) because the hash function is in TypeScript
```

The migration script reads all existing leads, computes their content hash, and updates them. If two existing leads hash to the same value, they need manual dedup resolution (merge the older into the newer, transfer lead_sources).

**The geographic+text dedup (`deduplicateNewLeads()`) becomes a FALLBACK** for leads that fail to produce a good content hash (e.g., no address, no coordinates, no title). It is not removed but demoted to a backup.

| File | Status | Description |
|------|--------|-------------|
| `src/lib/scraper/content-hash.ts` | NEW | Hash computation |
| `src/lib/scraper/pipeline.ts` | MODIFIED | Compute hash, use hash-based upsert |
| `src/lib/scraper/dedup.ts` | MODIFIED | Demoted to fallback, only runs on hashless leads |
| `src/lib/db/schema/leads.ts` | MODIFIED | content_hash column + unique index (done in step 1) |

---

### 8. Lead Enrichment Pipeline

**Status: NEW (enrichment module, cron handler, schema)**

#### Current State

Geocoding is the only "enrichment" and it happens inline during the scrape pipeline (`geocodeBatch()` in `pipeline.ts`). This creates two problems:
1. Geocoding failures block lead storage (the lead is stored without coordinates)
2. Adding more enrichment steps (property data, weather, incentives) would make the scrape pipeline too slow

#### Target: Separate Enrichment Pipeline

Enrichment runs AFTER scraping, on a separate cron schedule (`30 6 * * *`). It processes leads that lack enrichment data.

**Architecture:**

```
Scrape Pipeline (6:00 AM)           Enrichment Pipeline (6:30 AM)
        |                                    |
        v                                    v
  Insert raw leads                   SELECT leads WHERE
  (with content_hash,                  enrichment_status = 'pending'
   minimal geocoding)                    |
        |                                v
        v                           For each lead:
  leads table                         1. Geocode (if lat/lng missing)
  (enrichment_status                  2. Property lookup
   = 'pending')                       3. Weather overlay
                                      4. Incentive matching
                                         |
                                         v
                                    INSERT lead_enrichments
                                    UPDATE leads SET
                                      enrichment_status = 'complete'
```

**Enrichment data model:**

```typescript
// src/lib/db/schema/lead-enrichments.ts (NEW)

export const leadEnrichments = pgTable("lead_enrichments", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }).unique(),
  // Geocoding
  geocodeSource: text("geocode_source"),  // "google", "census", "fallback"
  geocodeConfidence: real("geocode_confidence"),
  // Property data
  propertyType: text("property_type"),
  buildingSqft: integer("building_sqft"),
  yearBuilt: integer("year_built"),
  ownerName: text("owner_name"),
  ownerContact: text("owner_contact"),
  // Weather
  activeStormAlerts: text("active_storm_alerts").array(),
  lastStormDate: timestamp("last_storm_date"),
  // Incentives
  applicableIncentives: text("applicable_incentives").array(),
  incentiveTotalValue: integer("incentive_total_value"),
  // Metadata
  enrichedAt: timestamp("enriched_at").defaultNow().notNull(),
  enrichmentVersion: integer("enrichment_version").default(1),
});
```

**Integration with lead queries:** The enrichment data is LEFT JOINed at query time, not merged into the leads table. This keeps the leads table clean and allows re-enrichment without data loss.

```typescript
// In queries.ts:
const rows = await db
  .select({
    ...getTableColumns(leads),
    enrichment: getTableColumns(leadEnrichments),
    distance: distanceExpr,
  })
  .from(leads)
  .leftJoin(leadEnrichments, eq(leadEnrichments.leadId, leads.id))
  // ... existing WHERE, JOINs, etc.
```

**Geocoding migration:** Move geocoding from `pipeline.ts` into the enrichment pipeline. During migration, the pipeline continues to geocode inline (for backward compatibility) until the enrichment pipeline is stable.

| File | Status | Description |
|------|--------|-------------|
| `src/lib/db/schema/lead-enrichments.ts` | NEW | Enrichment data table |
| `src/lib/enrichment/pipeline.ts` | NEW | Enrichment orchestrator |
| `src/lib/enrichment/geocode.ts` | NEW | Enhanced geocoding (move from scraper) |
| `src/lib/enrichment/property.ts` | NEW | Property data lookup |
| `src/lib/enrichment/weather.ts` | NEW | Weather overlay |
| `src/lib/enrichment/incentives.ts` | NEW | Incentive matching |
| `src/app/api/cron/enrichment/route.ts` | NEW | Cron handler |
| `src/lib/leads/queries.ts` | MODIFIED | LEFT JOIN enrichment data |
| `src/lib/scraper/pipeline.ts` | MODIFIED | Remove geocoding (after enrichment pipeline is stable) |

---

### 9. CRM-Lite Bookmarks

**Status: MODIFIED (bookmarks schema, bookmark action, bookmarks page)**

#### Current State

Bookmarks are a simple toggle: insert or delete a row. No notes, no pipeline status.

- `bookmarks` table: id, leadId, userId, organizationId, createdAt
- `toggleBookmark()` action: check exists -> delete (if yes) -> insert (if no)
- Bookmarks page: lists bookmarked leads with same enriched data as feed

#### Target: Bookmarks with Notes + Pipeline Status

**Schema change (from step 1):** `notes` (text), `pipeline_status` (text, default 'saved'), `updated_at` (timestamp)

**Pipeline statuses:** `saved` -> `qualifying` -> `contacted` -> `proposal` -> `won` -> `lost`

This replaces the per-lead `leadStatuses` table for bookmarked leads. The key difference: `leadStatuses` tracks viewing/contact state for ALL leads (including non-bookmarked), while `bookmarks.pipeline_status` tracks deal progress for SAVED leads. They coexist.

**Action changes:**

```typescript
// src/actions/bookmarks.ts (MODIFIED)

// Existing: toggleBookmark(leadId) -- unchanged for basic toggle

// NEW: update bookmark metadata
export async function updateBookmarkNotes(
  leadId: string,
  notes: string
): Promise<void> { ... }

export async function updateBookmarkPipelineStatus(
  leadId: string,
  status: PipelineStatus
): Promise<void> { ... }

// MODIFIED: getBookmarkedLeads() returns full bookmark data
export async function getBookmarkedLeadsWithMetadata(): Promise<BookmarkWithLead[]> {
  // JOIN bookmarks with leads, include notes and pipeline_status
}
```

| File | Status | Description |
|------|--------|-------------|
| `src/lib/db/schema/bookmarks.ts` | MODIFIED | Add notes, pipeline_status, updated_at (done in step 1) |
| `src/actions/bookmarks.ts` | MODIFIED | Add updateBookmarkNotes, updateBookmarkPipelineStatus, getBookmarkedLeadsWithMetadata |
| `src/app/(dashboard)/dashboard/bookmarks/page.tsx` | MODIFIED | Show notes, pipeline status, edit UI |
| `src/components/dashboard/bookmark-card.tsx` | NEW or MODIFIED | Notes editor, pipeline status dropdown |

---

### 10. Email System Expansion

**Status: MODIFIED (email senders, digest generator) + NEW (React Email templates, storm alert, unsubscribe)**

#### Current State

- 2 email templates: `daily-digest.tsx`, `password-reset.tsx` (React components rendered by Resend)
- `send-digest.ts` sends via Resend SDK
- `digest-generator.ts` generates per-user digests
- No unsubscribe mechanism (CAN-SPAM violation risk)

#### Target: React Email Templates + Storm Alerts + Unsubscribe

**React Email integration:** Already in use. The existing templates use React components rendered by Resend's `react` option. Expand this pattern to all email types.

**New templates:**

| Template | File | Trigger |
|----------|------|---------|
| Daily Digest (enhanced) | `src/components/emails/daily-digest.tsx` | MODIFIED |
| Storm Alert | `src/components/emails/storm-alert.tsx` | NEW |
| Welcome Email | `src/components/emails/welcome.tsx` | NEW |
| Trial Expiring (3-day) | `src/components/emails/trial-expiring.tsx` | NEW |
| Trial Expired | `src/components/emails/trial-expired.tsx` | NEW |
| Password Reset | `src/components/emails/password-reset.tsx` | EXISTING |

**All templates must include:**
1. Unsubscribe link (CAN-SPAM)
2. Physical mailing address (CAN-SPAM)
3. Company branding

**Unsubscribe mechanism:**

```typescript
// src/lib/db/schema/unsubscribe-tokens.ts (NEW)
export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  token: text("token").notNull().unique(),
  emailType: text("email_type").notNull(),  // "digest", "storm", "all"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Unsubscribe flow:**

```
Email footer contains: "Unsubscribe: https://app.leadforge.com/unsubscribe/{token}"
    |
    v
GET /unsubscribe/[token] -- server component page
    |
    v
Look up token -> show "Unsubscribed from [type] emails" page
    |
    v
Mark user's preference in DB (or delete saved search digest flag)
```

**Storm alert architecture:**

```
NOAA cron (every 2h) polls weather API
    |
    v
New severe weather event detected in a region
    |
    v
Query: which organizations have service areas overlapping the storm region?
    |
    v
For each affected org:
  - Query leads in storm-affected area
  - Generate storm alert email with affected leads
  - Send via Resend
    |
    v
Storm alert cron (every 30 min) checks for pending alerts to send
```

| File | Status | Description |
|------|--------|-------------|
| `src/components/emails/daily-digest.tsx` | MODIFIED | Add unsubscribe link, branding |
| `src/components/emails/storm-alert.tsx` | NEW | Storm alert template |
| `src/components/emails/welcome.tsx` | NEW | Welcome email |
| `src/components/emails/trial-expiring.tsx` | NEW | Trial expiry warning |
| `src/lib/email/send-digest.ts` | MODIFIED | Include unsubscribe token |
| `src/lib/email/send-storm-alert.ts` | NEW | Storm alert sender |
| `src/lib/email/unsubscribe.ts` | NEW | Token generation and validation |
| `src/lib/db/schema/unsubscribe-tokens.ts` | NEW | Unsubscribe tokens table |
| `src/app/unsubscribe/[token]/page.tsx` | NEW | Unsubscribe landing page |
| `src/app/api/cron/storm-alerts/route.ts` | NEW | Storm alert dispatch cron |
| `src/lib/email/digest-generator.ts` | MODIFIED | Check unsubscribe status before sending |

---

### 11. Cross-Industry Lead Relevance

**Status: NEW (junction table, query modifications)**

#### Current State

Leads have no industry association. All leads are implicitly "construction/heavy equipment." The `sourceType` field (permit/bid/news/deep-web) is source-specific, not industry-specific.

#### Target: Lead-Industry Junction Table

A lead can be relevant to multiple industries. A permit for "commercial HVAC installation" is relevant to both HVAC and electrical contractors.

```typescript
// src/lib/db/schema/lead-industries.ts (NEW)

export const leadIndustries = pgTable(
  "lead_industries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    industry: text("industry").notNull(),
    confidence: real("confidence").default(1.0),  // 0-1 how confident the assignment is
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    assignedBy: text("assigned_by").notNull(),  // "scraper", "enrichment", "manual"
  },
  (table) => [
    uniqueIndex("lead_industries_lead_industry_idx").on(table.leadId, table.industry),
    index("lead_industries_industry_idx").on(table.industry),
  ]
);
```

**Industry assignment happens at two points:**

1. **Scrape time:** The adapter knows its industry (from the registry). When a lead is inserted, the pipeline also inserts a `lead_industries` row.
2. **Enrichment time:** The enrichment pipeline analyzes lead content (permit type, description keywords) and may add additional industry assignments.

**Query integration:** The lead feed query adds an industry filter:

```typescript
// In getFilteredLeads():
query = query
  .innerJoin(
    leadIndustries,
    and(
      eq(leadIndustries.leadId, leads.id),
      eq(leadIndustries.industry, organizationIndustry)
    )
  );
```

This ensures a heavy equipment user only sees leads tagged as relevant to heavy equipment, even if the same physical lead is also relevant to HVAC.

**Backfill migration:** All existing leads are tagged as `heavy_equipment` with confidence 1.0 and assignedBy `migration`.

| File | Status | Description |
|------|--------|-------------|
| `src/lib/db/schema/lead-industries.ts` | NEW | Junction table |
| `src/lib/scraper/pipeline.ts` | MODIFIED | Insert lead_industries rows during scraping |
| `src/lib/leads/queries.ts` | MODIFIED | INNER JOIN on lead_industries for industry filtering |
| `src/lib/enrichment/industry-classifier.ts` | NEW | Classify lead into industries by content analysis |

---

## Build Order (Minimizes Breaking Changes)

The following order ensures each phase is independently deployable and does not break existing functionality.

```
Phase A: Schema Foundation
  |  - Add industry to organization + backfill
  |  - Rename company_profiles -> organization_profiles + add columns
  |  - Add columns to leads (content_hash, etc.)
  |  - Add columns to bookmarks (notes, pipeline_status)
  |  - Create new tables (lead_enrichments, lead_industries, scraper_runs, unsubscribe_tokens)
  |  - Update ALL import paths across codebase
  |  - Backfill: existing leads get lead_industries rows (heavy_equipment)
  |
  |  DEPLOYABLE: App works exactly as before (new columns are nullable/defaulted)
  v
Phase B: Onboarding Wizard
  |  - useReducer state machine
  |  - 6-step wizard with industry selection
  |  - New onboarding action writing to organization.industry + organization_profiles
  |  - Industry-conditional validation schemas
  |
  |  DEPLOYABLE: New users see expanded onboarding; existing users unaffected
  v
Phase C: Scraper Registry + New Adapters
  |  - Industry-keyed registry
  |  - Permit adapter factory
  |  - 4+ new adapters (NOAA, FEMA, code violations, incentives)
  |  - Parameterized cron route (/api/cron/scrape/[industry])
  |  - ScraperAdapter interface extension (industries field)
  |  - Pipeline writes lead_industries rows
  |
  |  DEPLOYABLE: New cron jobs fire, new lead types appear
  v
Phase D: Hash-Based Dedup
  |  - Content hash computation
  |  - Pipeline uses hash-based upsert
  |  - Backfill existing leads with content hashes
  |  - Geographic+text dedup demoted to fallback
  |
  |  DEPLOYABLE: Dedup is more reliable, no visible UX change
  v
Phase E: Scoring Engine + Cursor Pagination
  |  - 5-dimension scoring
  |  - Industry-specific relevance inference
  |  - Match reasons
  |  - Cursor-based pagination
  |  - Dashboard query integration
  |
  |  DEPLOYABLE: Better scores, stable pagination, match reasons in UI
  v
Phase F: Enrichment Pipeline
  |  - Enrichment module (geocode, property, weather, incentives)
  |  - lead_enrichments table population
  |  - Enrichment cron job
  |  - Query LEFT JOINs enrichment data
  |  - Migrate geocoding from scrape pipeline to enrichment
  |
  |  DEPLOYABLE: Leads gain richer data over time
  v
Phase G: CRM-Lite Bookmarks
  |  - Bookmark notes + pipeline status actions
  |  - Bookmarks page UI update
  |  - Pipeline status tracking
  |
  |  DEPLOYABLE: Bookmarks gain CRM features
  v
Phase H: Email System
  |  - React Email templates (storm, welcome, trial)
  |  - Unsubscribe mechanism
  |  - Storm alert cron
  |  - Digest enhancement with unsubscribe
  |
  |  DEPLOYABLE: New email types, CAN-SPAM compliance
  v
Phase I: Dashboard + UI
  |  - Filter panel redesign
  |  - Score badges + match reasons
  |  - Storm alert UI
  |  - Industry-specific theming
  |
  |  DEPLOYABLE: Visual refresh
```

**Why this order:**

1. **Schema first** because every other feature depends on the new/modified tables. Additive-only changes ensure zero breakage.
2. **Onboarding second** because new users need to select an industry before industry-specific features work. Existing users default to `heavy_equipment`.
3. **Scraper registry third** because new adapters need the industry dimension in the registry and the `lead_industries` junction table.
4. **Hash dedup fourth** because it simplifies the pipeline before adding more adapters and enrichment.
5. **Scoring + pagination fifth** because they depend on the industry field existing in organization profiles and lead_industries being populated.
6. **Enrichment sixth** because it depends on the leads table having content_hash and the enrichments table existing.
7. **CRM bookmarks seventh** because it is a self-contained UI feature that depends only on the schema change from Phase A.
8. **Email eighth** because storm alerts depend on weather adapters (Phase C) and enrichment data (Phase F).
9. **Dashboard UI last** because it consumes all the data produced by Phases C-H and should be built once the data flows are stable.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding `industry` to Better Auth's metadata JSON

**What people do:** Store industry in `organization.metadata` (a text column) to avoid "modifying Better Auth tables."
**Why it's wrong:** `metadata` is untyped, unindexed, and parsed as JSON at every read. Industry is queried constantly (scraper selection, scoring, feed filtering). It must be a first-class column.
**Do this instead:** Add an `industry` column directly to the `organization` table in the Drizzle schema. Better Auth's Drizzle adapter respects custom columns.

### Anti-Pattern 2: Global Scraper Run for Multi-Industry

**What people do:** Keep one cron job that runs ALL adapters for ALL industries.
**Why it's wrong:** A single function running 30+ adapters will exceed the 300s timeout. One failing adapter blocks all industries.
**Do this instead:** One cron per industry. Each runs independently, fails independently, and stays within timeout.

### Anti-Pattern 3: Storing Scores in the Database

**What people do:** Compute scores at insert time and store in a `score` column.
**Why it's wrong:** The same lead scores differently for each subscriber (different HQ location, specializations, service radius). Stored scores are subscriber-agnostic.
**Do this instead:** Compute at query time. The current architecture already does this correctly. Keep it.

### Anti-Pattern 4: Dropping `company_profiles` and Recreating as `organization_profiles`

**What people do:** Delete the old table and create a new one.
**Why it's wrong:** Loses all existing profile data. Drizzle Kit generates DROP TABLE + CREATE TABLE instead of ALTER TABLE RENAME.
**Do this instead:** Use Drizzle Kit's rename detection. When prompted "Was 'organization_profiles' table created or renamed from another table?", answer "renamed from company_profiles."

### Anti-Pattern 5: Coupling Storm Alerts to the Scrape Pipeline

**What people do:** Check for storms inside the scraping cron.
**Why it's wrong:** Storms need faster response (every 2 hours or even 30 minutes). The scrape pipeline runs once daily. Coupling means storm alerts are always stale.
**Do this instead:** Separate weather cron with its own schedule and function.

### Anti-Pattern 6: Making the Content Hash Too Specific

**What people do:** Include ALL lead fields in the hash (description, estimatedValue, dates, etc.).
**Why it's wrong:** A lead's description may change across sources or over time. An overly-specific hash treats minor text differences as separate leads.
**Do this instead:** Hash IDENTITY fields only: rounded lat/lng (geographic identity), normalized address/title (textual identity), and permit number (when available). The hash answers "is this the same real-world project?" not "is this the exact same record?"

### Anti-Pattern 7: Inline Enrichment During Scraping

**What people do:** Call property APIs, weather APIs, and incentive APIs during the scrape pipeline.
**Why it's wrong:** Adds latency and failure points to the critical path. If the property API is down, scraping fails. Enrichment data can arrive later.
**Do this instead:** Scrape produces raw leads with minimal processing. Enrichment runs separately, tolerates partial failures, and can be re-run.

---

## Component Boundary Summary

| Boundary | Direction | Protocol | v3.0 Changes |
|----------|-----------|----------|--------------|
| Browser <-> Next.js | HTTP | App Router (RSC, server actions) | Modified onboarding, new cron routes, unsubscribe route |
| Server Components <-> Auth | Direct import | `auth.api.getSession()` | Read industry from organization |
| Server Components <-> DB | Direct import | Drizzle query builder | New JOINs (lead_industries, lead_enrichments), new tables |
| Scraper <-> Registry | Direct import | Industry-keyed Map | Industry dimension added |
| Pipeline <-> DB | Direct import | Drizzle insert/upsert | Content hash upsert, lead_industries insert |
| Enrichment <-> DB | Direct import | Drizzle insert/update | New module, writes to lead_enrichments |
| Enrichment <-> External APIs | HTTP | Various (NOAA, property APIs) | New external service integrations |
| Email <-> Resend | HTTP | Resend SDK | New email types, unsubscribe tokens |
| Cron <-> Functions | HTTP | Vercel Cron -> GET handler | 10 cron jobs (from 1) |

---

## Scalability Considerations

| Concern | At 100 orgs (current) | At 1K orgs | At 10K orgs |
|---------|----------------------|------------|-------------|
| Lead volume | ~10K leads | ~100K leads | ~1M leads |
| Scraping time | 5 min (1 cron) | 5 min (5 crons, parallel) | May need adapter-level parallelism |
| Query performance | Haversine adequate | Add composite indexes | Consider PostGIS upgrade |
| Scoring compute | ~50ms per page | ~200ms per page | Consider materialized scores |
| Enrichment queue | Process all daily | Batch by priority | Worker queue (BullMQ/Inngest) |
| Email volume | ~100 emails/day | ~1K emails/day | Resend rate limits, batch sends |
| Cron duration | Well within 300s | Monitor per-industry | Split large industries by region |

---

## Sources

- Codebase analysis of 40+ source files (HIGH confidence: direct code inspection)
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- 100 crons per project on all plans, Hobby limited to daily (HIGH confidence: official docs, updated January 2026)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) -- maxDuration 300s default, 800s with Fluid Compute on Pro (HIGH confidence: official docs)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) -- rename detection, custom migrations, generate workflow (HIGH confidence: official docs)
- [Drizzle ORM Cursor-Based Pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) -- composite cursor patterns, UUID + sequential column requirement (HIGH confidence: official docs)
- [React Email](https://react.email) -- template library for email rendering (HIGH confidence: official docs)
- [Resend + Next.js](https://resend.com/docs/send-with-nextjs) -- Server Actions integration pattern (HIGH confidence: official docs)

---
*Architecture research for: LeadForge v3.0 Multi-Industry Platform*
*Researched: 2026-03-16*
