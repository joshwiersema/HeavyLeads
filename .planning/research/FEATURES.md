# Feature Research

**Domain:** Heavy Machinery / Construction Equipment Lead Generation SaaS
**Researched:** 2026-03-13
**Confidence:** MEDIUM-HIGH

## Competitive Landscape Context

Before mapping features, it is important to understand who HeavyLeads is competing against, because the feature expectations differ based on the competitive tier.

**Direct competitors (construction lead services):**
- Dodge Construction Central (~$6,000-$12,000/seat/year) -- deep project intelligence, planning-through-completion tracking, 10M+ historical projects
- ConstructConnect (~$4,800/seat/year) -- 1M+ projects across 400+ markets, integrated takeoff tools, bid management
- Construct-A-Lead -- commercial project database with material lists, pre-bid access, email alerts
- Construction Monitor (~31.5M permits in database) -- permit-based leads, hourly updates, Powersearch, REST API
- Building Radar -- AI-driven early project detection across 100+ countries, 45+ filters, CRM integration, outreach templates

**Adjacent competitors (permit data providers):**
- Shovels.ai -- 170M+ building permits, 3M+ contractors, API-first, $5M seed round
- ATTOM Data -- 158M+ properties with permit data via API

**Indirect competitors (general B2B intelligence):**
- ZoomInfo -- 500M+ B2B contacts, firmographic data, but no construction project specificity
- Apollo.io -- lead scraping and enrichment, general-purpose
- LinkedIn Sales Navigator -- stakeholder identification, not project-aware

**Key gap HeavyLeads fills:** None of the above are built specifically for heavy machinery dealers and rental companies. They serve general contractors, subcontractors, and suppliers broadly. HeavyLeads targets a specific buyer persona (equipment sales rep at a dealership like New Tec) with a specific value prop (daily feed of equipment-relevant leads, not construction bids).

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these means the product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Daily lead feed / dashboard** | Core value prop. Every competitor delivers a feed of leads. Sales reps expect to "open and see what's new." | MEDIUM | Must feel fresh daily. Stale data = immediate churn. Calendar/list view toggle is standard. |
| **Geographic filtering** | Every construction lead service offers location-based filtering. Dodge, ConstructConnect, Construction Monitor all have it. Equipment dealers serve regional markets. | LOW | Radius-based from HQ (per PROJECT.md decision) is more intuitive than state-based for this persona. |
| **Equipment type / project type filtering** | Dealers sell specific machine categories. Showing irrelevant leads (e.g., painting projects to an excavator dealer) wastes time and erodes trust. | MEDIUM | Needs a well-designed taxonomy mapping project types to equipment needs. This mapping IS the product intelligence. |
| **Lead detail view** | Users need to drill into a lead to see project info, contacts, estimated value, and context before acting. Every competitor provides this. | MEDIUM | Should include: project description, location/map, key contacts, estimated equipment needs, source attribution. |
| **Search and filtering** | Construction Monitor has Powersearch. Dodge has advanced filters. Users expect to search by keyword, date range, project type, value range, location. | MEDIUM | Start with essential filters (geo, equipment type, date, project size). Avoid filter overload in v1. |
| **User authentication and account management** | Standard SaaS expectation. Multi-tenant requires proper auth, roles, and account isolation. | MEDIUM | Email/password + SSO later. Company-level accounts with user seats. |
| **Company onboarding / profile setup** | Competitors require initial configuration (service area, trade types). Without this, leads are unfocused noise. | LOW | Wizard: set HQ location, equipment types sold/rented, service radius. This configures the lead feed. |
| **Email notifications / alerts** | Dodge, ConstructConnect, Construct-A-Lead all send email alerts for new matching leads. Sales reps live in email. | LOW | Daily digest email is minimum. "New leads matching your criteria" with links back to dashboard. |
| **Data freshness indicators** | Users need to know when a lead was discovered and how fresh the underlying data is. Stale leads poison trust. | LOW | Show "discovered date," "source last updated," and age badges (New, This Week, Older). |
| **Saved searches / bookmarks** | Standard in Dodge, ConstructConnect, Construction Monitor. Reps track specific opportunities over time. | LOW | Bookmark individual leads + save filter configurations for quick re-access. |

