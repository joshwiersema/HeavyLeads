# Phase 4: Multi-Source Expansion - Research

**Researched:** 2026-03-14
**Domain:** Web scraping (bid boards, news, deep web), cross-source deduplication, data aggregation
**Confidence:** MEDIUM

## Summary

Phase 4 expands the lead pipeline from a single source type (building permits) to four source types: permits (existing), bid boards, construction news/press releases, and deep web/Google dorking results. The critical architectural challenge is cross-source deduplication -- leads discovered from multiple sources must merge into a single canonical record that preserves all source references.

The existing scraper adapter pattern (`ScraperAdapter` interface, `runPipeline` orchestrator, `registry` for adapter registration) is well-designed for adding new source types. However, the current adapter interface returns `RawPermitData` -- tightly coupled to permit-specific fields like `permitNumber`. Phase 4 must generalize this to a `RawLeadData` interface that accommodates all source types, while keeping backward compatibility with existing permit adapters.

The deduplication challenge is non-trivial: a single construction project may appear as a permit in Austin, an RFP on SAM.gov, a groundbreaking press release on ENR, and a contractor job posting found via Google dorking. These must be merged by geographic proximity + text similarity into one canonical lead with multiple source references tracked in a new `lead_sources` junction table.

**Primary recommendation:** Generalize the adapter interface from permit-specific to source-agnostic, add a `lead_sources` table for multi-source tracking, implement deduplication as a post-pipeline merge step using geocode proximity (< 0.1 miles) + normalized address/title similarity (Dice coefficient > 0.7), and use SAM.gov API (free, authoritative) for federal bid boards, RSS parsing for construction news, and Serper.dev API for Google dorking queries.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-02 | System scrapes government and private bid board postings (RFPs, contract awards) | SAM.gov Opportunities API (free, federal), state/local bid board scraping via Crawlee adapters |
| DATA-03 | System scrapes construction news and press releases for project announcements and groundbreakings | RSS feed parsing (ENR, Construction Dive, PR Newswire) via rss-parser + Crawlee for HTML scraping |
| DATA-04 | System performs Google dorking / deep web queries to surface project docs, contractor activity, and job postings | Serper.dev API ($1/1K queries, structured JSON) for programmatic Google search with dorking operators |
| DATA-06 | System deduplicates leads across multiple data sources into a single canonical lead record | Geocode proximity + text similarity matching with lead_sources junction table for source tracking |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crawlee | ^3.16.0 | Web scraping framework | Already in project, CheerioCrawler for static HTML bid boards |
| rss-parser | ^3.13.0 | RSS/Atom feed parsing | Most popular Node.js RSS parser (8M+ weekly downloads), TypeScript types included |
| string-similarity | ^4.0.4 | Dice coefficient text similarity | Lightweight, well-tested, used for dedup matching |
| drizzle-orm | ^0.45.1 | Database ORM | Already in project, schema changes for lead_sources table |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Validation schemas | Already in project, validate new adapter outputs |
| node-cron | ^4.2.1 | Scheduling | Already in project, extend existing scheduler |

### External APIs (No NPM Package Needed)
| Service | Purpose | Cost | Auth |
|---------|---------|------|------|
| SAM.gov Opportunities API | Federal bid board data (RFPs, awards) | Free (1,000 req/day with API key) | API key via SAM.gov account |
| Serper.dev | Programmatic Google search for dorking | $1/1K queries (2,500 free trial) | API key |
| ENR RSS feeds | Construction industry news | Free | None |
| PR Newswire RSS | Construction press releases | Free | None |
| Construction Dive RSS | Industry news and press releases | Free | None |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Serper.dev | Google Custom Search API | CSE closed to new customers, EOL Jan 2027; Serper is 10x cheaper and faster |
| Serper.dev | SerpAPI | SerpAPI is $15/1K queries vs Serper $1/1K -- 15x more expensive |
| rss-parser | feedsmith | feedsmith is newer but less battle-tested; rss-parser is the ecosystem default |
| string-similarity | fuse.js | fuse.js is for search, not pairwise comparison; Dice coefficient is purpose-built for dedup |
| SAM.gov API | BidPrime/BidClerk API | BidPrime/BidClerk are paid services; SAM.gov is free and authoritative for federal contracts |

