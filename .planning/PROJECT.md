# HeavyLeads

## What This Is

A multi-tenant SaaS web application that automatically discovers and aggregates construction project leads, equipment rental opportunities, and contractor activity across the U.S. for heavy machinery companies. Sales teams get a daily feed of qualified leads — filtered by equipment type, geography, and project relevance — with automatic lead generation and a professional onboarding experience.

## Core Value

Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed — no cold calling, no Googling, no guesswork.

## Current Milestone: v2.0 Production Rework

**Goal:** Fix production blockers, add free trial, professionalize onboarding, automate lead generation, and add custom search — make the app actually work end-to-end.

**Target features:**
- 1-week free trial for all new signups
- Fix Stripe customer creation error on registration
- Robust onboarding (company details, team invites, guided dashboard tour)
- Automatic lead generation (daily cron + first-login trigger + on-demand refresh)
- Custom lead search (location/keywords/project type beyond default filters)
- Overall polish and production readiness

## Requirements

### Validated

Shipped in v1.0 (2026-03-14):
- ✓ Automated scraping of permits, bids, news, deep web — v1.0
- ✓ Equipment inference, scoring, timeline mapping — v1.0
- ✓ Filterable dashboard with lead detail pages — v1.0
- ✓ Lead status tracking, bookmarks, saved searches — v1.0
- ✓ Multi-tenant auth with organizations — v1.0
- ✓ Basic onboarding (location, equipment, radius) — v1.0
- ✓ Stripe billing infrastructure — v1.0

### Active

- [ ] 1-week free trial on signup (no credit card required to explore)
- [ ] Fix Stripe customer creation error during registration
- [ ] Professional onboarding: company details (name, website, phone, logo, industry segment)
- [ ] Team setup during onboarding: invite members, assign roles
- [ ] Guided dashboard tour after onboarding
- [ ] Automatic lead generation via Vercel Cron (daily schedule)
- [ ] First-login lead trigger so new companies see leads immediately
- [ ] On-demand "Refresh Leads" for manual trigger
- [ ] Custom lead search: user-specified location, keywords, project type
- [ ] Overall UI/UX polish for production readiness

### Out of Scope

- Automated outreach/emailing — risk of spam, compliance issues, wrong tone
- Mobile native app — web-first
- CRM integration — defer to future
- Real-time chat/messaging — not core to lead discovery
- International markets — U.S. only
- Manual lead entry/import — defer to future

## Context

- v1.0 is deployed on Vercel at heavy-leads.vercel.app but has production issues
- Stripe customer creation fails on signup (likely missing/misconfigured Stripe keys or plugin config)
- Onboarding feels thin — only 3 steps, no company branding, no team setup
- Scraper only runs when API endpoint is manually hit — no automation
- Dashboard is empty for new users — no leads until scraper runs
- Target user is the sales rep or sales manager at a heavy machinery dealership or rental company
- Database is Neon PostgreSQL, project ID: restless-bonus-58249089

## Constraints

- **Production-first**: All changes must work on Vercel deployment, not just locally
- **Data access**: Public permit/bid data varies by municipality — scraping handles inconsistent formats
- **Legal**: Web scraping respects robots.txt and terms of service
- **Freshness**: Leads must be daily — stale data kills trust
- **Free trial**: Must not require credit card — reduce friction to explore

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No automated outreach | Risk of spam/compliance; app is intelligence layer, not sales bot | ✓ Good |
| Multi-tenant SaaS from day 1 | Broader market, not tied to one customer | ✓ Good |
| Radius-based geo filtering | More intuitive than state selection for equipment dealers with regional coverage | ✓ Good |
| One-time fee + subscription | Customer preference for setup + ongoing model | ✓ Good |
| 1-week free trial | Reduce signup friction, let users see value before paying | — Pending |
| Vercel Cron for scraping | Serverless-friendly, no separate infra to manage | — Pending |
| Custom search as user-initiated | Complements automatic leads without overloading scraper | — Pending |

---
*Last updated: 2026-03-15 after v2.0 milestone start*