### Differentiators (Competitive Advantage)

Features that set HeavyLeads apart from general construction lead services. These are where competitive advantage lives.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Equipment-need inference from project data** | No competitor automatically maps "12-story hotel construction" to "likely needs: excavators, boom lifts, cranes, telehandlers." This is HeavyLeads' core intelligence layer. | HIGH | Requires an equipment-to-project-type mapping model. Start rule-based, graduate to ML. This is the "magic" that justifies the product. |
| **Dual lead type detection (projects + fleet expansion)** | Competitors focus on project leads only. Detecting rental companies looking to expand/upgrade fleet is a second revenue signal unique to equipment dealers. | HIGH | Different data sources: job postings ("fleet manager"), press releases, SEC filings for public companies, trade publication announcements. Much harder to scrape systematically. |
| **Outreach talking points / coaching** | Building Radar offers outreach templates, but they are generic. HeavyLeads can generate equipment-specific talking points: "They are breaking ground on a 50-acre solar farm -- they will need telehandlers and rough terrain forklifts for panel installation." | MEDIUM | Not automated outreach (per PROJECT.md anti-feature). Contextual suggestions that make the sales rep sound informed. LLM-powered in v2, template-based in v1. |
| **Multi-source aggregation with deduplication** | Most competitors are single-source (permits OR bid boards OR news). HeavyLeads scrapes permits, bid boards, news, and deep web, then deduplicates into a single lead. | HIGH | Deduplication across sources is the hard part. Same project appears in permits, news, and bid boards -- must merge into one lead with multiple source attributions. |
| **Google dorking / deep web discovery** | No major competitor openly does programmatic Google dorking for construction leads. This surfaces leads from job postings, PDFs, planning documents that never hit traditional databases. | HIGH | Legal and ethical considerations around scraping. Must respect robots.txt. Rate limiting essential. But this is a genuine moat if done well. |
| **Equipment-specific lead scoring** | General lead scoring exists (Building Radar scores by fit/revenue), but scoring specifically for "how likely does this project need MY equipment types" does not exist in market. | MEDIUM | Score based on: project type match, geographic proximity, project size/value, timeline alignment, equipment type relevance. |
| **Permit-to-equipment timeline mapping** | Permits indicate project phase. Different equipment is needed at different phases (earthwork = excavators early; finishing = boom lifts later). Timing the outreach matters. | MEDIUM | Maps project phase to equipment need windows. "This project is in earthwork phase -- excavator outreach NOW. Boom lift outreach in 3 months." |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. These are explicitly out of scope per PROJECT.md or should be resisted.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automated email outreach** | Building Radar and general tools (Apollo, ZoomInfo) offer this. Customers will ask for it. | Spam risk, CAN-SPAM compliance burden, wrong tone for relationship-driven equipment sales, reputation damage. Equipment sales are high-touch, high-trust. Automated emails undermine this. PROJECT.md explicitly excludes this. | Provide outreach talking points and contact info. Let the rep make the call or write the email themselves. |
| **Full CRM replacement** | "Why can't I manage my whole pipeline here?" Equipment dealer CRMs (Texada, Flyntlok) exist. | Massive scope creep. CRM is a decade-long product category. Building a mediocre CRM alongside lead gen dilutes both. | Provide lead status tracking (New/Contacted/Won/Lost) in-app. Export to CSV. CRM integration deferred to v2 per PROJECT.md. |
| **Real-time chat / messaging** | Modern SaaS products have in-app messaging. | Not core to lead discovery. Adds complexity (WebSocket infra, notification systems). Equipment sales conversations happen on phones, not chat. PROJECT.md excludes this. | Link to phone numbers and email addresses in lead detail view. |
| **Mobile native app** | Sales reps are in the field. Mobile access seems obvious. | Native app doubles development cost and timeline. Equipment reps typically review leads in the morning at the office, not on job sites. | Responsive web design works on mobile browsers. Native app deferred to v2 per PROJECT.md. |
| **Predictive analytics / forecasting** | Dodge offers market forecasting. Building Radar has "revenue engineering." | Requires massive historical data that a new product does not have. Predictions without sufficient data are worse than no predictions -- they erode trust. | Show simple trend indicators: "X% more permits filed in your area vs last month." No forecasts until data volume supports it. |
| **International coverage** | Building Radar covers 100+ countries. | U.S. permit/bid data formats vary wildly by municipality already. International adds orders of magnitude of complexity for a market that is not validated yet. PROJECT.md scopes to U.S. only. | U.S. only for v1. Revisit after PMF. |
| **Automated lead qualification / scoring without user feedback** | AI-powered lead scoring is trendy. | Without historical conversion data from actual users, automated scoring is guesswork presented as intelligence. Cold-start problem. | Manual lead status tracking (New/Contacted/Won/Lost) in v1. Use this data to train scoring models for v2+. |