**Installation:**
```bash
npm install rss-parser string-similarity
npm install -D @types/string-similarity
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/scraper/
  adapters/
    base-adapter.ts          # MODIFY: Generalize ScraperAdapter -> supports all source types
    austin-permits.ts         # KEEP: Existing permit adapter (unchanged)
    dallas-permits.ts         # KEEP: Existing permit adapter (unchanged)
    atlanta-permits.ts        # KEEP: Existing permit adapter (unchanged)
    sam-gov-bids.ts           # NEW: SAM.gov federal opportunities adapter
    enr-news.ts               # NEW: ENR RSS construction news adapter
    prnewswire-news.ts        # NEW: PR Newswire construction news adapter
    construction-dive-news.ts # NEW: Construction Dive news adapter
    google-dorking.ts         # NEW: Serper.dev deep web search adapter
    index.ts                  # MODIFY: Register new adapters
  pipeline.ts                 # MODIFY: Generalize from permit-specific to source-agnostic
  dedup.ts                    # NEW: Cross-source deduplication engine
  registry.ts                 # KEEP: Adapter registry (unchanged)
  scheduler.ts                # KEEP: Daily scheduler (unchanged, auto-runs new adapters)
  types.ts                    # MODIFY: Add new types for generalized pipeline

src/lib/db/schema/
  leads.ts                    # MODIFY: Add sourceType column, make permitNumber optional
  lead-sources.ts             # NEW: Junction table for multi-source tracking
```

### Pattern 1: Generalized Adapter Interface
**What:** Extend the existing `ScraperAdapter` to return a generalized `RawLeadData` instead of `RawPermitData`
**When to use:** Every new adapter
**Example:**
```typescript
// Generalized raw lead data -- backward compatible with RawPermitData
export const rawLeadSchema = z.object({
  // Identity (at least one required for dedup)
  permitNumber: z.string().optional(),   // Permits
  title: z.string().optional(),          // Bids, news
  externalId: z.string().optional(),     // SAM.gov notice ID, article URL

  // Core fields
  description: z.string().optional(),
  address: z.string().optional(),        // Optional for news (may only have city/state)
  projectType: z.string().optional(),
  estimatedValue: z.number().optional(),

  // Contacts
  applicantName: z.string().optional(),  // Permits
  contractorName: z.string().optional(), // Bids
  agencyName: z.string().optional(),     // Government bids

  // Dates
  permitDate: z.coerce.date().optional(),
  postedDate: z.coerce.date().optional(),
  deadlineDate: z.coerce.date().optional(),

  // Location
  lat: z.number().optional(),
  lng: z.number().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // Source tracking
  sourceUrl: z.string().optional(),
  sourceType: z.enum(["permit", "bid", "news", "deep-web"]),
});

export type RawLeadData = z.infer<typeof rawLeadSchema>;

export interface ScraperAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: "permit" | "bid" | "news" | "deep-web";
  scrape(): Promise<RawLeadData[]>;
}
```

### Pattern 2: Lead Sources Junction Table
**What:** Track which sources contributed to each canonical lead
**When to use:** Every lead insert/update
**Example:**
```typescript
// New schema: lead_sources junction table
export const leadSources = pgTable(
  "lead_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),      // e.g., "sam-gov-bids", "enr-news"
    sourceType: text("source_type").notNull(),   // "permit" | "bid" | "news" | "deep-web"
    externalId: text("external_id"),             // Permit number, SAM notice ID, article URL
    sourceUrl: text("source_url"),
    title: text("title"),                        // Original title from this source
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_sources_lead_source_idx").on(table.leadId, table.sourceId, table.externalId),
    index("lead_sources_lead_id_idx").on(table.leadId),
  ]
);
```

