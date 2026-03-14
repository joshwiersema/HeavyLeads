# HeavyLeads

## What This Is

A multi-tenant SaaS web application that automatically discovers and aggregates construction project leads, equipment rental opportunities, and contractor activity across the U.S. for heavy machinery companies. Instead of burning intern hours on cold calls and manual news scanning, sales teams get a daily feed of qualified leads — filtered by equipment type, geography, and project relevance — with outreach suggestions ready to act on.

## Core Value

Every morning, a heavy machinery sales rep opens HeavyLeads and sees fresh, relevant project leads they would have otherwise missed — no cold calling, no Googling, no guesswork.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Automated scraping of building permits, bid boards, news/press releases, and deep web sources for construction project leads
- [ ] Google dorking and advanced search queries to surface contractor activity, project documents, and job postings
- [ ] Detection of rental companies looking to upgrade/expand their fleet as a second lead category
- [ ] Daily lead feed presented in a clean, scannable dashboard
- [ ] Equipment type filtering (forklifts, boom lifts, excavators, telehandlers, etc.) — show-all default with optional filters
- [ ] Geographic filtering by radius from company HQ
- [ ] Lead detail view with project info, contact details, estimated equipment needs
- [ ] Outreach suggestions (talking points, contact info) — NOT automated outreach
- [ ] Multi-tenant SaaS with company-level accounts
- [ ] Company onboarding: set HQ location, equipment types, service radius
- [ ] One-time setup fee + ongoing subscription pricing model
- [ ] User authentication and account management

### Out of Scope

- Automated outreach/emailing — risk of spam, compliance issues, wrong tone
- Mobile native app — web-first for v1
- CRM integration — defer to v2
- Real-time chat/messaging — not core to lead discovery
- International markets — U.S. only for v1

## Context

- Heavy machinery companies like New Tec (Sioux Center, IA) currently rely on interns cold calling, word of mouth, news scanning, and occasional referrals/marketing to generate leads
- Conversion comes from a mix of all sources — the problem is the labor cost and inefficiency, not the channel itself
- Two distinct lead types: (1) construction/contractor projects needing equipment rental, (2) rental companies looking to buy/upgrade fleet
- Data sources include city/county permit databases, government/private bid boards (Dodge, BidClerks), construction news outlets, and deep web queries
- Target user is the sales rep or sales manager at a heavy machinery dealership or rental company
- Priority is a working MVP fast — get core scraping and lead display working, iterate from feedback

## Constraints

- **Data access**: Public permit/bid data varies wildly by municipality — scraping must handle inconsistent formats
- **Legal**: Web scraping must respect robots.txt and terms of service; no private data harvesting
- **Freshness**: Leads must be daily — stale data kills trust
- **Scale**: Must work for any U.S. heavy machinery company, not hardcoded to one region

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No automated outreach | Risk of spam/compliance; app is intelligence layer, not sales bot | — Pending |
| Multi-tenant SaaS from day 1 | Broader market, not tied to one customer | — Pending |
| Radius-based geo filtering | More intuitive than state selection for equipment dealers with regional coverage | — Pending |
| One-time fee + subscription | Customer preference for setup + ongoing model | — Pending |
| MVP-first approach | Get core value working fast, iterate on feedback | — Pending |

---
*Last updated: 2026-03-13 after initialization*
