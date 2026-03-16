# Feature Research: LeadForge v3.0 Multi-Industry Expansion

**Domain:** Multi-industry B2B lead generation platform for blue-collar contractors (heavy equipment, HVAC, roofing, solar, electrical)
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (feature scope well understood from domain research; specific API availability for some data sources needs validation at implementation time)

---

## Feature Landscape

This document maps the complete feature set needed to expand LeadForge from a single-industry heavy equipment lead platform to a 5-vertical platform serving HVAC, roofing, solar, and electrical contractors alongside the existing heavy equipment vertical.

**Scope boundary:** Only features required for the multi-industry expansion. Existing v2.1 features (auth, billing, pagination, digests) are treated as dependencies, not rework targets.

---

### Table Stakes (Users Expect These)

Features that any multi-industry lead gen platform must have. Without these, the product feels like a heavy-equipment tool with other industries bolted on.

#### Platform-Level Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Industry selection during onboarding | Users must self-identify their industry before seeing any leads. A roofer seeing excavator leads on first login means instant churn. | LOW | Existing onboarding flow (steps 1-3) | Add Step 0: industry picker. This determines which subsequent onboarding steps are shown and what `industryType` is stored on the company profile. Single-select, not multi-select (see Anti-Features). |
| Industry-specific onboarding questions | Each industry needs different profile data to score leads. A roofer does not care about equipment types; a solar installer needs to specify residential vs commercial focus. | MEDIUM | Industry selection step | See "Onboarding by Industry" section below for full specification per vertical. |
| Industry-aware lead scoring | The current 3-factor scoring (equipment 50%, distance 30%, value 20%) is heavy-equipment-specific. Other industries need different weights and dimensions. | MEDIUM-HIGH | New scoring engine, industry profiles | Replace single `scoreLead()` with industry-dispatched scoring. Each vertical gets its own weight config. See "Scoring by Industry" section below. |
| Multi-source lead feed with source type indicators | Users need to see where a lead came from (permit, bid, news, storm alert, code violation). Source type badges on lead cards provide context for urgency and reliability. | LOW | Existing `sourceType` field on leads table | Add visual badge/icon per source type on lead cards. Already have the data; this is a UI addition. |
| Industry-specific lead detail enrichment | A roofing lead from a storm alert needs different detail than an HVAC lead from a mechanical permit. The detail page must adapt its "intelligence" section to the industry context. | MEDIUM | Industry profiles, lead source metadata | Extend `EnrichedLead` type with industry-specific fields: storm severity for roofing, incentive applicability for solar, violation urgency for HVAC/electrical. |
| Filter panel with industry-relevant facets | Current feed has keyword, radius, date, and value filters. Multi-industry needs source type filter, project type filter (new construction / retrofit / repair), and urgency filter. | MEDIUM | Existing saved search schema, new filter options | Add `sourceTypeFilter`, `projectCategory` columns to saved_searches. Keep existing filters. Faceted filter panel with collapsible sections. |
| Industry-specific email digest content | A roofer's daily digest should highlight storm-related leads with urgency indicators. An HVAC contractor's digest should emphasize seasonal relevance. Generic digests across industries feel impersonal. | MEDIUM | Existing digest infrastructure, industry profiles | Template the digest email per industry. Same generation pipeline, different content layout per `industryType`. |
| Cross-industry lead tagging | A commercial building permit is relevant to HVAC, electrical, AND roofing contractors. The system must tag leads with all applicable industries, not assign them to one. | MEDIUM | New `lead_industries` junction table or array column | Add `applicableIndustries: text[]` column to leads table. Populated during scraping/enrichment based on keyword inference rules. Each industry's feed queries `WHERE industryType = ANY(applicableIndustries)`. |
| CRM-lite pipeline status upgrade | Existing statuses are `new | viewed | contacted | won | lost`. For multi-industry, contractors expect at minimum: `saved -> contacted -> quoted -> in_progress -> won | lost`. The jump from "contacted" to "won" is too large for services that involve quoting and scheduling. | LOW-MEDIUM | Existing `lead_statuses` table | Add `quoted` and `in_progress` statuses. Migration adds to the `LeadStatus` type. Existing UI pipeline component needs two more columns. |
| SAM.gov multi-industry NAICS filtering | Current adapter only queries NAICS 236-238 (construction). Need to expand to industry-specific NAICS codes to surface relevant federal bids per vertical. | LOW | Existing SAM.gov adapter | Add NAICS code mapping per industry. HVAC: 238220. Electrical: 238210. Roofing: 238160. Solar: 238220 + 221114. Already fetching from SAM.gov; just need broader NAICS coverage and industry tagging on results. |