### Pattern 3: Post-Pipeline Deduplication
**What:** After pipeline ingests raw records, a dedup step merges records that reference the same real-world project
**When to use:** After each pipeline run
**Example:**
```typescript
// Dedup strategy: geocode proximity + text similarity
interface DedupCandidate {
  leadId: string;
  lat: number | null;
  lng: number | null;
  normalizedAddress: string;
  normalizedTitle: string;
}

function isLikelyDuplicate(a: DedupCandidate, b: DedupCandidate): boolean {
  // Step 1: Geographic proximity check (must be within ~0.1 miles)
  if (a.lat && a.lng && b.lat && b.lng) {
    const distance = haversineDistance(a.lat, a.lng, b.lat, b.lng);
    if (distance > 0.1) return false; // Too far apart
  }

  // Step 2: Text similarity on address or title
  const addressSim = compareTwoStrings(a.normalizedAddress, b.normalizedAddress);
  const titleSim = compareTwoStrings(a.normalizedTitle, b.normalizedTitle);

  // Either address or title must be similar
  return addressSim > 0.7 || titleSim > 0.7;
}
```

### Pattern 4: SAM.gov API Adapter
**What:** Fetch federal construction bid opportunities from SAM.gov
**When to use:** Bid board source (DATA-02)
**Example:**
```typescript
export class SamGovBidsAdapter implements ScraperAdapter {
  readonly sourceId = "sam-gov-bids";
  readonly sourceName = "SAM.gov Federal Contract Opportunities";
  readonly sourceType = "bid" as const;

  private readonly endpoint = "https://api.sam.gov/opportunities/v2/search";
  // Construction NAICS codes: 236xxx (buildings), 237xxx (heavy/civil), 238xxx (specialty trade)
  private readonly naicsCodes = ["236", "237", "238"];

  async scrape(): Promise<RawLeadData[]> {
    const results: RawLeadData[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const ncode of this.naicsCodes) {
      const url = new URL(this.endpoint);
      url.searchParams.set("api_key", process.env.SAM_GOV_API_KEY!);
      url.searchParams.set("postedFrom", formatDate(thirtyDaysAgo));
      url.searchParams.set("postedTo", formatDate(new Date()));
      url.searchParams.set("ncode", ncode);
      url.searchParams.set("limit", "100");

      const response = await fetch(url.toString());
      if (!response.ok) continue;

      const data = await response.json();
      // Map SAM.gov response to RawLeadData...
    }
    return results;
  }
}
```

### Pattern 5: RSS News Adapter
**What:** Parse construction news RSS feeds for project announcements
**When to use:** News source (DATA-03)
**Example:**
```typescript
import Parser from "rss-parser";

export class EnrNewsAdapter implements ScraperAdapter {
  readonly sourceId = "enr-news";
  readonly sourceName = "Engineering News-Record";
  readonly sourceType = "news" as const;

  private readonly feedUrls = [
    "https://www.enr.com/rss/1",          // Main ENR feed
    "https://www.enr.com/rss/11",         // Texas & Louisiana
    "https://www.enr.com/rss/9",          // Southeast
  ];

  async scrape(): Promise<RawLeadData[]> {
    const parser = new Parser();
    const results: RawLeadData[] = [];

    for (const feedUrl of this.feedUrls) {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        // Filter for construction-relevant keywords
        if (isConstructionRelevant(item.title, item.contentSnippet)) {
          results.push({
            title: item.title,
            description: item.contentSnippet,
            sourceUrl: item.link,
            sourceType: "news",
            postedDate: item.pubDate ? new Date(item.pubDate) : undefined,
          });
        }
      }
    }
    return results;
  }
}
```

### Pattern 6: Google Dorking Adapter
**What:** Use Serper.dev API to run construction-specific Google search queries
**When to use:** Deep web source (DATA-04)
**Example:**
```typescript
export class GoogleDorkingAdapter implements ScraperAdapter {
  readonly sourceId = "google-dorking";
  readonly sourceName = "Google Deep Web Search";
  readonly sourceType = "deep-web" as const;

  private readonly endpoint = "https://google.serper.dev/search";

  // Dorking query templates for construction intelligence
  private readonly queries = [
    'site:linkedin.com/jobs "heavy equipment" OR "construction equipment" operator',
    '"groundbreaking ceremony" construction project 2026',
    '"contract awarded" construction "million" -news',
    'filetype:pdf "request for proposal" construction equipment',
    'intitle:"bid results" construction heavy equipment',
  ];

  async scrape(): Promise<RawLeadData[]> {
    const results: RawLeadData[] = [];
    for (const query of this.queries) {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 20 }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      // Map Serper results to RawLeadData...
    }
    return results;
  }
}
```

