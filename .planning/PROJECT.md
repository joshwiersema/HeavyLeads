# HeavyLeads

## What This Is

A multi-tenant SaaS web application that automatically discovers and aggregates construction project leads, equipment rental opportunities, and contractor activity across the U.S. for heavy machinery companies. Sales teams get a daily feed of qualified leads — filtered by equipment type, geography, and project relevance — with automatic lead generation and a professional onboarding experience.

## Core Value

Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed — no cold calling, no Googling, no guesswork.

## Current Milestone: v2.1 Bug Fixes & Hardening

**Goal:** Harden the production app with regression tests for all recent fixes, resolve remaining deferred bugs, and add auth polish (forgot password, email verification, active nav).

**Target features:**
- Regression tests for 15 bug fixes shipped in v2.0 post-rework
- Lead feed pagination (BUG 13)
- Bookmarks batch query replacing N+1 (BUG 14)
- Digest email query optimization (BUG 10)
- Non-permit dedup improvement using sourceUrl (BUG 9)
- Active nav highlighting in sidebar
- Forgot password flow via email
- Email verification on signup

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

Shipped in v2.0 (2026-03-15):
- ✓ Free trial billing with Stripe-native trial period — v2.0
- ✓ Stripe customer creation fix (lazy org-level) — v2.0
- ✓ Automatic lead generation via Vercel Cron — v2.0
- ✓ First-login auto-trigger + on-demand refresh — v2.0
- ✓ Mobile navigation drawer — v2.0 post-rework
- ✓ Landing page for unauthenticated visitors — v2.0 post-rework
- ✓ Permit upsert data integrity fix (excluded.* pattern) — v2.0 post-rework
- ✓ Geocoding null-safe (no more 0,0 coords) — v2.0 post-rework
- ✓ Lead scoring fetch-multiplier (high-score leads no longer dropped) — v2.0 post-rework
- ✓ Error boundaries and loading skeletons — v2.0 post-rework
- ✓ Sign-in redirect loop fix — v2.0 post-rework
- ✓ Onboarding upsert (double-submit safe) — v2.0 post-rework

### Active

- [ ] Regression tests for all v2.0 post-rework bug fixes
- [ ] Lead feed pagination
- [ ] Bookmarks batch query (replace N+1)
- [ ] Digest email query optimization
- [ ] Non-permit dedup via sourceUrl
- [ ] Active nav highlighting in sidebar
- [ ] Forgot password flow
- [ ] Email verification on signup

### Out of Scope

- Automated outreach/emailing — risk of spam, compliance issues, wrong tone
- Mobile native app — web-first
- CRM integration — defer to future
- Real-time chat/messaging — not core to lead discovery
- International markets — U.S. only
- Manual lead entry/import — defer to future
- Middleware auth (BUG 17) — layout-level checks sufficient for current route count
- Env var startup validation — caused production 500; validate at usage points instead

## Context

- v2.0 is deployed on Vercel at heavy-leads.vercel.app
- 15 bug fixes shipped from battle test report (2026-03-15) — need regression coverage
- 4 deferred bugs remain (pagination, bookmarks N+1, digest N+1, dedup)
- Target user is the sales rep or sales manager at a heavy machinery dealership
- Database is Neon PostgreSQL, project ID: restless-bonus-58249089
- better-auth supports password reset and email verification natively

## Constraints

- **Production-first**: All changes must work on Vercel deployment, not just locally
- **Safety**: Site is live and working — changes must not break existing functionality
- **Testing**: Every fix needs a corresponding test before merge
- **Data access**: Public permit/bid data varies by municipality
- **Legal**: Web scraping respects robots.txt and terms of service

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No automated outreach | Risk of spam/compliance; app is intelligence layer, not sales bot | ✓ Good |
| Multi-tenant SaaS from day 1 | Broader market, not tied to one customer | ✓ Good |
| Radius-based geo filtering | More intuitive than state selection for equipment dealers with regional coverage | ✓ Good |
| One-time fee + subscription | Customer preference for setup + ongoing model | ✓ Good |
| 1-week free trial | Reduce signup friction, let users see value before paying | ✓ Good |
| Vercel Cron for scraping | Serverless-friendly, no separate infra to manage | ✓ Good |
| No env.ts on critical path | Caused production 500 — validate at usage points instead | ✓ Good |
| FETCH_MULTIPLIER = 4 for lead queries | Over-fetch rows before scoring so high-score older leads aren't excluded | — Pending |

---
*Last updated: 2026-03-15 after v2.1 milestone start*