#### Onboarding by Industry

Each vertical needs a tailored onboarding flow after the shared location step:

| Industry | Step 1 (Shared) | Step 2 (Industry-Specific) | Step 3 (Service Area) | Notes |
|----------|----------------|---------------------------|----------------------|-------|
| **Heavy Equipment** | HQ Address | Equipment types (multi-select from existing list) | Service radius (10-500 mi) | Existing flow, unchanged |
| **HVAC** | HQ Address | Service types: Installation, Repair/Maintenance, Commercial, Residential. System types: Furnace, AC, Heat Pump, Mini-Split, Boiler, Geothermal | Service radius (10-200 mi) | Smaller radius typical for HVAC. Add `systemTypes` and `serviceCategories` to profile. |
| **Roofing** | HQ Address | Service types: New Construction, Re-roof/Replacement, Storm Damage/Restoration, Commercial, Residential. Materials: Asphalt Shingle, Metal, Tile, Flat/TPO/EPDM | Service radius (10-300 mi) | Storm damage restoration is a distinct business model. Add `roofingMaterials` and `serviceCategories` to profile. |
| **Solar** | HQ Address | Focus: Residential, Commercial, or Both. Services: Installation, Maintenance, Battery Storage. Certifications: NABCEP, state-specific | Service radius (10-200 mi) | Residential vs commercial focus heavily affects lead relevance. Add `solarFocus` and `certifications` to profile. |
| **Electrical** | HQ Address | Service types: Residential, Commercial, Industrial, EV Charging, Solar Interconnect, Generator. Specializations: Panel Upgrade, New Construction, Renovation | Service radius (10-200 mi) | EV charging and solar interconnect are high-growth specializations. Add `electricalSpecializations` to profile. |

**Schema implication:** The `company_profiles` table needs an `industryType` enum column and industry-specific JSON or separate columns for service categories, material preferences, and specializations. Recommend a polymorphic approach: shared columns (address, radius, industry) plus a `profileConfig: jsonb` column for industry-specific data. Avoids 20+ nullable columns.

#### Scoring by Industry

| Industry | Dimension 1 | Dimension 2 | Dimension 3 | Dimension 4 | Dimension 5 |
|----------|-------------|-------------|-------------|-------------|-------------|
| **Heavy Equipment** | Equipment match (40%) | Distance (30%) | Project value (20%) | Freshness (10%) | -- |
| **HVAC** | Service type match (30%) | Distance (30%) | Project value (15%) | Freshness (15%) | Seasonal relevance (10%) |
| **Roofing** | Service type match (25%) | Distance (25%) | Storm urgency (25%) | Project value (15%) | Freshness (10%) |
| **Solar** | Focus match (25%) | Distance (25%) | Incentive value (20%) | Project value (15%) | Freshness (15%) |
| **Electrical** | Specialization match (30%) | Distance (30%) | Project value (15%) | Freshness (15%) | EV/solar growth signal (10%) |

**Key change:** The scoring engine must dispatch to an industry-specific scoring function. The current `scoreLead()` becomes `scoreLeadForIndustry(industry, input)` which delegates to `scoreHeavyEquipment()`, `scoreHVAC()`, etc.

**Storm urgency** is unique to roofing: leads from storm alerts within 48 hours of the event get a 25-point urgency boost. This makes storm leads jump to the top of the feed immediately.

**Seasonal relevance** for HVAC: leads related to AC work score higher in spring/summer; heating leads score higher in fall/winter. Simple month-based multiplier.

---

### Differentiators (Competitive Advantage)

