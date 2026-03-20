---
phase: 24-groundpulse-rebrand-landing-page
plan: 01
subsystem: ui, auth, email, scraper, billing, config
tags: [rebrand, branding, metadata, email-templates, user-agent, monogram]

# Dependency graph
requires:
  - phase: 18-intelligence-polish
    provides: Email templates, auth config, billing components, scraper adapters
provides:
  - Zero HeavyLeads/LeadForge references in codebase
  - GroundPulse branding across all user-facing surfaces
  - GP logo monogram in all navigation layouts
affects: [24-02-landing-page, 24-03-verification-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GP monogram with text-[10px] font-black tracking-tight for size-7, text-[9px] for size-6"

key-files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/components/emails/email-layout.tsx
    - src/lib/auth.ts
    - src/lib/stripe.ts
    - src/lib/scraper/adapters/nws-storm-adapter.ts
    - src/lib/scraper/adapters/ferc-energy.ts
    - CLAUDE.md
    - package.json
    - scripts/stripe-seed.ts

key-decisions:
  - "Combined Task 1 (text rebrand) and Task 2 (monogram update) into single atomic commit since changes overlap in same files"
  - "GP monogram uses text-[10px] for size-7 containers and text-[9px] for size-6 containers with tracking-tight"
  - "Email footer changed from Austin TX to United States to match storm-alert template pattern"

patterns-established:
  - "GroundPulse branding: all user-facing text, metadata, emails, User-Agent strings"
  - "GP monogram pattern: size-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-black tracking-tight"

requirements-completed: [BRAND-01, BRAND-02, BRAND-03, BRAND-04]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 24 Plan 01: GroundPulse Rebrand Summary

**Full codebase rebrand from HeavyLeads/LeadForge to GroundPulse across 56 files including all page metadata, email templates, scraper User-Agents, Stripe configs, test assertions, and GP logo monogram**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T06:30:17Z
- **Completed:** 2026-03-20T06:36:41Z
- **Tasks:** 2
- **Files modified:** 56

## Accomplishments
- Zero references to HeavyLeads, heavyleads, LeadForge, or leadforge remain in src/, tests/, scripts/, CLAUDE.md, or package.json
- All email templates (daily digest, weekly summary, storm alert, welcome, password reset, verify email) display GroundPulse branding
- All page metadata titles, OG tags, and Twitter cards use GroundPulse
- All scraper User-Agent strings updated to GroundPulse/1.0
- All logo monograms updated from "H" to "GP" with appropriate font sizing and tracking
- All test assertions updated to match new brand name
- Stripe product names and lookup keys updated in seed script

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace all HeavyLeads/LeadForge references with GroundPulse + Task 2: Update logo monogram** - `13ce55d` (feat)

**Note:** Tasks 1 and 2 were combined into a single commit because the logo monogram changes occurred in the same files as the text rebrand changes (layout files).

## Files Created/Modified
- `src/app/layout.tsx` - Root metadata with GroundPulse branding, OG tags, Twitter cards
- `src/app/(auth)/layout.tsx` - Auth layout with GP monogram and GroundPulse text
- `src/app/(dashboard)/layout.tsx` - Dashboard sidebar and mobile topbar with GP monogram
- `src/app/(billing)/layout.tsx` - Billing layout brand text
- `src/app/(onboarding)/onboarding/page.tsx` - Onboarding header with GP monogram
- `src/components/dashboard/mobile-nav.tsx` - Mobile nav brand link and GP monogram
- `src/components/auth/sign-in-form.tsx` - Sign-in form title
- `src/components/auth/sign-up-form.tsx` - Sign-up form description
- `src/components/emails/email-layout.tsx` - Shared email layout with GroundPulse branding and footer
- `src/components/emails/daily-digest.tsx` - Daily digest JSDoc
- `src/components/emails/weekly-summary.tsx` - Weekly summary JSDoc
- `src/components/emails/welcome.tsx` - Welcome email brand text and heading
- `src/components/emails/verify-email.tsx` - Verify email brand text
- `src/components/emails/storm-alert.tsx` - Storm alert brand text and footer
- `src/components/emails/password-reset.tsx` - Password reset brand text
- `src/lib/auth.ts` - Email sender from addresses and subjects
- `src/lib/stripe.ts` - Product name JSDoc
- `src/lib/email/send-digest.ts` - From address
- `src/lib/email/send-weekly-summary.ts` - From address
- `src/lib/email/send-storm-alert.ts` - From address
- `src/lib/scraper/adapters/ferc-energy.ts` - User-Agent header
- `src/lib/scraper/adapters/nws-storm-adapter.ts` - User-Agent header
- `src/app/api/cron/storm-alerts/route.ts` - Default app URL
- `src/actions/onboarding.ts` - Welcome email from and subject
- `src/components/billing/billing-status.tsx` - Plan name display
- `src/components/billing/plan-selector.tsx` - Trial description
- `src/components/dashboard/empty-state.tsx` - Welcome message
- `src/components/onboarding/wizard-shell.tsx` - Success toast
- `scripts/stripe-seed.ts` - Product name, lookup keys, console output
- `scripts/db-reset.ts` - Console output
- `scripts/seed-dev-account.ts` - Default company name
- `package.json` - Package name
- `CLAUDE.md` - Project guide title
- 13 page metadata files - Title suffixes updated
- 10 test files - Assertions and descriptions updated

## Decisions Made
- Combined Task 1 and Task 2 into single commit since monogram changes are in the same files as text changes
- GP monogram sizing: text-[10px] for size-7 containers, text-[9px] for size-6 containers, with tracking-tight for letter spacing
- Email footer location changed from "Austin, TX" to "United States" to match existing storm-alert template pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated seed-dev-account.ts LeadForge reference**
- **Found during:** Task 1
- **Issue:** scripts/seed-dev-account.ts contained 'LeadForge Dev' as default company name, not listed in plan files
- **Fix:** Changed to 'GroundPulse Dev'
- **Files modified:** scripts/seed-dev-account.ts
- **Committed in:** 13ce55d

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor scope addition to ensure complete rebrand. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors (63 errors in test files about missing children prop) are unrelated to rebrand changes -- verified by comparing before/after compilation

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All brand references updated, ready for Plan 02 (landing page redesign)
- src/app/page.tsx intentionally excluded per plan -- Plan 02 will replace it entirely
- Plan 03 (verification sweep) can confirm zero remaining references

---
*Phase: 24-groundpulse-rebrand-landing-page*
*Completed: 2026-03-20*
