# Feature Research: GroundPulse v4.0 Nationwide Lead Sources

**Domain:** Public data sources for construction lead generation across all 50 US states
**Researched:** 2026-03-19
**Confidence:** HIGH for data source existence and API formats; MEDIUM for coverage completeness of any single source; LOW for some niche sources (lien filings, planning board minutes)

---

## Scope

This document catalogs every viable public data source for generating actionable construction leads for GroundPulse's 5 target industries: heavy equipment, HVAC, roofing, solar, and electrical contractors. Focus is exclusively on NEW sources and features needed for nationwide coverage -- existing adapters (3 Socrata permit cities, SAM.gov, NWS, FEMA, violations, news, EIA, solar incentives, Google dorking) are referenced only for dependency context.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Data sources that any nationwide construction lead platform must have. Missing these means the product has obvious geographic or lead-type gaps.

#### 1. Dynamic Socrata Permit Discovery (Nationwide)

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Building permits are the #1 lead type for every construction vertical. Currently limited to 3 cities. Competitors like Shovels cover 2,000+ jurisdictions. |
| **Complexity** | HIGH |
| **What It Is** | Instead of hardcoded per-city Socrata adapters, use the Socrata Discovery API to find ALL building permit datasets across all Socrata-powered portals, then dynamically instantiate adapters for each. |
| **API Endpoint** | `GET https://api.us.socrata.com/api/catalog/v1?q=building+permits&only=datasets&limit=100&offset=0` |
| **How It Works** | 1. Query Discovery API for datasets matching "building permits", "construction permits", "issued permits". 2. Parse response for domain + dataset ID pairs. 3. For each discovered dataset, inspect column metadata via `GET https://{domain}/api/views/{id}.json` to identify date, address, description, value columns. 4. Auto-generate SocrataPermitAdapter configs with mapped fields. 5. Cache discovered datasets (refresh weekly). |
| **Known Portals with Permit Data** | data.cityofchicago.org (ydr8-5enu), data.seattle.gov (76t5-zqzr), data.sfgov.org (p4e4-a5a7), data.cambridgema.gov (9qm7-wbdc), data.sandiegocounty.gov (dyzh-7eat), data.cityofnewyork.us (ipu4-2vj7), data.boston.gov, data.lacity.org, data.colorado.gov, data.cincinnati-oh.gov, data.nashville.gov, data.nola.gov, data.kcmo.org, data.detroitmi.gov, opendata.minneapolismn.gov, data.cityofgainesville.org, and 100+ more |
| **Rate Limits** | 1,000 requests/hour without app token; higher with SOCRATA_APP_TOKEN. Discovery API itself is lightweight. |
| **Coverage** | ~200-400 cities/counties on Socrata. Covers most major metros. |
| **Dependencies** | Existing SocrataPermitAdapter base class (extend with auto-field-mapping). |
| **Industry Relevance** | ALL (heavy equipment, HVAC, roofing, solar, electrical) |

#### 2. Dynamic ArcGIS Hub Permit Discovery (Nationwide)

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Many cities not on Socrata publish permits through ArcGIS Hub. Currently only Atlanta is covered. |
| **Complexity** | HIGH |
| **What It Is** | Use the ArcGIS Hub Search API to discover building permit datasets across all ArcGIS-powered open data portals, then auto-instantiate adapters. |
| **API Endpoint** | `GET https://hub.arcgis.com/api/v3/datasets?filter[keyword]=building+permits&filter[type]=Feature+Service&page[size]=100` |
| **How It Works** | 1. Query ArcGIS Hub Search API for datasets matching "building permits", "construction permits". 2. For each result, extract the Feature Service URL. 3. Query the Feature Service metadata endpoint to discover field names. 4. Auto-map fields (permit_number, address, description, issue_date, geometry). 5. Create adapter instances using the GeoJSON download or Feature Service query endpoint. |
| **Data Format** | GeoJSON (geometry included, so geocoding is free). Feature Services also support REST queries with pagination. |
| **Known Hubs** | Denver, Phoenix, Charlotte, Portland, San Antonio, Orlando, Indianapolis, Columbus OH, Virginia Beach, Honolulu, and many county-level hubs. |
| **Rate Limits** | Generally no API key required for public datasets. Feature Service queries are generous. |
| **Coverage** | ~100-300 additional jurisdictions not on Socrata. |
| **Dependencies** | Existing AtlantaPermitsAdapter pattern (generalize to ArcGISPermitAdapter base class). |
| **Industry Relevance** | ALL |