### Anti-Patterns to Avoid
- **Coupling dedup to adapter insertion:** Don't try to dedup inline during each adapter's insert. Run dedup as a separate post-pipeline step so all sources can be compared against each other.
- **Storing all sources in a flat column:** Don't add a `sources` JSON column to the leads table. Use a proper junction table (`lead_sources`) for queryability, indexing, and relational integrity.
- **Over-engineering dedup with ML:** For MVP, simple geocode proximity + Dice coefficient text similarity is sufficient. ML-based entity resolution is overkill at current data volumes (< 100K records).
- **Making permits a special case:** Generalize the adapter interface so permit adapters and bid/news/deep-web adapters share the same pipeline. Don't maintain two separate pipelines.
- **Scraping paywalled content:** BidClerk, ConstructConnect, Dodge Data require paid subscriptions with strict ToS. Use free/open sources: SAM.gov (federal), ENR RSS (free), PR Newswire RSS (free). Do not scrape paid platforms.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS/Atom feed parsing | Custom XML parser | `rss-parser` | RSS has many edge cases (namespaces, CDATA, date formats, encoding); rss-parser handles them all |
| Google search results | Direct Google scraping | Serper.dev API | Google actively blocks scraping; Serper provides clean JSON, handles CAPTCHAs/rate limits |
| Federal bid board data | Screen-scraping SAM.gov | SAM.gov REST API | Official API is free, stable, and provides structured JSON. Scraping the website violates ToS |
| String similarity scoring | Custom Levenshtein/Dice | `string-similarity` | Dice coefficient implementation with proper edge cases (empty strings, unicode) is subtle |
| Address normalization | Custom regex-based cleanup | Lowercase + strip punctuation + trim | Full address normalization (libpostal) is heavyweight for MVP; simple normalization + geocode proximity suffices |

**Key insight:** The deceptive complexity in this phase is not scraping individual sources -- it is merging records across sources where the same project appears with different names, slightly different addresses, and different levels of detail. Keep the dedup algorithm simple but ensure it can be tuned (threshold parameters, not hardcoded magic numbers).

## Common Pitfalls

### Pitfall 1: SAM.gov API Key Registration Delay
**What goes wrong:** SAM.gov API key registration takes 1-4 weeks for approval
**Why it happens:** Government identity verification process
**How to avoid:** Register for SAM.gov API key immediately at project start. Implement the adapter with a mock/bypass mode for development. Use environment variable `SAM_GOV_API_KEY` with graceful skip when missing.
**Warning signs:** Adapter works locally with hardcoded test data but fails in production

### Pitfall 2: RSS Feeds Returning HTML Instead of XML
**What goes wrong:** Some RSS feed URLs return the HTML page instead of the XML feed
**Why it happens:** Server-side content negotiation or URL changes
**How to avoid:** Set `Accept: application/rss+xml, application/xml` header. Validate response content-type before parsing. Wrap parser.parseURL in try/catch with meaningful error messages.
**Warning signs:** rss-parser throws XML parse errors

### Pitfall 3: Over-Aggressive Deduplication
**What goes wrong:** Two distinct but nearby construction projects get merged into one lead
**Why it happens:** Geographic proximity alone is not sufficient -- two projects on the same street could be separate
**How to avoid:** Require BOTH geographic proximity AND text similarity. Use configurable thresholds (start conservative: 0.1 miles AND 0.7 similarity). Log dedup matches for manual review during development.
**Warning signs:** Lead count drops dramatically after dedup, source counts per lead seem too high

### Pitfall 4: Serper.dev Rate Limiting and Query Budget
**What goes wrong:** Daily dorking burns through monthly query budget in a few days
**Why it happens:** Each query template * result page = multiple API calls
**How to avoid:** Cap daily Serper queries (e.g., 50/day = 1,500/month, well within $50 plan). Cache results by query hash. Rotate query templates across days rather than running all daily.
**Warning signs:** Serper API returns 429 errors or monthly budget depleted early