Features that set LeadForge apart from generic lead gen platforms. Not expected, but create compelling value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Storm event alerting for roofing | Real-time push notifications (email + in-app banner) when severe weather hits a roofer's service area. "Hail reported in [city] -- [N] properties potentially affected." First mover to a storm area wins 50-78% of the work. | MEDIUM-HIGH | NWS API integration, user notification preferences, cron job | NWS API is **free, no auth required** (just User-Agent header). Poll `/alerts/active?area={state}` every 15 minutes via cron. Filter for hail/tornado/severe thunderstorm events. Match alert geometry/area against user service areas. Fire email + set in-app banner. |
| Code violation monitoring as lead source | Properties with HVAC, electrical, or roofing code violations are pre-qualified leads -- the owner MUST fix the issue. "3 new electrical violations filed in [city] this week." | MEDIUM-HIGH | City open data API integrations, new scraper adapters | Many cities publish code violations via Socrata/CKAN APIs (NYC, Boston, Buffalo, San Diego, Austin, etc.). Build adapters per city, similar to existing permit adapters. Violation type mapping to industry (electrical violations -> electrical contractors, roof violations -> roofers, HVAC violations -> HVAC). |
| Solar incentive tracking | Show applicable state/local incentives on solar leads. "This property qualifies for [state] solar tax credit (25%) + net metering." Helps solar contractors sell to property owners. | HIGH | DSIRE API subscription (paid, contact-for-pricing) or manual curation | DSIRE API is a paid subscription (pricing not public, contact DSIRE-Admin@ncsu.edu). Alternative: manually curate top 10-15 state incentive programs and store in a lookup table. Update quarterly. Much simpler than API integration. **Recommend manual curation for MVP.** |
| Cross-industry lead intelligence | A single commercial permit triggers leads for HVAC, electrical, AND roofing contractors. "This 50,000 sqft office build will need HVAC ($200K+), electrical ($150K+), and roof ($100K+)." Cross-referencing existing data creates exponentially more leads without new data sources. | MEDIUM | Industry tagging engine, project type to industry mapping | Extend existing `inferEquipmentNeeds()` pattern to `inferIndustryRelevance()`. A "commercial new construction" permit maps to `[heavy_equipment, hvac, electrical, roofing]`. A "re-roof" permit maps to `[roofing]`. A "panel upgrade" permit maps to `[electrical]`. |
| EV charging infrastructure leads | Track NEVI program funding rounds per state, utility EV charging incentives, and EV charging permits. High-growth niche for electrical contractors. | MEDIUM | NEVI program tracking (manual curation or AFDC API), new permit type classification | Alternative Fuels Data Center (AFDC) has a free API for EV station data. NEVI funding rounds are state-by-state -- curate as news/bid items. Classify "EV charger" permits via keyword matching in existing permit adapters. |
| Energy benchmarking data as HVAC leads | Cities with mandatory energy benchmarking (NYC, Boston, Chicago, SF, etc.) publish building energy performance data. Buildings with high energy use intensity (EUI) are prime HVAC upgrade targets. | HIGH | City benchmarking data APIs, EUI threshold analysis | Complex but unique. ENERGY STAR Portfolio Manager data is public in mandated cities. Build adapters for top 5 benchmarking cities. Identify buildings with EUI > 150% of median for their type. Tag as HVAC leads. **Defer to post-MVP** due to complexity and limited initial city coverage. |
| Permit cross-referencing for upsell signals | "This property had a roofing permit filed 3 weeks ago -- fresh roof surface is ideal for solar panel installation." Use permit history to surface cross-sell opportunities between industries. | MEDIUM | Historical permit data, cross-industry inference rules | Powerful differentiator. A roofer's completed job becomes a solar installer's warm lead. Requires permit completion tracking (not just filing). Build as an enrichment layer on existing permit data. |
| Urgent lead notification preferences | Let users configure alert thresholds: "Notify me immediately for storm leads within 25 miles" vs "Daily digest for permit leads." Granular notification routing per lead urgency and source type. | MEDIUM | Notification preference schema, email/in-app routing | Extends existing digest infrastructure. Add `notificationPreferences` to user profile: per-source-type thresholds for immediate vs digest. Storm alerts always immediate by default for roofers. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-industry selection per account | "I do HVAC and electrical work" | Scoring becomes ambiguous -- do you score this lead as an HVAC lead or an electrical lead? Feed becomes a mess of mixed relevance. Onboarding can't collect the right profile data for two industries simultaneously. Pricing gets complicated. | One industry per organization. If a contractor does both HVAC and electrical, they create two orgs (or we add sub-profiles later). This keeps scoring clean, onboarding focused, and billing simple. |
| Full CRM with contacts, notes, tasks | "I want to manage my whole pipeline here" | Scope explosion. Building a CRM is a multi-year product. Contractors already have CRMs (JobNimbus, ServiceTitan, Housecall Pro). Trying to compete pulls focus from the actual value: lead discovery. | CRM-lite pipeline (saved/contacted/quoted/in_progress/won/lost) with status tracking. Add notes as a text field per lead-status. Future: integrate with ServiceTitan/Housecall Pro APIs. |
| Real-time storm tracking map | "Show me the storm path in real time on a map" | This is a weather app feature, not a lead gen feature. Building a real-time storm map requires WebSocket connections, map tile rendering, and geographic polygon visualization. Massive engineering cost for a feature users would check once during a storm and forget. | Storm alert notifications (email + in-app banner) with affected area summary and link to NWS storm details page. Users who want maps already have HailTrace ($) or NWS.gov (free). |
| Automated bid response / quote generation | "Auto-generate quotes from lead data" | Requires pricing data per contractor, material cost databases, labor rate calculations. Massively complex, highly error-prone, and liability-creating if a generated quote is wrong. | Show estimated project value range on lead detail. Let contractors use their own quoting tools. The lead value is in discovery, not in quoting. |
| Lead marketplace / selling leads to multiple contractors | "Charge per lead instead of subscription" | Shared leads are low-value leads. If 10 roofers get the same storm lead, the value to each is 1/10th. This model also requires lead exclusivity tracking, credit systems, and dispute resolution. It's the HomeAdvisor model -- widely disliked by contractors. | Subscription model with geographic exclusivity zones (future feature). Each subscriber gets all leads in their radius. No per-lead charges. No sharing visibility. |
| Integration with HailTrace or paid storm data providers | "HailTrace has better storm data than NWS" | HailTrace is a paid service with opaque API pricing. Adding a paid dependency to a core feature (storm alerts) creates cost scaling problems and vendor lock-in. NWS data is free and authoritative. | Use free NWS API for storm alerts. NWS provides severity, location, hail size, wind speed, and geometry polygons. It is the upstream source that HailTrace itself consumes. If NWS data proves insufficient, revisit paid sources later. |
| AI-powered lead summarization | "Use GPT to summarize each lead" | Adds per-lead API cost ($0.01-0.05 per lead at scale = significant OpEx), latency to lead enrichment, and a dependency on external AI services. The value of a lead summary is marginal when the title + project type + location already communicate the essential info. | Structured data presentation: project type badge, location, estimated value, relevant equipment/services. If AI summarization proves valuable later, add it as an optional premium feature. |
| DSIRE API integration for solar incentives | "Pull incentives automatically from DSIRE" | DSIRE API is a paid subscription with opaque pricing (contact for quote). For a bootstrapped product, adding an unknown-cost API dependency before validating the solar vertical is premature. The incentive data also changes slowly (quarterly at most). | Manually curate top 15 state solar incentive programs in a database lookup table. Update quarterly. Show applicable incentives on solar leads based on state. This covers 80% of the value at 10% of the cost. |

