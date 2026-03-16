---
phase: 17-storm-alerts-weather
plan: 02
status: complete
completed: 2026-03-16
commits:
  - "feat(17-02): add storm alert queries, email template, and sender"
  - "feat(17-02): add storm alert banner and email dispatch in cron"
tests_added: 23
tests_passing: 23
---

# Plan 17-02 Summary: Storm Alert Banner & Email Notifications

## What was built

### Task 1: Storm alert queries, types, email template, and sender
- **`src/lib/storm-alerts/types.ts`** -- StormAlert, StormEmailPayload, SubscriberInfo interfaces
- **`src/lib/storm-alerts/queries.ts`** -- Two spatial query functions:
  - `getActiveStormAlertsForOrg(orgId)` -- Finds storm leads within org's service radius using haversine SQL, ordered by soonest expiring, limited to 10
  - `getRoofingSubscribersInStormArea(stormLat, stormLng)` -- Finds roofing orgs + members whose HQ is within service radius of storm centroid
  - Exported `haversineDistance()` utility for JS-side distance calculations
- **`src/components/emails/storm-alert.tsx`** -- React Email template with amber/orange (#d97706) theme, severity badges (Extreme=red, Severe=orange, Moderate=yellow), max 5 inline alerts with overflow notice, CTA to dashboard with `?sourceTypes=storm` filter
- **`src/lib/email/send-storm-alert.ts`** -- Resend sender following exact same pattern as send-digest.ts: RESEND_API_KEY guard, .trim() on env vars, storm-specific subject line with pluralization

### Task 2: Storm banner on dashboard and email dispatch in cron
- **`src/components/dashboard/storm-alert-banner.tsx`** -- Client component with:
  - Amber theme (bg-amber-50, border-amber-300, text-amber-900)
  - Alert count, most severe event title
  - Expand/collapse to show all alerts with severity badges and time remaining
  - Session-scoped dismiss via useState
  - Returns null when no alerts
- **`src/app/(dashboard)/dashboard/page.tsx`** -- Added conditional storm alert query (roofing industry only) and StormAlertBanner rendering after PipelineProgress, before the two-column layout
- **`src/app/api/cron/storm-alerts/route.ts`** -- Added post-pipeline email dispatch:
  - Collects newLeadIds from pipeline results
  - Fetches storm leads with coordinates
  - Finds affected roofing subscribers via spatial query
  - Deduplicates subscribers across multiple storms
  - Sends per-subscriber emails with their org's active storm alerts
  - Wrapped in try/catch so email failures don't fail the cron
  - Added emailsSent to JSON response

## Test coverage (23 tests)
- `tests/storm-alerts/queries.test.ts` -- 9 tests (query mapping, empty results, haversine distance calculations)
- `tests/storm-alerts/storm-email.test.ts` -- 7 tests (RESEND_API_KEY guard, subject pluralization, API error handling, template rendering, max 5 inline limit)
- `tests/storm-alerts/storm-banner.test.tsx` -- 7 tests (empty renders null, alert count, most severe title, dismiss hides, expand shows all, singular form, amber theme classes)

## Pre-existing issues (not introduced by this plan)
- `tests/regressions/mobile-nav.test.tsx` fails due to IndustryBadge component error (pre-existing)
- `next build` fails due to parallel agent's incomplete `getEiaQueue` export (pre-existing)