#### 3. USAspending.gov Federal Contract Awards

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | SAM.gov shows bid opportunities, but USAspending shows awarded contracts -- confirmed projects with money allocated. These are higher-quality leads. |
| **Complexity** | MEDIUM |
| **What It Is** | Query awarded federal construction contracts to surface active projects where subcontractors, equipment, and materials are needed. |
| **API Endpoint** | `POST https://api.usaspending.gov/api/v2/search/spending_by_award/` |
| **Key Endpoints** | - `/api/v2/search/spending_by_award/` - search awards by NAICS, location, date range. - `/api/v2/search/spending_by_category/naics/` - spending by NAICS code. - `/api/v2/awards/{id}/` - award detail with recipient, amounts, performance location. |
| **NAICS Codes** | 236 (Building Construction), 237 (Heavy/Civil), 238 (Specialty Trade), 238210 (Electrical), 238220 (Plumbing/HVAC), 238160 (Roofing), 221114 (Solar). |
| **Data Quality** | HIGH -- official federal spending data with award amounts, contractor names, performance locations. |
| **No API Key Required** | Free, open, no authentication needed. |
| **Rate Limits** | Undocumented but generous. Recommended: 1 request/second. |
| **Coverage** | All federal construction spending nationwide. Billions in annual construction contracts. |
| **Dependencies** | None (new adapter). Extends existing SAM.gov bid data with award outcomes. |
| **Industry Relevance** | ALL (filter by NAICS to route to correct industry) |

#### 4. Socrata Code Violation Discovery (Nationwide)

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Code violations signal immediate repair needs. Currently limited to Austin, Dallas, Houston. Every city with a Socrata portal likely has violation data. |
| **Complexity** | MEDIUM |
| **What It Is** | Use the same Discovery API approach as permits but search for code violation, code enforcement, and property maintenance datasets. |
| **API Endpoint** | Same Discovery API: `GET https://api.us.socrata.com/api/catalog/v1?q=code+violations&only=datasets` |
| **Search Terms** | "code violations", "code enforcement", "property maintenance violations", "building violations", "housing violations" |
| **Coverage** | Most major cities publish violation data on Socrata. Expect 100+ additional cities. |
| **Dependencies** | Existing SocrataViolationAdapter base class. Same auto-field-mapping as permit discovery. |
| **Industry Relevance** | HVAC (mechanical violations), electrical (wiring violations), roofing (structural/envelope violations) |

#### 5. State DOT Transportation Project Bids

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Transportation construction is the largest single sector of US infrastructure spending. State DOTs collectively award $100B+/year. |
| **Complexity** | HIGH |
| **What It Is** | Scrape or query state DOT bid letting pages for highway, bridge, and infrastructure construction projects. |
| **Data Sources** | Most state DOTs publish bid lettings online. Many use Bid Express (bidx.com) as their electronic bidding platform. Key states with structured data: Michigan (mdotjboss.state.mi.us), Texas (txdot.gov), California (dot.ca.gov), New York (dot.ny.gov), Florida (fdot.gov), and 45 others. |
| **Approach** | Two-pronged: (A) For states with Socrata/open data portals, use API approach. (B) For others, build RSS/HTML scrapers targeting bid announcement pages. Many DOTs have RSS feeds for new bid announcements. |
| **Data Quality** | HIGH -- includes project descriptions, locations, estimated values, bid deadlines, contractor requirements. |
| **Rate Limits** | Varies per state. Respect robots.txt. |
| **Coverage** | All 50 states + territories. Focus on top 20 states by construction spending first. |
| **Dependencies** | New "transportation-bid" source type. New adapter per state (or grouped adapter for Bid Express states). |
| **Industry Relevance** | Heavy equipment (primary), electrical (traffic signals, lighting), HVAC (tunnel ventilation) |

#### 6. Grants.gov Construction & Infrastructure Grants

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | Federal grants fund billions in construction annually. Grant announcements signal upcoming projects months before bids appear. |
| **Complexity** | LOW |
| **What It Is** | Query Grants.gov API for construction-related grant opportunities from HUD, DOT, DOE, EPA, FEMA. |
| **API Endpoint** | `GET https://www.grants.gov/api/search2?keyword=construction&oppStatus=posted` |
| **Key Features** | No API key required for search endpoints. Supports keyword, agency, CFDA number, eligibility filtering. Returns JSON with opportunity title, description, amounts, deadlines, agency. |
| **Relevant Agencies** | HUD (housing construction), DOT/FHWA (transportation), DOE (energy infrastructure), EPA (brownfield remediation), FEMA (disaster recovery construction), USDA (rural infrastructure) |
| **Data Quality** | HIGH -- official federal data with confirmed funding. |
| **Coverage** | All federal construction grant programs. |
| **Dependencies** | New adapter. Add "grant" to sourceTypes. |
| **Industry Relevance** | ALL (especially solar for DOE grants, heavy equipment for DOT/FHWA) |