## Feature Dependencies

```
[Company Onboarding (HQ, equipment types, radius)]
    |
    +--requires--> [Daily Lead Feed]
    |                  |
    |                  +--requires--> [Data Scraping Pipeline]
    |                  |                  |
    |                  |                  +--requires--> [Permit Scraping]
    |                  |                  +--requires--> [Bid Board Scraping]
    |                  |                  +--requires--> [News/Press Scraping]
    |                  |                  +--requires--> [Google Dorking Engine]
    |                  |
    |                  +--requires--> [Deduplication Engine]
    |                  +--requires--> [Equipment-Need Inference]
    |
    +--enables---> [Geographic Filtering]
    +--enables---> [Equipment Type Filtering]

[Lead Detail View]
    +--requires--> [Contact Extraction/Enrichment]
    +--enhances--> [Outreach Talking Points]

[Email Notifications]
    +--requires--> [Daily Lead Feed]
    +--requires--> [User Preferences / Saved Searches]

[Lead Status Tracking (New/Contacted/Won/Lost)]
    +--enables--> [Equipment-Specific Lead Scoring] (v2, needs conversion data)

[Fleet Expansion Detection]
    +--independent--> [Project Lead Pipeline] (separate data sources)
    +--requires--> [Job Posting Scraping]
    +--requires--> [Press Release Monitoring]

[Auth & Multi-Tenancy]
    +--requires--> [User Authentication]
    +--requires--> [Company Account Isolation]
    +--enables--> [All other features]
```

### Dependency Notes

- **Company Onboarding requires Auth**: Users must have accounts before configuring their company profile.
- **Daily Lead Feed requires Data Scraping Pipeline**: No leads without data ingestion. This is the foundational infrastructure.
- **Equipment-Need Inference requires Onboarding + Scraping**: Must know what equipment the user sells AND have project data to match against.
- **Deduplication requires multiple sources**: Only needed once 2+ scraping sources are active. Can be deferred if launching with single source.
- **Fleet Expansion Detection is independent**: Entirely separate data pipeline from project leads. Can be built in parallel or deferred.
- **Lead Scoring requires Lead Status history**: Cold-start problem. Need users marking leads as Won/Lost before scoring models have training data.
- **Outreach Talking Points enhance Lead Detail**: Not required for lead detail to be useful, but significantly increases value. Can be added incrementally.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate the core value proposition: "Open HeavyLeads, see fresh relevant leads you would have missed."

