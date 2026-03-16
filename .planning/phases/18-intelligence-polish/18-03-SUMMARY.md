---
phase: 18-intelligence-polish
plan: 03
status: complete
completed: 2026-03-16
commits:
  - 2609c73 "feat(18-03): add notification preferences, unsubscribe flow, and shared email layout"
  - 05c01a6 "feat(18-03): add daily digest and weekly summary email system with cron routes"
tests_added: 47
tests_passing: 47
files_created:
  - src/lib/db/schema/notification-preferences.ts
  - src/components/emails/email-layout.tsx
  - src/components/emails/weekly-summary.tsx
  - src/lib/email/unsubscribe.ts
  - src/lib/email/weekly-summary-generator.ts
  - src/lib/email/send-weekly-summary.ts
  - src/app/api/unsubscribe/route.ts
  - src/app/unsubscribe/page.tsx
  - src/app/api/cron/digest/route.ts
  - src/app/api/cron/weekly-summary/route.ts
  - tests/email/unsubscribe.test.ts
  - tests/email/digest-templates.test.ts
  - tests/email/weekly-summary.test.ts
files_modified:
  - src/lib/db/schema/index.ts
  - src/components/emails/daily-digest.tsx
  - src/lib/email/digest-generator.ts
  - src/lib/email/send-digest.ts
  - vercel.json
  - tests/email/digest-optimization.test.ts
  - tests/email/digest.test.ts
---

## What was done

### Task 1: Notification preferences, unsubscribe flow, and shared email layout
- Created `notification_preferences` table with `daily_digest` and `weekly_summary` boolean columns (opt-out model, defaults true per CAN-SPAM)
- Exported from schema index
- Created HMAC-SHA256 signed unsubscribe tokens using `crypto.createHmac` (no expiry per CAN-SPAM)
- Built `isSubscribed()` and `unsubscribeUser()` with upsert (ON CONFLICT DO UPDATE)
- Created shared `EmailLayout` component with industry-specific header colors (heavy_equipment=blue, hvac=teal, roofing=red, solar=amber, electrical=indigo)
- CAN-SPAM footer with unsubscribe link and physical address placeholder
- GET/POST `/api/unsubscribe` endpoint (no auth required, RFC 8058 compliant)
- `/unsubscribe` confirmation page with success/error states

### Task 2: React Email templates, digest/summary generators, and cron routes
- Rewrote `daily-digest.tsx` to use EmailLayout (industry theming, CAN-SPAM footer, LeadForge branding)
- Created `weekly-summary.tsx` with lead volume trends, top sources, top cities, bookmark count
- Updated `digest-generator.ts` to check `isSubscribed()`, get organization industry, generate unsubscribe URLs
- Updated `send-digest.ts` with `List-Unsubscribe` and `List-Unsubscribe-Post` headers, LeadForge branding
- Created `weekly-summary-generator.ts` with batch queries for lead counts, source types, cities, bookmarks
- Created `send-weekly-summary.ts` with same CAN-SPAM headers
- Created `/api/cron/digest` route (CRON_SECRET auth, maxDuration=120)
- Created `/api/cron/weekly-summary` route (same pattern)
- Updated `vercel.json` with 2 new cron entries (11 total): digest at 7 AM daily, weekly-summary Monday 8 AM
- Updated existing tests to mock new unsubscribe and organization dependencies

## Key decisions
- Used Node's built-in `crypto.createHmac` for unsubscribe tokens (no external dependency)
- Tokens encode `userId:emailType` with HMAC signature, base64url encoded
- Secret falls back through UNSUBSCRIBE_SECRET -> CRON_SECRET -> hardcoded fallback
- Weekly summary queries are per-user (not batched across all users) due to industry-specific filtering needs
- Industry color is looked up from the `organization` table, not the company profile
- Existing digest trigger in `/api/cron/scrape/route.ts` left unchanged (separate concern)