#### 7. OSHA Construction Inspection Data

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | OSHA inspections signal active construction sites and can indicate where safety violations create equipment/remediation needs. |
| **Complexity** | MEDIUM |
| **What It Is** | Download and parse OSHA enforcement data for construction industry inspections (SIC 15-17 / NAICS 23). |
| **Data Source** | Department of Labor Open Data Portal (data.dol.gov). Previously at enforcedata.dol.gov (redirects to data.dol.gov). Bulk CSV downloads available. |
| **Data Fields** | Inspection number, establishment name, site address, city, state, zip, NAICS code, inspection date, violation type, penalty amounts, SIC code. |
| **How to Use** | 1. Download inspection CSV files (updated quarterly). 2. Filter to NAICS 23xxxx (construction). 3. Extract site locations as leads -- an active OSHA inspection = confirmed active construction site. 4. High-penalty violations on occupied buildings suggest remediation work needed. |
| **Coverage** | Nationwide. All federal OSHA inspections since 1970. ~90,000 construction inspections per year. |
| **Dependencies** | New adapter. New source type "inspection" or reuse "violation". |
| **Industry Relevance** | Heavy equipment (site safety), electrical (electrical violations), HVAC (confined space violations) |

#### 8. EPA Brownfield Sites (ACRES Database)

| Attribute | Detail |
|-----------|--------|
| **Why Expected** | 450,000+ brownfield sites in the US. Each remediated site creates construction opportunities: demolition, excavation, new development. |
| **Complexity** | LOW |
| **What It Is** | Query EPA ACRES brownfield properties dataset for sites in active assessment, cleanup, or redevelopment phases. |
| **Data Source** | Data.gov dataset "ACRES Brownfields Properties" -- available as CSV/GeoJSON download. Also accessible via EPA ECHO facility search API. |
| **API Endpoint** | EPA ECHO Web Services: `GET https://echo.epa.gov/api/rest_lookups.get_bp_activities?...` (brownfields activities). Also bulk download from data.gov. |
| **Data Fields** | Site name, address, city, state, zip, latitude, longitude, assessment status, cleanup status, grant amounts, property type. |
| **Lead Signal** | Sites in "Cleanup" or "Redevelopment" phase = active construction opportunities. Assessment phase = upcoming opportunities. |
| **Coverage** | Nationwide. ~450,000 properties tracked. |
| **Dependencies** | New adapter. New source type "brownfield" or use "permit". |
| **Industry Relevance** | Heavy equipment (demolition, excavation), electrical (new site wiring), HVAC (new builds on remediated land), solar (brownfield solar installations are a growing trend) |

---

### Differentiators (Competitive Advantage)

Data sources that most competitors do not aggregate, or aggregate poorly. These create unique value.

#### 9. HUD Housing Construction Data

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Census Bureau Building Permits Survey data aggregated at HUD provides county-level permit trends. Identify hotspot markets before individual permits appear in city databases. |
| **Complexity** | MEDIUM |
| **Data Source** | HUD SOCDS Building Permits database (huduser.gov/portal/datasets/socds.html). Also on ArcGIS Hub: hudgis-hud.opendata.arcgis.com. |
| **API Endpoint** | HUD GIS Open Data: `GET https://hudgis-hud.opendata.arcgis.com/api/v3/datasets/da836467b4904711b14d74acbc4568be_24/downloads/data?format=geojson` |
| **What It Provides** | Monthly/annual residential construction permit counts by county. Covers ~19,900 permit-issuing jurisdictions. Includes unit counts, construction value estimates. |
| **Lead Signal** | Counties with rising permit counts = growing markets where contractors should focus. Not individual leads, but market intelligence that improves lead prioritization. |
| **Coverage** | All US counties. Updated monthly. |
| **Industry Relevance** | ALL (market intelligence layer, not individual leads) |

#### 10. DSIRE Solar & Energy Incentive Programs

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Replace the existing basic solar incentives adapter with comprehensive DSIRE data covering 2,800+ active incentive programs across all 50 states. Solar installers and HVAC contractors need to know where incentives make projects viable. |
| **Complexity** | MEDIUM |
| **Data Source** | DSIRE (Database of State Incentives for Renewables & Efficiency). Operated by NC State University. |
| **API Access** | DSIRE API available at dsireusa.org/dsire-api/ -- requires subscription. Alternative: scrape the public program search at programs.dsireusa.org/system/program. |
| **Data Fields** | Program name, type (rebate/tax credit/loan/grant), eligible technologies, implementing sector, state, zip codes, amounts, expiration dates. |
| **What It Provides** | When a solar lead appears in a zip code with a 30% state tax credit + utility rebate, the lead becomes much higher value. Incentive data enriches lead scoring. |
| **Coverage** | All 50 states, territories, and federal programs. 2,800+ active policies. 124 energy technologies. |
| **Dependencies** | Replaces/enhances existing solar-incentives adapter. |
| **Industry Relevance** | Solar (primary), HVAC (heat pump incentives), electrical (EV charger incentives) |