- [ ] **Auth + multi-tenant accounts** -- foundational infrastructure, non-negotiable
- [ ] **Company onboarding wizard** -- set HQ, equipment types, service radius (configures the feed)
- [ ] **Permit data scraping pipeline** -- start with permits as primary data source (largest, most structured, most accessible). Target top 50 metro areas.
- [ ] **Equipment-need inference (rule-based)** -- map permit types/descriptions to equipment categories. This is the differentiator even in v1.
- [ ] **Daily lead feed dashboard** -- list view of leads matching user profile, sorted by recency, with age badges
- [ ] **Geographic + equipment type filtering** -- basic filtering on the feed
- [ ] **Lead detail view** -- project info, location on map, contacts (when available), estimated equipment needs, source info
- [ ] **Lead status tracking** -- simple: New / Viewed / Contacted / Won / Lost. Seed data for future scoring.
- [ ] **Daily email digest** -- "You have X new leads today" with top 5 leads summarized, link to dashboard

### Add After Validation (v1.x)

Features to add once the core feed is working and early users confirm value.

- [ ] **Bid board scraping** -- second data source, add after permit pipeline is stable
- [ ] **News / press release scraping** -- third data source, broadens lead coverage
- [ ] **Multi-source deduplication** -- needed once 2+ sources are active
- [ ] **Saved searches and bookmarks** -- users will request this quickly once using the product
- [ ] **Outreach talking points** -- template-based initially ("For a project of this type, consider mentioning...")
- [ ] **Search and advanced filtering** -- keyword search, value range, date range, project phase
- [ ] **Lead export (CSV)** -- for users who want to push leads into their existing CRM

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Google dorking / deep web discovery** -- high value but high complexity and legal scrutiny. Validate PMF first.
- [ ] **Fleet expansion detection** -- entirely separate data pipeline. Validate project leads value first.
- [ ] **CRM integration** -- Salesforce, HubSpot connectors. Per PROJECT.md, deferred to v2.
- [ ] **Equipment-specific lead scoring (ML)** -- needs conversion data from v1 lead status tracking
- [ ] **Permit-to-equipment timeline mapping** -- valuable but requires project phase detection which is complex
- [ ] **Contact enrichment** -- cross-referencing contacts with LinkedIn, company websites for verified emails/phones
- [ ] **Mobile native app** -- only if responsive web proves insufficient for field use
- [ ] **LLM-powered outreach coaching** -- upgrade talking points from templates to AI-generated contextual suggestions
- [ ] **Team collaboration features** -- lead assignment, notes, shared pipeline view
- [ ] **Analytics dashboard** -- lead volume trends, conversion rates, ROI metrics

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Daily lead feed / dashboard | HIGH | MEDIUM | P1 |
| Permit data scraping pipeline | HIGH | HIGH | P1 |
| Equipment-need inference (rule-based) | HIGH | MEDIUM | P1 |
| Geographic filtering (radius) | HIGH | LOW | P1 |
| Equipment type filtering | HIGH | LOW | P1 |
| Lead detail view | HIGH | MEDIUM | P1 |
| Auth + multi-tenancy | HIGH | MEDIUM | P1 |
| Company onboarding wizard | HIGH | LOW | P1 |
| Daily email digest | MEDIUM | LOW | P1 |
| Lead status tracking | MEDIUM | LOW | P1 |
| Data freshness indicators | MEDIUM | LOW | P1 |
| Bid board scraping | HIGH | HIGH | P2 |
| News/press scraping | MEDIUM | HIGH | P2 |
| Multi-source deduplication | MEDIUM | HIGH | P2 |
| Saved searches / bookmarks | MEDIUM | LOW | P2 |
| Outreach talking points | MEDIUM | MEDIUM | P2 |
| Search + advanced filtering | MEDIUM | MEDIUM | P2 |
| Lead export (CSV) | LOW | LOW | P2 |
| Google dorking engine | HIGH | HIGH | P3 |
| Fleet expansion detection | HIGH | HIGH | P3 |
| CRM integration | MEDIUM | HIGH | P3 |
| ML lead scoring | MEDIUM | HIGH | P3 |
| Contact enrichment | MEDIUM | MEDIUM | P3 |
| Timeline/phase mapping | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- validates core value prop
- P2: Should have, add in v1.x after core is stable
- P3: Future consideration, requires PMF validation first