---

## Feature Dependencies

```
[Industry Selection (Onboarding Step 0)]
    |
    +---> [Industry-Specific Onboarding Steps]
    |         |
    |         +---> [Company Profile Schema Expansion]
    |                   |
    |                   +---> [Industry-Aware Scoring Engine]
    |                   |         |
    |                   |         +---> [Multi-Industry Lead Feed]
    |                   |                   |
    |                   |                   +---> [Industry Filter Panel]
    |                   |                   +---> [Industry Email Digests]
    |                   |
    |                   +---> [Storm Alert System] (roofing only)
    |                   +---> [Urgent Notification Preferences]
    |
    +---> [Cross-Industry Lead Tagging]
              |
              +---> [Lead Industry Inference Engine]
              |         |
              |         +---> [Cross-Industry Intelligence]
              |         +---> [Permit Cross-Referencing]
              |
              +---> [Multi-Industry SAM.gov NAICS Expansion]

[NWS API Storm Adapter] (independent of onboarding)
    |
    +---> [Storm Alert Notifications]
              |
              +---> [In-App Storm Banner]
              +---> [Immediate Email Alert]

[Code Violation Adapters] (independent of onboarding)
    |
    +---> [Violation-to-Industry Mapping]
    +---> [Violation Leads in Feed]

[CRM-Lite Pipeline Upgrade]
    |-- independent, can ship anytime after schema migration
    |-- extends existing lead_statuses table

[Solar Incentive Lookup Table]
    |-- independent, can ship anytime
    |-- enhances solar lead detail pages
```

### Dependency Notes

