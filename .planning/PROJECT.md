# GroundPulse

## What This Is

A multi-tenant SaaS lead generation platform for blue-collar businesses across 5 verticals: heavy equipment, HVAC, roofing, solar installation, and electrical contractors. Businesses sign up, complete an industry-specific onboarding, and receive a personalized feed of actionable leads scraped from public data sources nationwide — permits, government bids, weather events, code violations, utility filings, incentive programs, and more.

## Core Value

Every morning, a blue-collar business owner opens GroundPulse and sees fresh, high-scoring leads personalized to their industry, specializations, and service area — leads they would have otherwise missed.

## Current Milestone: v4.0 GroundPulse Nationwide

**Goal:** Expand from 3-city Texas coverage to all 50 states, fix the broken scoring engine so leads actually differentiate, add every viable public lead source, rebrand to GroundPulse, and redesign the landing page to feel handcrafted.

**Target features:**
- Nationwide lead coverage (all 50 states via dynamic Socrata/ArcGIS discovery)
- Every viable public lead generation source integrated into pipeline
- Scoring engine fix — leads must produce meaningfully different scores
- Industry routing verified end-to-end (HVAC→HVAC, solar→solar, etc.)
- Complete rebrand from HeavyLeads to GroundPulse
- Landing page redesign — handcrafted, not AI-generated
- All dashboard features functioning as expected

## Requirements

### Validated

Shipped in v1.0-v3.0 (2026-03-14 to 2026-03-19):
- ✓ Automated scraping of permits, bids, news, deep web — v1.0
- ✓ Equipment inference, lead scoring, timeline mapping — v1.0
- ✓ Filterable dashboard with lead detail pages — v1.0
- ✓ Lead status tracking, bookmarks, saved searches — v1.0
- ✓ Multi-tenant auth with organizations — v1.0
- ✓ Stripe billing with 7-day free trial — v2.0
- ✓ Automatic lead generation via Vercel Cron — v2.0
- ✓ Multi-industry support (5 verticals) — v3.0
- ✓ 6-step industry-conditional onboarding wizard — v3.0
- ✓ Query-time scoring engine (5 dimensions) — v3.0
- ✓ CRM-lite bookmarks with pipeline status — v3.0
- ✓ Storm alerts, code violations, utility rates — v3.0
- ✓ Email system (React Email, digests, storm alerts, CAN-SPAM) — v3.0
- ✓ 15 bug fixes (transaction crash, industry classification, relevance scoring, etc.) — v3.1
- ✓ Charcoal/white/gold design system — v3.1
- ✓ Leaflet/OpenStreetMap maps (no API key) — v3.1
- ✓ Industry-specific equipment types — v3.1

### Active

See `.planning/REQUIREMENTS.md` for v4.0 requirements with REQ-IDs.

### Out of Scope

- Automated outreach/emailing — risk of spam, compliance issues, wrong tone
- Mobile native app — web-first
- Real-time chat/messaging — not core to lead discovery
- International markets — U.S. only
- Manual lead entry/import — defer to future
- ML/AI lead scoring — rule-based for v4.0, ML is future
- SMS notifications — defer to future

## Context

- v3.1 deployed on Vercel at heavy-leads.vercel.app
- Rebranding from HeavyLeads to GroundPulse (v4.0)
- 5 target industries: heavy equipment, HVAC, roofing, solar, electrical
- Currently only scraping Austin, Dallas, Atlanta — need all 50 states
- Scoring engine produces identical scores for all leads — needs fundamental fix
- Database is Neon PostgreSQL, project ID: restless-bonus-58249089
- Database was wiped clean on 2026-03-20 (fresh start)
- Scoring must happen at QUERY TIME — same lead scores differently per subscriber

## Constraints

- **Production-first**: All changes must work on Vercel deployment
- **Incremental**: Each phase should be deployable independently
- **Tech stack**: Next.js 16, TypeScript, Drizzle, Neon, Better Auth, Stripe, Resend, Tailwind, shadcn/ui
- **Type safety**: Zod for all user input, API responses, scraper outputs
- **Rate limits**: Respect API rate limits (SAM.gov 10/s, NOAA token-based, Socrata 1000/hr)
- **Legal**: Web scraping respects robots.txt and terms of service
- **No infra on critical paths**: Never add modules to db/auth/stripe init without explicit ask

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rebrand to GroundPulse | More universal than HeavyLeads — covers all 5 industries | — Pending |
| Dynamic Socrata discovery | Hundreds of cities publish permits on Socrata — discover at runtime | — Pending |
| Rule-based scoring fix | Scoring must differentiate — fix weighting, add variance sources | — Pending |
| All viable public sources | More sources = more leads = more value — no artificial limits | — Pending |
| Handcrafted landing page | Previous version looked AI-generated — needs unique personality | — Pending |

---
*Last updated: 2026-03-20 after milestone v4.0 started*