#### 11. Planning & Zoning Board Meeting Agendas

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Planning board approvals precede permit applications by 3-12 months. This is the earliest signal of construction activity. Shovels.ai recently added this -- calling it "Decisions" data that gives visibility months before permits are filed. |
| **Complexity** | HIGH |
| **Data Source** | Municipal planning commission websites. No standard API. Requires per-city HTML scraping of agenda PDFs and minutes. |
| **Approach** | Start with the top 50 metro areas. Many publish agendas in standardized formats (PDF, HTML tables). Use text extraction to identify project descriptions, addresses, and approval status. |
| **What It Provides** | Pre-permit intelligence: "XYZ Development received planning approval for a 200-unit apartment complex at 123 Main St." This is a lead 6-12 months before permits are filed. |
| **Coverage** | Manual per-city setup. Start with largest metros. |
| **Shovels.ai Precedent** | Shovels recently added "local government meeting intelligence, including city council decisions, planning board approvals, and zoning changes" to their API. This validates the value. |
| **Industry Relevance** | ALL (especially heavy equipment for large development projects) |

#### 12. Property Transfer Records (Deed Recordings)

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Property sales to developers and investment companies signal upcoming construction. A $5M land purchase by a development LLC is a strong lead signal for new construction 6-18 months out. |
| **Complexity** | HIGH |
| **Data Source** | County recorder/assessor offices. No standard API. Some counties publish on Socrata or have searchable web portals. ATTOM provides commercial API ($500+/month). |
| **Free Approach** | Search Socrata Discovery API for "property transfers", "deed recordings", "real property sales". Some counties publish this data openly (e.g., Cook County IL, King County WA). |
| **What It Provides** | Buyer name, property address, sale price, deed type. Filter for: (A) High-value vacant land purchases. (B) Purchases by known developers. (C) Properties with demolition permits. |
| **Coverage** | Spotty free coverage. County-by-county. ATTOM covers 158M properties for paid access. |
| **Industry Relevance** | Heavy equipment (new construction), all others (renovation of newly purchased properties) |

#### 13. EPA ECHO Facility Compliance Data

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Facilities under EPA enforcement orders often need significant construction/renovation to achieve compliance -- new HVAC systems, electrical upgrades, hazardous material remediation. |
| **Complexity** | MEDIUM |
| **Data Source** | EPA ECHO Web Services REST API. |
| **API Endpoint** | `GET https://echo.epa.gov/api/rest_lookups.get_facility_info?...` with facility search. Also: bulk downloads of 1.5M+ facilities with 130+ data fields. |
| **What It Provides** | Facilities with recent violations, enforcement actions, consent decrees requiring construction remedies. Filter by industry, location, violation type. |
| **Data Fields** | Facility name, address, lat/lng, program types, inspection dates, violation counts, penalty amounts, compliance status. |
| **Coverage** | ~800,000 regulated facilities nationwide. |
| **Industry Relevance** | HVAC (air quality violations), electrical (power systems), heavy equipment (industrial facility upgrades) |

#### 14. FERC Energy Infrastructure Projects

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | FERC filings for pipeline construction, power plant permits, transmission line projects, and LNG facilities represent multi-million dollar construction projects. |
| **Complexity** | MEDIUM |
| **Data Source** | FERC eLibrary (elibrary.ferc.gov) and data portal (data.ferc.gov). |
| **What It Provides** | Pipeline construction applications (CP dockets), power plant construction permits, transmission line siting permits (ET dockets). Includes project descriptions, locations, applicant companies, construction timelines. |
| **Approach** | Query data.ferc.gov for recent filings. Filter for construction-related docket types. Also available as RSS feeds for new filings. |
| **Coverage** | Nationwide. All FERC-regulated energy infrastructure projects. |
| **Industry Relevance** | Heavy equipment (pipeline/power plant construction), electrical (transmission lines, substations), solar (utility-scale solar interconnection filings) |

#### 15. USACE Wetland/Construction Permits

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Army Corps Section 404 permits are required for any construction affecting wetlands. These permits signal large construction projects (housing developments, commercial complexes, infrastructure) in their early planning stages. |
| **Complexity** | MEDIUM-HIGH |
| **Data Source** | USACE Regulatory and Section 408 data at permits.ops.usace.army.mil. Also: Wetlands Impact Tracker (climateprogramportal.org) structures PDF public notices using LLMs. |
| **What It Provides** | Public notices for individual permit applications with project descriptions, locations, applicant names, and comment periods. |
| **Coverage** | Nationwide. All 38 USACE districts. |
| **Industry Relevance** | Heavy equipment (primary -- earthwork, excavation, grading) |

#### 16. FCC Tower & Broadband Infrastructure

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | Telecom tower construction and broadband buildout projects require electrical contractors and heavy equipment. FCC Antenna Structure Registration data is fully public. |
| **Complexity** | LOW |
| **Data Source** | FCC ASR database (wireless.fcc.gov). FCC Broadband Data Collection (broadbandmap.fcc.gov/data-download). |
| **What It Provides** | New tower registrations, broadband expansion areas (where new fiber/tower construction is happening). |
| **Coverage** | Nationwide. All registered antenna structures. |
| **Industry Relevance** | Electrical (tower wiring, fiber installation), heavy equipment (tower foundations, trenching) |