- **Industry Selection requires nothing** -- it's the foundation. Everything else flows from knowing the user's industry.
- **Industry-Aware Scoring requires Profile Schema Expansion** -- you can't score for HVAC without knowing the user's HVAC service types.
- **Storm Alert System requires both the NWS adapter AND the roofing profile** -- alerts match against service area, which requires the profile to exist.
- **Cross-Industry Lead Tagging requires the Industry Inference Engine** -- tagging leads with applicable industries requires the rules for which project types map to which industries.
- **Code Violation Adapters are independent** -- they produce leads just like existing permit adapters. They can be built in parallel with onboarding changes.
- **CRM-Lite Pipeline is independent** -- it's a status column expansion. Can ship at any point.
- **Solar Incentive Lookup is independent** -- it's a reference data table. Can ship at any point.

### Critical Path

```
Phase 1: Schema + Onboarding
    Industry selection, profile expansion, industry-specific onboarding
    |
Phase 2: Scoring + Feed
    Industry-aware scoring, cross-industry tagging, filter panel
    |
Phase 3: New Data Sources (parallel tracks)
    Track A: Storm alerts (NWS adapter + notification system)
    Track B: Code violation adapters (city open data)
    Track C: SAM.gov NAICS expansion
    Track D: Solar incentive lookup table
    |
Phase 4: Intelligence + Polish
    Cross-industry lead intelligence, digest templates, CRM pipeline upgrade
```

---

## MVP Definition

### Launch With (v3.0)

Minimum viable multi-industry platform -- what's needed to onboard a non-heavy-equipment contractor and deliver relevant leads.

- [ ] **Industry selection in onboarding** -- Gate everything. Without this, the platform cannot differentiate users.
- [ ] **Industry-specific onboarding for all 5 verticals** -- Each industry must configure its profile for scoring to work.
- [ ] **Company profile schema expansion** -- `industryType`, `profileConfig` (jsonb), updated Drizzle schema.
- [ ] **Industry-aware lead scoring engine** -- Per-industry scoring functions with appropriate weights.
- [ ] **Cross-industry lead tagging** -- `applicableIndustries` array on leads table. Populated during enrichment.
- [ ] **Industry inference rules** -- Extend existing keyword inference to map project types to industries (not just equipment).
- [ ] **Source type filter in lead feed** -- Let users filter by permit/bid/news/storm/violation source types.
- [ ] **SAM.gov multi-industry NAICS expansion** -- Broader NAICS codes for HVAC (238220), electrical (238210), roofing (238160), solar (221114).
- [ ] **CRM-lite pipeline upgrade** -- Add `quoted` and `in_progress` statuses.
- [ ] **Industry-specific email digest templates** -- One template per industry with relevant content layout.

### Add After Validation (v3.1)

Features to add once multi-industry onboarding is working and at least one non-heavy-equipment vertical has active users.

- [ ] **NWS storm alert system** -- Triggered by first paying roofing subscriber. Free NWS API, cron polling every 15 min, email + in-app alerts.
- [ ] **Code violation scraper adapters** -- Start with 2-3 cities that publish violation data via Socrata APIs (Austin, NYC, Boston). Expand based on user geography.
- [ ] **Urgent lead notification preferences** -- Per-source-type alert routing (immediate vs digest). Storm leads default to immediate for roofers.
- [ ] **Solar incentive lookup table** -- Manually curated top 15 state programs. Show on solar lead detail pages.
- [ ] **Cross-industry lead intelligence** -- "This commercial build will need HVAC + electrical + roofing" annotations on lead detail.

### Future Consideration (v3.2+)

Features to defer until product-market fit across multiple verticals is established.

- [ ] **Energy benchmarking data as HVAC leads** -- Requires city-specific APIs, EUI analysis. Only valuable in cities with mandatory benchmarking (NYC, Boston, Chicago, SF).
- [ ] **EV charging infrastructure leads** -- NEVI program tracking, AFDC API integration. Niche within electrical vertical.
- [ ] **Permit cross-referencing for upsell signals** -- "This roofer's completed job = solar installer's warm lead." Requires historical permit tracking.
- [ ] **DSIRE API integration** -- If solar vertical grows significantly and manual curation becomes burdensome.
- [ ] **ServiceTitan/Housecall Pro CRM integrations** -- Two-way sync for contractors who want leads flowing into their existing CRM.
- [ ] **Geographic exclusivity zones** -- "Only 3 roofers per ZIP code" as a premium tier feature.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Industry selection in onboarding | HIGH | LOW | P1 |
| Industry-specific onboarding (all 5) | HIGH | MEDIUM | P1 |
| Company profile schema expansion | HIGH (enables everything) | MEDIUM | P1 |
| Industry-aware scoring engine | HIGH | MEDIUM-HIGH | P1 |
| Cross-industry lead tagging | HIGH | MEDIUM | P1 |
| Industry inference rules | HIGH | MEDIUM | P1 |
| Source type filter in feed | MEDIUM | LOW | P1 |
| SAM.gov NAICS expansion | MEDIUM | LOW | P1 |
| CRM-lite pipeline upgrade | MEDIUM | LOW | P1 |
| Industry email digest templates | MEDIUM | MEDIUM | P1 |
| NWS storm alert system | HIGH (roofing) | MEDIUM-HIGH | P2 |
| Code violation adapters | HIGH (HVAC/electrical) | MEDIUM-HIGH | P2 |
| Urgent notification preferences | MEDIUM | MEDIUM | P2 |
| Solar incentive lookup | MEDIUM (solar) | LOW | P2 |
| Cross-industry intelligence | MEDIUM | MEDIUM | P2 |
| Energy benchmarking leads | MEDIUM (HVAC) | HIGH | P3 |
| EV charging leads | LOW-MEDIUM | MEDIUM | P3 |
| Permit cross-referencing | MEDIUM | MEDIUM | P3 |
| DSIRE API integration | LOW (manual curation sufficient) | HIGH | P3 |