### Pitfall 5: Permit Adapter Backward Incompatibility
**What goes wrong:** Existing permit adapters break when ScraperAdapter interface changes
**Why it happens:** Changing the return type from `RawPermitData[]` to `RawLeadData[]`
**How to avoid:** Make `RawLeadData` a superset of `RawPermitData`. Add a migration helper that maps old permit data to new schema. Update existing adapters to include the new `sourceType` field.
**Warning signs:** TypeScript compilation errors in existing adapter files

### Pitfall 6: News Articles Without Location Data
**What goes wrong:** News leads can't be geocoded or matched geographically
**Why it happens:** Press releases often mention project location only in body text, not structured fields
**How to avoid:** Extract city/state from article text using simple regex patterns (e.g., "in Dallas, TX" or "Austin, Texas"). Fall back to city-level geocoding. Accept that some news leads will have coarser location granularity.
**Warning signs:** Many news leads with null lat/lng, not appearing in radius-filtered queries

### Pitfall 7: Legal Risk with Google Dorking (DATA-04)
**What goes wrong:** Scraping job posting sites, PDF hosting sites, or other platforms that prohibit automated access
**Why it happens:** Google dorking surfaces results from sites with restrictive ToS
**How to avoid:** Only index the search result metadata (title, snippet, URL) from Serper.dev -- do NOT follow links to scrape full content from third-party sites. Serper.dev handles the Google interaction; storing search snippets is fair use. STATE.md already flags this concern: "DATA-04 (Google dorking) is v1 but research flags high legal scrutiny"
**Warning signs:** Cease-and-desist from scraped sites

## Code Examples

### Cross-Source Deduplication Engine
```typescript
// src/lib/scraper/dedup.ts
import { compareTwoStrings } from "string-similarity";
import { haversineDistance } from "@/lib/leads/queries";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { eq, and, sql } from "drizzle-orm";

const PROXIMITY_THRESHOLD_MILES = 0.1;
const SIMILARITY_THRESHOLD = 0.7;

function normalizeText(text: string | null): string {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/**
 * After pipeline ingests new leads, find and merge duplicates.
 * Strategy: For each new lead, check against existing leads within
 * geographic proximity, then compare normalized text similarity.
 */
export async function deduplicateNewLeads(newLeadIds: string[]): Promise<{
  merged: number;
  kept: number;
}> {
  let merged = 0;
  let kept = 0;

  for (const newId of newLeadIds) {
    const newLead = await db.select().from(leads).where(eq(leads.id, newId)).limit(1);
    if (newLead.length === 0) continue;

    const lead = newLead[0];
    if (!lead.lat || !lead.lng) {
      kept++;
      continue; // Can't dedup without coordinates
    }

    // Find nearby existing leads (exclude self)
    const candidates = await db
      .select()
      .from(leads)
      .where(
        and(
          sql`${leads.id} != ${newId}`,
          sql`${leads.lat} IS NOT NULL`,
          sql`${leads.lng} IS NOT NULL`
        )
      );

    let matchedLeadId: string | null = null;

    for (const candidate of candidates) {
      if (!candidate.lat || !candidate.lng) continue;

      const distance = haversineDistance(
        lead.lat, lead.lng, candidate.lat, candidate.lng
      );
      if (distance > PROXIMITY_THRESHOLD_MILES) continue;

      const addressSim = compareTwoStrings(
        normalizeText(lead.address),
        normalizeText(candidate.address)
      );
      const titleSim = compareTwoStrings(
        normalizeText(lead.description),
        normalizeText(candidate.description)
      );

      if (addressSim > SIMILARITY_THRESHOLD || titleSim > SIMILARITY_THRESHOLD) {
        matchedLeadId = candidate.id;
        break;
      }
    }

    if (matchedLeadId) {
      // Merge: move source references to existing lead, delete duplicate
      await mergeLeads(matchedLeadId, newId);
      merged++;
    } else {
      kept++;
    }
  }

  return { merged, kept };
}
```