#### 17. School District Bond/Construction Programs

| Attribute | Detail |
|-----------|--------|
| **Value Proposition** | School construction bonds are among the largest local government expenditures. A $200M school bond = years of HVAC, electrical, roofing, and heavy equipment work. |
| **Complexity** | HIGH |
| **Data Source** | SchoolBondFinder.com, state education agency databases, ballot measure results. No single API. |
| **Approach** | Monitor school bond election results (available from state election offices), cross-reference with SAM.gov/USAspending for awarded contracts. |
| **Coverage** | Nationwide but requires aggregation from multiple state sources. |
| **Industry Relevance** | ALL (school construction touches every trade) |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create problems at the scale and stage of GroundPulse v4.0.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Paid data APIs (ATTOM, Shovels)** | "Just buy permit data from ATTOM/Shovels, they cover everything" | At $500-5000/month per data provider, this destroys unit economics for a startup. Also creates vendor dependency -- if they raise prices or shut down, your product dies. | Build your own scraping infrastructure using free public APIs (Socrata, ArcGIS, federal APIs). Slower but sustainable and differentiated. |
| **MLS/real estate listing integration** | "New listings with 'fixer-upper' or 'needs renovation' are leads" | MLS data requires broker licensing, RESO compliance, and expensive data feeds. Legal minefield. Zillow/Realtor APIs are heavily restricted. | Monitor Socrata for property transfer records as a free proxy. |
| **Mechanic's lien filing scraping** | "Lien filings show disputed construction projects that need new contractors" | Lien data is fragmented across 3,000+ county recorder offices with no standard API. Most require paid access or in-person visits. Extremely high complexity for low-volume leads. | Focus on code violations and OSHA data which provide similar "distressed project" signals from free, structured sources. |
| **Automated outreach from leads** | "Send emails/calls to permit holders automatically" | Legal (CAN-SPAM, TCPA), reputation, and deliverability risks. A single spam complaint can blacklist the domain. Also explicitly out of scope per PROJECT.md. | Provide rich contact information (permit applicant names, contractor names) and let users do their own outreach. |
| **Real-time streaming of all sources** | "I want leads as soon as they're filed" | Most data sources update daily/weekly/monthly. Real-time polling would hit rate limits, cost compute, and provide minimal incremental value. Permits aren't time-sensitive to the minute. | Daily scraping cadence is sufficient. Storm alerts (NWS) are the only source warranting near-real-time polling. |
| **ML/AI classification of unstructured permits** | "Use GPT to parse free-text permit descriptions" | Adds LLM API costs ($0.01-0.10 per permit), latency, hallucination risk, and vendor dependency. At 10,000+ permits/day nationwide, costs scale fast. | Rule-based keyword matching (already implemented) covers 80%+ of classification needs. Defer ML to v5+ when unit economics justify it. |
| **County property assessor integration** | "Track assessed value changes to find renovation activity" | Assessor data systems are county-specific with no standard API. 3,143 counties in the US. Even with ATTOM's paid coverage, assessed values lag 6-18 months behind actual construction. | Building permits are the direct signal; assessor data is a lagging indicator. Skip entirely. |

---

## Complete Data Source Catalog

### Tier 1: High-Value, Free, Structured APIs (Build First)

| # | Source | API Type | Endpoint / Access | Coverage | Lead Type | Key Industries | Complexity |
|---|--------|----------|-------------------|----------|-----------|----------------|------------|
| 1 | **Socrata Permit Discovery** | REST (SODA3) | `api.us.socrata.com/api/catalog/v1` | 200-400 cities | Permit | ALL | HIGH |
| 2 | **ArcGIS Hub Permit Discovery** | REST (GeoJSON) | `hub.arcgis.com/api/v3/datasets` | 100-300 cities | Permit | ALL | HIGH |
| 3 | **USAspending.gov Awards** | REST (JSON) | `api.usaspending.gov/api/v2/` | Federal (nationwide) | Contract Award | ALL | MEDIUM |
| 4 | **Grants.gov Opportunities** | REST (JSON) | `grants.gov/api/search2` | Federal (nationwide) | Grant | ALL | LOW |
| 5 | **Socrata Violation Discovery** | REST (SODA3) | `api.us.socrata.com/api/catalog/v1` | 100+ cities | Violation | HVAC, Elec, Roof | MEDIUM |
| 6 | **OSHA Enforcement Data** | Bulk CSV | `data.dol.gov` | Nationwide | Inspection | Heavy, Elec | MEDIUM |
| 7 | **EPA Brownfields (ACRES)** | GeoJSON/CSV | `data.gov` + ECHO API | Nationwide | Brownfield | Heavy, Solar | LOW |
| 8 | **EPA ECHO Compliance** | REST (JSON/XML) | `echo.epa.gov/api/` | 800K facilities | Violation | HVAC, Elec | MEDIUM |
| 9 | **HUD Permits by County** | ArcGIS GeoJSON | `hudgis-hud.opendata.arcgis.com` | All US counties | Market Intel | ALL | LOW |
| 10 | **FERC Energy Infrastructure** | RSS + Data Portal | `data.ferc.gov` | Nationwide | Energy Project | Heavy, Elec, Solar | MEDIUM |
| 11 | **FCC Antenna Registrations** | Bulk Download | `wireless.fcc.gov` | Nationwide | Telecom Project | Elec, Heavy | LOW |