**Priority key:**
- P1: Must have for multi-industry launch
- P2: Should have within 1-2 sprints of launch
- P3: Nice to have, revisit based on user traction per vertical

---

## Competitor Feature Analysis

| Feature | Shovels.ai | Construction Monitor | BuildZoom | HailTrace | LeadForge Approach |
|---------|-----------|---------------------|-----------|-----------|-------------------|
| Multi-industry permits | Yes (170M+ permits) | Yes | Yes | No | Build scraper adapters per city. Smaller scale but free. Add industry tagging. |
| Storm alerts | No | No | No | Yes ($$$) | Free NWS API. Same data source HailTrace consumes. Good enough for alerts. |
| Code violations | No | No | No | No | Open data APIs. Unique differentiator nobody else is offering as lead gen. |
| Solar incentives | No | No | No | No | Manual curation of state programs. Unique in lead gen context. |
| CRM pipeline | No (data only) | No | Basic | No | CRM-lite status tracking. Not competing with full CRMs. |
| Lead scoring | No (raw data) | Basic | Yes | No | Industry-specific scoring with multiple dimensions. Strongest of the group. |
| Email digests | No | Yes | No | No | Industry-specific digest templates. |
| Cross-industry intelligence | No | No | No | No | Unique. "This permit is relevant to 3 industries." |
| Pricing model | API pricing ($500+/mo) | Subscription | Free + premium | Subscription ($$$) | Subscription. Lower price point targeting individual contractors, not enterprises. |

**Key takeaway:** No single competitor combines multi-industry lead discovery + storm alerts + code violations + scoring + CRM-lite pipeline. The closest competitors are either data providers (Shovels, Construction Monitor) that sell raw data, or niche tools (HailTrace) that serve one vertical. LeadForge's differentiation is the integrated, scored, actionable experience across multiple blue-collar verticals.

---

## Industry-Specific Feature Deep Dives

### HVAC Contractors

**Lead sources:** Mechanical permits (new HVAC installations), building permits (new construction with HVAC component), code violations (HVAC system failures, ventilation issues), news (commercial construction projects mentioning HVAC), SAM.gov bids (NAICS 238220).

**Unique scoring dimension:** Seasonal relevance. AC-related leads score 10% higher in March-August. Heating-related leads score 10% higher in September-February. Keyword matching on "cooling", "AC", "air conditioning" vs "heating", "furnace", "boiler".

**Onboarding specifics:** Service categories (install/repair/maintenance), system types (determines which permit descriptions match), residential vs commercial focus, service radius (typically 10-100 miles, smaller than heavy equipment).

**Future opportunity:** Energy benchmarking data from cities with mandatory disclosure (NYC Local Law 84/97, Boston BERDO, Chicago benchmarking ordinance). Buildings with high EUI scores are prime targets for HVAC system replacement. Defer to v3.2+ due to complexity.

### Roofing Contractors

**Lead sources:** Building permits (re-roofing, new construction), storm alerts (NWS hail/wind/tornado warnings), code violations (roof deterioration, leak complaints), news (large commercial/institutional projects), SAM.gov bids (NAICS 238160).

**Unique scoring dimension:** Storm urgency. Leads generated from storm events within 48 hours get a 25-point urgency boost. The roofing industry is fundamentally event-driven: 22% of US residential roof replacements in 2024 were storm-caused. First responders capture 50-78% of storm work.

