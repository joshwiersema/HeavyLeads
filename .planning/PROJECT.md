# LeadForge (formerly HeavyLeads)

## What This Is

A multi-tenant SaaS lead generation platform for blue-collar businesses across 5 verticals: heavy equipment, HVAC, roofing, solar installation, and electrical contractors. Businesses sign up, complete an industry-specific onboarding, and receive a personalized feed of actionable leads scraped from public data sources — permits, government bids, weather events, code violations, utility filings, incentive programs, and more.

## Core Value

Every morning, a blue-collar business owner opens LeadForge and sees fresh, high-scoring leads personalized to their industry, specializations, and service area — leads they would have otherwise missed.

## Current Milestone: v3.0 LeadForge Multi-Industry Platform

**Goal:** Transform from single-industry heavy equipment tool into a 5-industry lead generation platform with industry-specific scraping, query-time scoring, multi-step onboarding, CRM-lite bookmarks, and expanded notification system.

**Target features:**
- Multi-industry support (heavy equipment, HVAC, roofing, solar, electrical)
- New database schema with industry-aware organization profiles
- 6-step industry-conditional onboarding wizard
- Generalized scraper architecture with industry registry
- 12+ new scraper adapters (NOAA storms, FEMA, code violations, energy benchmarks, DSIRE, NEVI, utility rates, etc.)
- Query-time scoring engine (distance, relevance, value, freshness, urgency)
- Cursor-based pagination
- Dashboard overhaul with filter panel, score badges, match reasons, storm alerts
- CRM-lite bookmarks with pipeline status tracking
- Auth hardening (email verification, atomic signup, better error messages)
- Expanded cron architecture (10 scheduled jobs)
- Email system overhaul (React Email templates, storm alerts, unsubscribe/CAN-SPAM)
- Industry-specific theming

## Requirements

### Validated

Shipped in v1.0 (2026-03-14):
- ✓ Automated scraping of permits, bids, news, deep web — v1.0
- ✓ Equipment inference, lead scoring, timeline mapping — v1.0
- ✓ Filterable dashboard with lead detail pages — v1.0
- ✓ Lead status tracking, bookmarks, saved searches — v1.0
- ✓ Multi-tenant auth with organizations — v1.0
- ✓ Basic onboarding (location, equipment, radius) — v1.0
- ✓ Stripe billing infrastructure — v1.0

Shipped in v2.0 (2026-03-15):
- ✓ Free trial billing with Stripe-native trial period — v2.0
- ✓ Stripe customer creation fix (lazy org-level) — v2.0
- ✓ Automatic lead generation via Vercel Cron — v2.0
- ✓ First-login auto-trigger + on-demand refresh — v2.0
- ✓ Mobile navigation drawer — v2.0 post-rework
- ✓ Landing page for unauthenticated visitors — v2.0 post-rework

Shipped in v2.1 (2026-03-16):
- ✓ Regression tests for all 15 v2.0 post-rework bug fixes — Phase 9
- ✓ Lead feed pagination with Previous/Next controls — Phase 10
- ✓ Bookmarks batch query replacing N+1 — Phase 10
- ✓ Digest email query optimization — Phase 10
- ✓ Non-permit dedup via sourceUrl — Phase 10
- ✓ Forgot password flow via email — Phase 11
- ✓ Active nav highlighting — Phase 12

### Active

See `.planning/REQUIREMENTS.md` for v3.0 requirements with REQ-IDs.

### Out of Scope

- Automated outreach/emailing — risk of spam, compliance issues, wrong tone
- Mobile native app — web-first
- Real-time chat/messaging — not core to lead discovery
- International markets — U.S. only
- Manual lead entry/import — defer to future
- ML/AI lead scoring — regex + keyword matching for v3.0, ML is future
- Team management/invitations — stretch goal, not MVP
- SMS notifications — stubbed but not integrated (Twilio later)

## Context

- v2.1 is deployed on Vercel at heavy-leads.vercel.app
- App is being rebranded from HeavyLeads to LeadForge
- 5 target industries: heavy equipment (existing), HVAC, roofing, solar, electrical
- Each industry gets its own scraping algorithms, data sources, and scoring logic
- Business model: one-time setup fee + monthly subscription, non-exclusive leads
- Target customer: small to medium businesses, solo operators up to ~100 employees
- Storm events are the killer feature for roofing — hail alerts within 2 hours
- Database is Neon PostgreSQL, project ID: restless-bonus-58249089
- Scoring must happen at QUERY TIME (not insert time) — same lead scores differently per subscriber

## Constraints

- **Production-first**: All changes must work on Vercel deployment, not just locally
- **Safety**: Site is live and working — changes must not break existing functionality
- **Incremental**: Each phase should be deployable independently
- **Tech stack**: Next.js App Router, TypeScript, Drizzle, Neon, Better Auth, Stripe, Resend, Tailwind, shadcn/ui — no framework changes
- **Type safety**: Zod for all user input, API responses, scraper outputs — no `any` types
- **Rate limits**: Respect API rate limits (SAM.gov 10/s, NOAA token-based, Socrata 1000/hr)
- **Legal**: Web scraping respects robots.txt and terms of service
- **Env vars**: Always .trim() env vars — Vercel pastes trailing \n
- **No infra on critical paths**: Never add modules to db/auth/stripe init without explicit ask

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No automated outreach | Risk of spam/compliance; app is intelligence layer | ✓ Good |
| Multi-tenant SaaS from day 1 | Broader market, not tied to one customer | ✓ Good |
| Query-time scoring | Same lead scores differently per subscriber profile | — Pending |
| Cursor-based pagination | Offset + score = inconsistent; cursor is more reliable | — Pending |
| Industry-specific scraper registry | Each industry needs different data sources and logic | — Pending |
| Storm events as killer feature | Roofers will pay premium for fast hail alerts | — Pending |
| Hash-based deduplication | Replace fragile title/location dedup with deterministic hashes | — Pending |
| useReducer for wizard state | Multi-step wizard with many fields — useState won't scale | — Pending |
| One-time fee + subscription | Customer preference for setup + ongoing model | ✓ Good |
| 7-day free trial | Reduce signup friction, let users see value before paying | ✓ Good |
| No env.ts on critical path | Caused production 500 — validate at usage points instead | ✓ Good |

---
*Last updated: 2026-03-16 after milestone v3.0 started*