### Tier 2: High-Value, Requires Scraping (Build Second)

| # | Source | Access Method | Coverage | Lead Type | Key Industries | Complexity |
|---|--------|---------------|----------|-----------|----------------|------------|
| 12 | **State DOT Bid Lettings** | HTML scrape / RSS | All 50 states | Transportation Bid | Heavy (primary) | HIGH |
| 13 | **Planning Board Agendas** | HTML scrape / PDF | Top 50 metros | Pre-Permit Intel | ALL | HIGH |
| 14 | **Property Transfer Records** | Socrata + county portals | Major counties | Property Sale | Heavy, ALL | HIGH |
| 15 | **USACE Section 404 Permits** | PDF parse + portal | Nationwide | Wetland Permit | Heavy | MEDIUM-HIGH |
| 16 | **School Bond Programs** | Scrape election results | Nationwide | Bond/Project | ALL | HIGH |

### Tier 3: Supplementary (Build After Core Is Solid)

| # | Source | Access Method | Coverage | Lead Type | Key Industries | Complexity |
|---|--------|---------------|----------|-----------|----------------|------------|
| 17 | **State Contractor License Boards** | Per-state scrape | Per state | Competitor Intel | ALL | HIGH |
| 18 | **DSIRE Incentives (full)** | API (paid) or scrape | All 50 states | Incentive Program | Solar, HVAC | MEDIUM |
| 19 | **Census Building Permits Survey** | CSV download | Nationwide | Market Trends | ALL | LOW |
| 20 | **Public Utility Commission Filings** | Per-state portals | Per state | Utility Project | Elec, Solar | HIGH |

---

## Feature Dependencies

```
[Socrata Discovery API] ──requires──> [Auto Field Mapping Engine]
    └──enhances──> [Existing SocrataPermitAdapter base class]

[ArcGIS Hub Discovery] ──requires──> [Auto Field Mapping Engine]
    └──enhances──> [Existing AtlantaPermitsAdapter pattern]

[Auto Field Mapping Engine] ──requires──> [Column Metadata Inspector]
    └──requires──> [Field Name Heuristics Library]
        (maps 'permit_no' OR 'permit_number' OR 'permno' -> permitNumber)

[USAspending Adapter] ──enhances──> [Existing SAM.gov Adapter]
    (SAM.gov = bid opportunities, USAspending = awarded contracts)

[Socrata Violation Discovery] ──requires──> [Socrata Discovery API infrastructure]
    └──enhances──> [Existing SocrataViolationAdapter base class]

[Grants.gov Adapter] ──independent── (new source type "grant")

[OSHA Data Adapter] ──independent── (bulk CSV download approach)

[EPA Brownfields] ──independent── (data.gov download or ECHO API)

[State DOT Bids] ──requires──> [Per-state scraper configs]
    └──conflicts──> [Rapid nationwide rollout]
        (Must be built incrementally by state)

[Planning Board Agendas] ──requires──> [PDF text extraction]
    └──requires──> [Per-city scraper configs]
    └──conflicts──> [Rapid nationwide rollout]

[HUD County Data] ──enhances──> [Lead Scoring Engine]
    (market heat data improves score differentiation)

[DSIRE Full Integration] ──enhances──> [Existing solar-incentives adapter]
    └──enhances──> [Lead Scoring for Solar/HVAC]

[EPA ECHO] ──enhances──> [Violation source type]
    └──enhances──> [HVAC/Electrical lead pipeline]
```

### Dependency Notes

- **Auto Field Mapping Engine is the critical enabler.** Both Socrata and ArcGIS discovery depend on automatically mapping unknown column names to the expected fields (permitNumber, address, description, date, value, lat, lng). Without this, every new city requires manual adapter creation.
- **Socrata Discovery and ArcGIS Discovery share infrastructure.** Build the auto-field-mapping once, apply it to both. Together they cover 300-700 jurisdictions.
- **USAspending complements SAM.gov.** SAM.gov = "opportunity to bid". USAspending = "contract was awarded". Together they cover the full lifecycle of federal construction.
- **State DOT Bids conflict with rapid rollout.** Each state has different bid systems. Cannot do "all 50 at once" -- must be incremental. Start with top 10 states by construction spending.
- **Planning Board Agendas are the highest-value, highest-effort source.** Each city has different websites, formats, and meeting schedules. Shovels invested significantly in this and positions it as a key differentiator. Build this last but plan for it.