**Storm alert UX:** When a severe weather event hits a roofer's service area:
1. Cron job polls NWS `/alerts/active?area={state}` every 15 minutes
2. Filter for events with `event` containing "Hail", "Tornado", "Severe Thunderstorm"
3. Match alert `affectedZones` or `geometry` against user's service area (center point + radius)
4. If match: create in-app banner ("Storm Alert: Hail reported near [city]") + send immediate email
5. Automatically generate storm-sourced leads for the affected area
6. Storm leads appear at top of feed due to urgency scoring boost

**Onboarding specifics:** Service categories (critical: storm damage restoration is a distinct business type), material specializations (determines which permit descriptions match), residential vs commercial.

### Solar Installation

**Lead sources:** Building permits (solar panel installation, electrical panel upgrades for solar), news (IRA incentive announcements, utility program launches), SAM.gov bids (NAICS 221114 + 238220 for solar-related work), permit cross-references (recent roofing permits = fresh roof surface for solar).

**Unique scoring dimension:** Incentive value. Leads in states with active solar incentives (NY 25% tax credit, SC 25%, MA 15%, NJ SREC-II, IL Adjustable Block Program) score higher. Simple state-based lookup.

**Critical context for 2026:** The residential federal solar tax credit (ITC 30% under IRS Section 25D) expired December 31, 2025. Commercial projects must begin construction by July 4, 2026. This shifts solar lead value to states with strong state-level incentives. LeadForge should surface this context on solar leads.

**Onboarding specifics:** Residential vs commercial focus (heavily affects lead relevance), battery storage capability, certifications (NABCEP matters for commercial work).

### Electrical Contractors

**Lead sources:** Electrical permits, building permits (new construction with electrical component), EV charging permits (growing rapidly), code violations (electrical safety violations are common and urgent), SAM.gov bids (NAICS 238210), news (data center construction, EV charging infrastructure announcements).

**Unique scoring dimension:** EV/solar growth signal. Leads related to EV charging installations or solar interconnect work score 10% higher because they signal a high-growth, higher-margin segment. Keyword matching on "EV", "charger", "solar", "panel upgrade", "200 amp".

**EV charging opportunity:** The NEVI program ($5B, 2022-2026) funds EV charger installation along highway corridors. $885M apportioned for FY 2026. 21+ states opening or planning new funding rounds in 2026. Each installation needs licensed electrical contractors. These are high-value leads ($50K-500K per station).

**Onboarding specifics:** Service specializations (critical: EV charging and solar interconnect are distinct high-value niches), residential vs commercial vs industrial, generator installation capability.

---

## Data Source Feasibility Summary

| Data Source | Availability | Cost | Complexity | Confidence |
|-------------|-------------|------|------------|------------|
| NWS Alerts API | Public, no auth (User-Agent only) | Free | LOW-MEDIUM | HIGH -- well-documented, JSON format, 7-day history |
| City Permit APIs (Socrata) | Varies by city, 50+ cities | Free | MEDIUM (per-city adapter) | HIGH -- existing pattern with Austin/Atlanta/Dallas |
| Code Violation APIs | Varies by city, 20+ cities | Free | MEDIUM (per-city adapter) | MEDIUM -- less standardized than permits, but Socrata-based cities are straightforward |
| SAM.gov Opportunities API | Public, requires API key | Free | LOW (extend existing adapter) | HIGH -- already integrated |
| DSIRE API | Subscription, contact for pricing | Paid (unknown) | HIGH | LOW -- pricing unknown, manual curation is the alternative |
| AFDC (EV station data) | Public API | Free | LOW-MEDIUM | MEDIUM -- need to verify relevance for lead gen |
| Energy benchmarking data | City-specific, 10-15 cities | Free | HIGH (per-city) | MEDIUM -- valuable but limited coverage |
| Shovels API (permits) | Commercial API | $500+/mo | LOW (well-documented) | HIGH -- but adds significant cost |
| HailTrace API | Commercial, opaque pricing | Paid (unknown) | MEDIUM | LOW -- pricing unknown, NWS is the free alternative |

---

## Sources

