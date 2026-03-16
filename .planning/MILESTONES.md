# Milestones: LeadForge

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

## v2.1 — Bug Fixes & Hardening (Completed 2026-03-16)

**Goal:** Harden the production app with regression tests, resolve deferred performance bugs, and add password recovery.

**Phases:** 9-12 (8 plans)

**Shipped:**
- Regression test suite for all 15 v2.0 post-rework bug fixes
- Lead feed pagination with Previous/Next controls
- Bookmarks batch query (replace N+1)
- Digest email query optimization
- Non-permit dedup via sourceUrl
- Forgot password flow via email
- Active nav highlighting

**Requirements:** 8/8 complete (TEST-01-02, PERF-01-04, AUTH-01v2.1, UI-01)

**Last phase:** Phase 12 (UI Polish)

## v3.0 — LeadForge Multi-Industry Platform (In Progress)

**Goal:** Transform from single-industry heavy equipment tool into a 5-industry lead generation platform with industry-specific scraping, query-time scoring, multi-step onboarding, CRM-lite bookmarks, and expanded notification system.

**Phases:** 13-18 (plans TBD)

**Targets:**
- Multi-industry support (heavy equipment, HVAC, roofing, solar, electrical)
- New database schema with industry-aware organization profiles and PostGIS
- 6-step industry-conditional onboarding wizard
- Generalized scraper architecture with industry registry and rate limiting
- NWS storm alerts, FEMA disasters, code violations, utility rates, solar incentives
- Query-time scoring engine (distance, relevance, value, freshness, urgency)
- Cursor-based pagination with filter panel
- CRM-lite bookmarks with pipeline status tracking
- Auth hardening (email verification, atomic signup, specific error messages)
- Expanded cron architecture (7 scheduled jobs)
- Email system overhaul (React Email templates, storm alerts, unsubscribe/CAN-SPAM)

**Requirements:** 0/61 complete (SCHM-01-07, ONBD-01-07, SCRP-01-10, SCOR-01-07, FEED-01-06, CRM-01-03, AUTH-01v3-05v3, BILL-01v3-03v3, NOTF-01-06, CRON-01-07)

**Last phase:** Phase 18 (Intelligence & Polish)
