# Milestones: HeavyLeads

## v1.0 — Core Product (Completed 2026-03-14)

**Goal:** Build the foundational lead discovery platform — scraping, intelligence, dashboard, and billing.

**Phases:** 1-6 (15 plans, 1.7 hours total execution)

**Shipped:**
- Auth with multi-tenant organizations (Better Auth + Drizzle + Neon)
- 3-step onboarding wizard (location, equipment, radius)
- Scraping pipeline with 8 adapters (permits, bids, news, deep web)
- Equipment inference, lead scoring, timeline mapping
- Filterable dashboard with lead detail pages
- Lead status tracking, bookmarks, saved searches
- Daily email digest infrastructure
- Stripe subscription billing with setup fee

**Requirements:** 25/25 complete (DATA-01-07, LEAD-01-06, UX-01-06, PLAT-01-06)

**Last phase:** Phase 6 (Billing and Launch Readiness)

## v2.0 — Production Rework (Completed 2026-03-15)

**Goal:** Fix billing, add free trial, automate lead generation, and harden for production use.

**Phases:** 7-8 (4 plans, ~0.3 hours total execution)

**Shipped:**
- Stripe customer creation fix (org-level, not user-level)
- 7-day free trial via Stripe Checkout with trial UI
- Vercel Cron daily scraping pipeline
- First-login auto-trigger and on-demand refresh
- Empty state messaging
- 15 post-rework bug fixes (permit upsert, geocoding, lead scoring, auth redirects, etc.)

**Requirements:** 11/11 complete (BILL-01-05, AUTO-01-05, PLSH-02)

**Last phase:** Phase 8 (Lead Automation)

## v2.1 — Bug Fixes & Hardening (In Progress)

**Goal:** Harden the production app with regression tests, resolve deferred performance bugs, and add password recovery.

**Phases:** 9-12

**Targets:**
- Regression test suite for all 15 v2.0 post-rework bug fixes
- Lead feed pagination with Previous/Next controls
- Bookmarks batch query (replace N+1)
- Digest email query optimization
- Non-permit dedup via sourceUrl
- Forgot password flow via email
- Active nav highlighting

**Requirements:** 0/8 complete (TEST-01-02, PERF-01-04, AUTH-01, UI-01)

**Last phase:** Phase 12 (UI Polish)