---

## MVP Definition

### v4.0 Launch With (Nationwide Coverage)

Core data sources that achieve "nationwide" claim with reasonable effort:

- [x] **Dynamic Socrata Permit Discovery** -- goes from 3 cities to 200-400 overnight
- [x] **Dynamic ArcGIS Hub Permit Discovery** -- adds 100-300 more jurisdictions
- [x] **USAspending.gov Federal Awards** -- nationwide federal contract data, free API
- [x] **Grants.gov Opportunities** -- free API, low complexity, high-value leads
- [x] **Socrata Violation Discovery** -- extends violations from 3 cities to 100+
- [x] **OSHA Construction Inspections** -- nationwide, bulk download, confirms active sites
- [x] **EPA Brownfields** -- nationwide, low complexity, unique lead type
- [x] **HUD County Permit Trends** -- market intelligence layer for scoring engine

**Rationale:** These 8 sources, combined with existing adapters (SAM.gov, NWS, FEMA, EIA, news feeds, Google dorking), give GroundPulse legitimate nationwide coverage across all 5 industries using free, structured public APIs.

### Add After Launch (v4.x)

- [ ] **EPA ECHO Facility Compliance** -- adds industrial facility violation leads
- [ ] **FERC Energy Infrastructure** -- adds energy project leads
- [ ] **FCC Antenna Registrations** -- adds telecom infrastructure leads
- [ ] **DSIRE Full Incentives** -- enhances solar/HVAC lead value
- [ ] **State DOT Bids (top 10 states)** -- Texas, California, Florida, New York, Pennsylvania, Ohio, Illinois, Georgia, North Carolina, Michigan

### Future Consideration (v5+)

- [ ] **Planning Board Agendas** -- highest value but highest effort, needs PDF parsing at scale
- [ ] **Property Transfer Records** -- county-by-county, high complexity
- [ ] **USACE Section 404 Permits** -- PDF-heavy, low volume per district
- [ ] **School Bond Programs** -- requires election monitoring infrastructure
- [ ] **State Contractor License Boards** -- per-state, no standard API
- [ ] **Public Utility Commission Filings** -- per-state, no standard API

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Socrata Permit Discovery | HIGH | HIGH | **P1** | v4.0 |
| ArcGIS Hub Permit Discovery | HIGH | HIGH | **P1** | v4.0 |
| USAspending Federal Awards | HIGH | MEDIUM | **P1** | v4.0 |
| Grants.gov Opportunities | HIGH | LOW | **P1** | v4.0 |
| Socrata Violation Discovery | MEDIUM | MEDIUM | **P1** | v4.0 |
| OSHA Construction Inspections | MEDIUM | MEDIUM | **P1** | v4.0 |
| EPA Brownfields | MEDIUM | LOW | **P1** | v4.0 |
| HUD County Permit Trends | MEDIUM | LOW | **P1** | v4.0 |
| EPA ECHO Compliance | MEDIUM | MEDIUM | **P2** | v4.1 |
| FERC Energy Infrastructure | MEDIUM | MEDIUM | **P2** | v4.1 |
| FCC Antenna Registrations | LOW | LOW | **P2** | v4.1 |
| DSIRE Full Incentives | MEDIUM | MEDIUM | **P2** | v4.1 |
| State DOT Bids (top 10) | HIGH | HIGH | **P2** | v4.2 |
| Planning Board Agendas | HIGH | HIGH | **P3** | v5.0 |
| Property Transfer Records | MEDIUM | HIGH | **P3** | v5.0 |
| USACE Section 404 | LOW | MEDIUM-HIGH | **P3** | v5.0 |
| School Bond Programs | LOW | HIGH | **P3** | v5.0 |

---

## Competitor Feature Analysis

| Data Source | Shovels.ai | Construction Monitor | Dodge/Construction.com | BuildZoom | **GroundPulse Plan** |
|-------------|------------|---------------------|----------------------|-----------|---------------------|
| Building Permits | 2,000+ jurisdictions (proprietary scraping) | Nationwide (proprietary) | Limited (focus on project intel) | Permit data + contractor matching | 300-700 jurisdictions via Socrata + ArcGIS discovery (free public APIs) |
| Federal Bids (SAM.gov) | No | No | Yes (project tracking) | No | **Already built** |
| Federal Awards (USAspending) | No | No | Limited | No | **v4.0 -- unique differentiator** |
| Storm/Disaster Alerts | No | No | No | No | **Already built (NWS + FEMA)** |
| Code Violations | No | No | No | No | **Already built + expanding** |
| Planning Board Decisions | Yes (recently added "Decisions") | No | Yes (early project tracking) | No | **v5.0 planned** |
| Contractor Matching | Yes (150M+ permits mapped to contractors) | Yes (contractor contact info) | Yes (key contacts) | Yes (core feature) | Not in scope (user does own outreach) |
| OSHA Inspections | No | No | No | No | **v4.0 -- unique differentiator** |
| EPA Brownfields | No | No | No | No | **v4.0 -- unique differentiator** |
| Federal Grants | No | No | No | No | **v4.0 -- unique differentiator** |
| Energy Infrastructure (FERC) | No | No | Limited | No | **v4.1 planned** |
| Pricing | $500-5,000/month (API tiers) | $200-800/month | $400-1,500/month | Free basic (paid premium) | Target: $50-150/month |