### Leads Schema Migration (Adding sourceType, Making permitNumber Optional)
```typescript
// Modified leads table
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // permitNumber is now optional -- only set for permit-type leads
    permitNumber: text("permit_number"),
    title: text("title"),                             // NEW: For bids/news leads
    description: text("description"),
    address: text("address"),                         // Now optional for news
    formattedAddress: text("formatted_address"),
    lat: real("lat"),
    lng: real("lng"),
    city: text("city"),                               // NEW
    state: text("state"),                             // NEW
    projectType: text("project_type"),
    estimatedValue: integer("estimated_value"),
    applicantName: text("applicant_name"),
    contractorName: text("contractor_name"),           // NEW
    agencyName: text("agency_name"),                   // NEW
    sourceType: text("source_type").notNull().default("permit"), // NEW
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url"),
    sourceJurisdiction: text("source_jurisdiction"),   // Now optional
    scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // OLD: uniqueIndex on sourceId + permitNumber won't work for non-permit sources
    // NEW: Composite unique on sourceId + coalesce(permitNumber, title, externalId)
    uniqueIndex("leads_source_dedup_idx").on(
      table.sourceId, table.permitNumber
    ),
    index("leads_scraped_at_idx").on(table.scrapedAt),
    index("leads_source_type_idx").on(table.sourceType),  // NEW
  ]
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Custom Search API | Serper.dev / Vertex AI Search | 2025 (CSE closed to new customers) | Must use Serper.dev or similar third-party for programmatic Google search |
| Screen-scraping SAM.gov | SAM.gov REST API v2 | 2024 (v2 release) | Free, structured JSON access to federal contract opportunities |
| Manual bid board monitoring | SAM.gov API + RSS aggregation | Ongoing | Federal opportunities now accessible programmatically at no cost |
| Single-source lead tracking | Multi-source with junction table | This phase | Enables dedup and source attribution across sources |

**Deprecated/outdated:**
- Google Custom Search JSON API: Closed to new customers, EOL January 2027. Do not use.
- Custom Search Site Restricted JSON API: Ceased serving traffic January 2025.
- SAM.gov API v1: Replaced by v2 at `/opportunities/v2/search`.

## Open Questions

1. **SAM.gov API Key Availability**
   - What we know: Registration is free but takes 1-4 weeks for approval
   - What's unclear: Whether the project has an existing SAM.gov account or needs to register
   - Recommendation: Register immediately; implement adapter with graceful skip when key is missing via `process.env.SAM_GOV_API_KEY`

2. **News Article Location Extraction Accuracy**
   - What we know: RSS feeds provide title + snippet, rarely structured location data
   - What's unclear: How reliably we can extract city/state from article text
   - Recommendation: Start with simple regex patterns ("in [City], [State]"), accept that some news leads will lack precise geocoding. These leads still have value for keyword/text search (Phase 5)

3. **Dedup Threshold Tuning**
   - What we know: 0.1 miles + 0.7 Dice coefficient is a reasonable starting point
   - What's unclear: Optimal thresholds for construction leads specifically
   - Recommendation: Make thresholds configurable via constants, log all dedup matches during initial runs, tune based on observed false positives/negatives

4. **Google Dorking Legal Posture**
   - What we know: STATE.md flags "high legal scrutiny" for DATA-04
   - What's unclear: Whether storing Serper.dev search snippets (not scraping target sites) constitutes acceptable use
   - Recommendation: Implement conservatively -- store only search result metadata (title, snippet, URL) from Serper.dev. Do NOT follow links to scrape content from third-party sites. This limits legal exposure while still surfacing valuable intelligence.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/scraper/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-02 | SAM.gov adapter scrapes bid opportunities and returns valid RawLeadData | unit | `npx vitest run tests/scraper/sam-gov-adapter.test.ts -x` | Wave 0 |
| DATA-02 | Bid lead data validates against rawLeadSchema | unit | `npx vitest run tests/scraper/lead-validation.test.ts -x` | Wave 0 |
| DATA-03 | RSS news adapter parses feeds and filters construction-relevant items | unit | `npx vitest run tests/scraper/news-adapter.test.ts -x` | Wave 0 |
| DATA-03 | News leads include title, description, sourceUrl, and sourceType="news" | unit | `npx vitest run tests/scraper/news-adapter.test.ts -x` | Wave 0 |
| DATA-04 | Google dorking adapter sends queries to Serper.dev and returns structured leads | unit | `npx vitest run tests/scraper/dorking-adapter.test.ts -x` | Wave 0 |
| DATA-04 | Dorking queries are rotated and rate-limited per daily budget | unit | `npx vitest run tests/scraper/dorking-adapter.test.ts -x` | Wave 0 |
| DATA-06 | Dedup engine merges leads within 0.1 miles with >0.7 text similarity | unit | `npx vitest run tests/scraper/dedup.test.ts -x` | Wave 0 |
| DATA-06 | Dedup creates lead_sources entries for both merged and kept leads | unit | `npx vitest run tests/scraper/dedup.test.ts -x` | Wave 0 |
| DATA-06 | Dedup does NOT merge distinct projects at nearby addresses | unit | `npx vitest run tests/scraper/dedup.test.ts -x` | Wave 0 |
| DATA-06 | Pipeline runs all source-type adapters and produces PipelineRunResult | unit | `npx vitest run tests/scraper/pipeline.test.ts -x` | Exists (needs update) |
| DATA-06 | Lead detail view shows all source references for a canonical lead | integration | `npx vitest run tests/leads/multi-source.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/sam-gov-adapter.test.ts` -- covers DATA-02
- [ ] `tests/scraper/news-adapter.test.ts` -- covers DATA-03
- [ ] `tests/scraper/dorking-adapter.test.ts` -- covers DATA-04
- [ ] `tests/scraper/dedup.test.ts` -- covers DATA-06
- [ ] `tests/scraper/lead-validation.test.ts` -- covers generalized RawLeadData validation
- [ ] `tests/leads/multi-source.test.ts` -- covers lead detail with multiple source references
- [ ] `tests/helpers/scraper.ts` -- update existing mock helpers for generalized RawLeadData
- [ ] Update `tests/scraper/pipeline.test.ts` -- adapt for generalized adapter interface

## Sources

### Primary (HIGH confidence)
- SAM.gov Get Opportunities Public API documentation: https://open.gsa.gov/api/get-opportunities-public-api/ -- endpoint, auth, query params, response format
- ENR RSS feeds page: https://www.enr.com/rss -- verified available feed URLs and structure
- Google Custom Search API overview: https://developers.google.com/custom-search/v1/overview -- confirmed closure to new customers
- Existing codebase: `src/lib/scraper/` -- adapter pattern, pipeline orchestrator, registry, scheduler

### Secondary (MEDIUM confidence)
- Serper.dev: https://serper.dev/ -- pricing, capabilities, free tier (verified across multiple comparison sources)
- Construction NAICS codes: https://www.naics.com/naics-code-description/?v=2022&code=23 -- sector 23 breakdown
- rss-parser npm: https://www.npmjs.com/package/rss-parser -- TypeScript support, API surface
- PR Newswire construction: https://www.prnewswire.com/news-releases/heavy-industry-manufacturing-latest-news/construction-building-list/ -- free RSS access
- Construction Dive: https://www.constructiondive.com/ -- press release section with RSS

### Tertiary (LOW confidence)
- string-similarity npm usage patterns -- could not verify current download numbers (npmjs.com returned 403), recommended based on training data + ecosystem mentions
- Dedup threshold values (0.1 miles, 0.7 similarity) -- based on general entity resolution best practices, not construction-specific benchmarks. Will need tuning.
- SAM.gov registration timeline (1-4 weeks) -- based on web search results, not official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - SAM.gov API is well-documented; Serper.dev is newer but well-verified across comparison sites; RSS parsing is straightforward
- Architecture: HIGH - Existing adapter pattern is clean and extensible; junction table for multi-source tracking is standard relational design
- Pitfalls: HIGH - Most pitfalls are based on direct analysis of the codebase (backward compat) and verified API documentation (rate limits, registration delays)
- Deduplication: MEDIUM - Algorithm design is sound but threshold values need empirical tuning; no construction-specific benchmarks found

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- APIs and pricing may change)