## Competitor Feature Analysis

| Feature | Dodge Construction Central | ConstructConnect | Building Radar | Construction Monitor | HeavyLeads (Our Approach) |
|---------|--------------------------|------------------|----------------|---------------------|---------------------------|
| Project leads database | 10M+ historical projects | 1M+ public/private projects | AI-detected from 100+ countries | 31.5M permits | Aggregated from permits, bids, news. Smaller but equipment-focused. |
| Geographic filtering | By region, metro | By market (400+) | 45+ filters incl. region | By area, mapped | Radius from dealer HQ -- more intuitive for regional equipment dealers |
| Project type filtering | By work type, ownership | By project type | By trade, budget, timeline | By construction type/class | By equipment type needed (unique angle) |
| Contact info | Key stakeholders | Project contacts | AI-enriched contacts, decision-makers | Builders, GCs with phones/addresses | Contacts when available from source data. Enrichment in v2. |
| Alerts / notifications | Dashboard + email | Email alerts | Real-time monitoring | Email alerts, hourly updates | Daily email digest with equipment-relevant lead summary |
| Outreach tools | None native | Bid management tools | Adaptive scripts, email templates, CRM sync | None native | Talking points (not automated outreach). Equipment-specific context. |
| Pricing | $6K-$12K/seat/year | ~$4,800/year | Enterprise (undisclosed) | Undisclosed | Setup fee + subscription. Target significantly below Dodge/ConstructConnect. |
| Equipment focus | None (general construction) | None (general construction) | None (general construction) | None (general construction) | Primary focus. Equipment-need inference is the product. |
| API access | Limited | Limited | CRM connectors | REST API | Not in v1. CSV export. API in v2+. |

## Sources

- [Building Radar - Best Lead Generation Tools for Construction Sales 2025](https://www.buildingradar.com/construction-blog/best-lead-generation-tools-for-construction-sales-2025)
- [Dodge Construction Central - Project Leads & Data](https://www.construction.com/solutions/dodge-construction-central/)
- [ConstructConnect - Finding and Winning Projects](https://www.constructconnect.com/)
- [ConstructConnect vs Dodge - SelectHub Comparison](https://www.selecthub.com/construction-bidding-software/constructconnect-vs-dodge-data-and-analytics/)
- [Construction Monitor - Building Permits & Leads](https://www.constructionmonitor.com/)
- [Construct-A-Lead - Solutions for Suppliers](https://www.constructalead.com/solutions/suppliers/)
- [Shovels.ai - Building Permit API](https://www.shovels.ai/api)
- [Shovels - Construction Leads Using Permit Data](https://www.shovels.ai/blog/construction-leads-permit-data/)
- [ATTOM Data - Building Permit Data](https://www.attomdata.com/data/property-data/nationwide-building-permit-data/)
- [Texada Software - Equipment Dealer CRM](https://texadasoftware.com/equipment-dealer-crm/)
- [Nutshell CRM - Heavy Equipment Dealers](https://www.nutshell.com/industries/heavy-equipment)
- [RepMove - Equipment Rental Sales Software](https://repmove.app/equipment-rental-sales-software/)
- [Dodge vs ConstructConnect - 412-Firm Comparison](https://constructionbids.ai/blog/dodge-vs-constructconnect-comparison)
- [Construction Marketing Association - Lead Services Comparison](https://blog.constructionmarketingassociation.org/construction-lead-services-comparison/)
- [Construction Equipment Rental Market Size Report 2033](https://www.grandviewresearch.com/industry-analysis/construction-equipment-rental-market)

---
*Feature research for: Heavy Machinery / Construction Equipment Lead Generation SaaS*
*Researched: 2026-03-13*