### Competitive Positioning

**Shovels.ai** has the deepest permit coverage (2,000+ jurisdictions) through proprietary scraping and a well-funded team ($5M seed). GroundPulse cannot match this depth at launch. However, Shovels is focused on proptech/real estate use cases, not blue-collar contractor lead gen. They also recently started selling "Decisions" (planning board) data.

**Construction Monitor** has nationwide permit coverage with weekly updates and contractor contact info. They are the most direct competitor for the "permits as leads" use case. They charge $200-800/month.

**Dodge Construction Network** focuses on larger commercial/industrial projects with dedicated research staff manually tracking projects. They start at $400+/month. Not accessible to small blue-collar businesses.

**GroundPulse Differentiator Strategy:**
1. **Price.** $50-150/month vs $200-1,500+ for competitors. Target the small-to-mid contractor that Dodge and Construction Monitor are too expensive for.
2. **Source diversity.** No competitor combines permits + violations + federal bids + federal awards + grants + OSHA + brownfields + weather alerts + FEMA disasters + energy data + news in one feed. GroundPulse's 20+ source types vs competitors' 1-3 source types.
3. **Industry-specific routing.** Competitors show raw permits. GroundPulse scores and routes leads specifically for roofers, HVAC techs, solar installers, electricians, and heavy equipment dealers.
4. **Free government data.** By building on free public APIs instead of paid data vendors, GroundPulse has a structural cost advantage that enables aggressive pricing.

---

## New Source Types Required

The existing `sourceTypes` array in `base-adapter.ts` is:
```typescript
["permit", "bid", "news", "deep-web", "storm", "disaster", "violation"]
```

v4.0 needs these additions:

| New Type | Sources | Description |
|----------|---------|-------------|
| `award` | USAspending.gov | Awarded federal contracts (distinct from bid opportunities) |
| `grant` | Grants.gov | Federal grant opportunities for construction |
| `inspection` | OSHA enforcement | Active construction site inspections |
| `brownfield` | EPA ACRES | Brownfield sites in remediation/redevelopment |
| `energy` | FERC filings, FCC infrastructure | Energy and telecom infrastructure projects |
| `market-intel` | HUD county data, Census BPS | Market trend data (not individual leads) |

---

## Sources

### Federal APIs (HIGH confidence -- official government endpoints)
- Socrata Discovery API: https://dev.socrata.com/docs/other/discovery
- Socrata SODA3 API: https://dev.socrata.com/docs/queries/
- ArcGIS Hub Search: https://hub.arcgis.com/api/v3/datasets
- USAspending API: https://api.usaspending.gov/
- SAM.gov API: https://open.gsa.gov/api/get-opportunities-public-api/
- Grants.gov API: https://www.grants.gov/api
- OSHA Data: https://www.osha.gov/data
- DOL Enforcement Data: https://data.dol.gov/
- EPA ECHO: https://echo.epa.gov/tools/web-services
- EPA Brownfields: https://catalog.data.gov/dataset/acres-brownfields-properties
- HUD Open Data: https://hudgis-hud.opendata.arcgis.com/
- FERC Data: https://data.ferc.gov/
- FCC ASR: https://www.fcc.gov/wireless/systems-utilities/antenna-structure-registration
- NWS API: https://api.weather.gov/
- FEMA API: https://www.fema.gov/api/open
- Census BPS: https://www.census.gov/construction/bps/

### Competitor Analysis (MEDIUM confidence -- public marketing materials)
- Shovels.ai: https://www.shovels.ai/permit-database
- Construction Monitor: https://www.constructionmonitor.com/
- Dodge Construction: https://www.construction.com/
- ATTOM Data: https://www.attomdata.com/data/property-data/
- DSIRE: https://dsireusa.org/

### Industry Research (MEDIUM confidence -- secondary sources)
- Open Data Network: https://www.opendatanetwork.com/
- Data.gov Permits Catalog: https://catalog.data.gov/dataset/?tags=permits
- SchoolBondFinder: https://www.schoolbondfinder.com/
- Bid Express: https://www.infotechinc.com/bidx/

---
*Feature research for: GroundPulse v4.0 Nationwide Lead Sources*
*Researched: 2026-03-19*