### Storm Alerts and Weather Data
- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api) -- HIGH confidence (official docs)
- [NWS Alerts Web Service](https://www.weather.gov/documentation/services-web-alerts) -- HIGH confidence (official docs)
- [NWS API FAQs (GitHub)](https://weather-gov.github.io/api/general-faqs) -- HIGH confidence (official)
- [Salesgenie: Roofing Lead Generation Strategies](https://www.salesgenie.com/blog/roofing-lead-playbook-storm-response-seo-field-execution-tips/) -- MEDIUM confidence
- [PredictiveSalesAI: Storm-Driven Lead Generation](https://www.predictivesalesai.com/blog/p.250902000/the-contractors-guide-to-storm-driven-lead-generation/) -- MEDIUM confidence
- [KnockBase: HailTrace Data for Storm Response Sales](https://www.knockbase.com/blog/using-hail-trace-data-for-storm-response-sales-a-tactical-guide-for-roofing-teams) -- MEDIUM confidence

### Solar Incentives
- [DSIRE Database](https://www.dsireusa.org/) -- HIGH confidence (official)
- [DSIRE API](https://www.dsireusa.org/dsire-api/) -- HIGH confidence (official, pricing undisclosed)
- [ACDirect: 2026-2027 Solar & HVAC Incentives State-by-State](https://www.acdirect.com/blog/2026-2027-us-solar-hvac-incentives-post-federal-credit-era/) -- MEDIUM confidence
- [Powerlutions: Federal Incentives Changing in 2026](https://powerlutions.com/blog/federal-incentives-changing-in-2026-and-their-impact-on-solar-projects/) -- MEDIUM confidence

### EV Charging / NEVI
- [AFDC: NEVI Formula Program](https://afdc.energy.gov/laws/12744) -- HIGH confidence (official DOE)
- [Qmerit: NEVI Program Updates](https://qmerit.com/blog/nevi-program-charging-incentive-updates) -- MEDIUM confidence
- [BTC Power: EV Charger Incentive Stacking Guide](https://btcpower.com/blog/ev-charger-incentives-and-funding-the-smart-guide-to-stacking-incentives-in-2025-2026/) -- MEDIUM confidence

### Building Permits and Multi-Industry
- [Shovels.ai: Construction Leads from Permit Data](https://www.shovels.ai/blog/construction-leads-permit-data/) -- MEDIUM confidence
- [Construction Monitor: Using Building Permit Data](https://blog.constructionmonitor.com/2014/03/28/using-building-permit-data/) -- MEDIUM confidence
- [BuildZoom: 7 Hidden Construction Leads](https://www.buildzoom.com/blog/7-hidden-project-opportunities-you-can-spot-with-building-permit-data) -- MEDIUM confidence

### SAM.gov and NAICS
- [ConstructionBids.ai: NAICS Codes for Federal Contracts](https://constructionbids.ai/blog/naics-codes-federal-construction-contracts-2026) -- MEDIUM confidence
- [SamSearch: NAICS 238 Specialty Trade Contractors](https://samsearch.co/naics-ai-lookup/238) -- MEDIUM confidence

### Code Violations
- [NYC Open Data: Housing Maintenance Code Violations](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5) -- HIGH confidence (official city data)
- [Data.gov: Code Enforcement Datasets](https://catalog.data.gov/dataset/?tags=code-enforcement) -- HIGH confidence (official)
- [CodeViolationLeads.com](https://codeviolationleads.com/) -- LOW confidence (commercial service)

### Energy Benchmarking
- [EIA: CBECS](https://www.eia.gov/consumption/commercial/) -- HIGH confidence (official federal data)
- [DOE: Building Energy Data](https://www.energy.gov/eere/buildings/building-energy-data) -- HIGH confidence (official)

### HVAC Permits
- [PermitFlow: HVAC Permit Guide](https://www.permitflow.com/blog/hvac-permit) -- MEDIUM confidence
- [ServiceTitan: HVAC Lead Generation Strategies](https://www.servicetitan.com/blog/how-to-get-hvac-leads) -- MEDIUM confidence

### Filter UX
- [NN/g: Filter Categories and Values for Better UX](https://www.nngroup.com/articles/filter-categories-values/) -- HIGH confidence (authoritative UX research)
- [Eleken: Filter UI Examples for SaaS](https://www.eleken.co/blog-posts/filter-ux-and-ui-for-saas) -- MEDIUM confidence

### CRM Pipeline
- [Default: B2B Sales Pipeline Guide](https://www.default.com/post/b2b-sales-pipeline) -- MEDIUM confidence
- [Pipedrive: Pipeline Management](https://www.pipedrive.com) -- MEDIUM confidence (established CRM product patterns)

---
*Feature research for: LeadForge v3.0 Multi-Industry Expansion*
*Researched: 2026-03-16*
