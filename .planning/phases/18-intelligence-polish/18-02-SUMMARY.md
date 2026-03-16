# 18-02 Summary: CRM-lite Bookmarks & Email Verification

## Status: COMPLETE

## Task 1: CRM-lite bookmark actions and bookmarks page with filtering

### What was done
- Expanded `src/actions/bookmarks.ts` with three new server actions:
  - `updateBookmarkNotes` -- updates notes with ownership verification
  - `updateBookmarkStatus` -- updates pipeline status with validation (saved/contacted/in_progress/won/lost)
  - `getBookmarksWithDetails` -- returns bookmarks joined with lead data, supports status filtering
- Exported `PipelineStatus` type, `BookmarkWithLead` interface, and `PIPELINE_STATUSES` constant
- Created four bookmark components:
  - `PipelineStatusSelect` -- native select with color-coded status dot, useTransition pending state
  - `InlineNotes` -- auto-saves on blur, shows Saving.../Saved indicator
  - `BookmarkFilters` -- URL-persisted filter pills with per-status counts
  - `BookmarkCard` -- combines lead meta, status dropdown, and inline notes
- Rewrote bookmarks page with status filtering via searchParams, empty states per filter, metadata updated to "Pipeline | LeadForge"

### Tests: 13 passing
- updateBookmarkNotes: updates notes, auth check, ownership check
- updateBookmarkStatus: valid status, all 5 statuses, rejects invalid, auth check
- getBookmarksWithDetails: returns joined data, filters by status, empty array, auth check
- PIPELINE_STATUSES constant validation
- toggleBookmark default pipeline status via schema

## Task 2: Email verification gate for new users

### What was done
- Added `emailVerification` config within `emailAndPassword` section of `src/lib/auth.ts`:
  - `sendOnSignUp: true`, `autoSignInAfterVerification: true`
  - `sendVerificationEmail` callback using dynamic Resend import (same pattern as sendResetPassword)
  - Explicit type annotation on callback params to satisfy strict TypeScript
- Created `src/components/emails/verify-email.tsx` React Email template matching brand styles
- Created `src/app/verify-email/page.tsx` with check-your-inbox message and resend button
- Added email verification gate in `src/app/(dashboard)/layout.tsx`:
  - Uses legacy user cutoff (`LEGACY_USER_CUTOFF = "2026-03-17T00:00:00.000Z"`)
  - Users created before cutoff bypass verification (no migration needed)
  - New users with `emailVerified=false` redirect to `/verify-email`

### Tests: 6 passing
- emailVerification configured in auth with sendOnSignUp and autoSignInAfterVerification
- sendVerificationEmail sends via Resend with correct args
- sendVerificationEmail throws when RESEND_API_KEY missing
- VerifyEmail template renders correctly
- VerifyEmail template includes verification URL
- LEGACY_USER_CUTOFF is valid date string

## Verification
- All 19 new tests pass (13 bookmark + 6 email verification)
- All 56 existing auth/bookmark tests continue passing
- No type errors in any files created or modified by this plan
- Pre-existing TS errors in `tests/helpers/scraper.ts` and `tests/leads/` are unrelated to this plan

## Files Modified/Created
- `src/actions/bookmarks.ts` (expanded)
- `src/app/(dashboard)/dashboard/bookmarks/page.tsx` (rewritten)
- `src/components/bookmarks/pipeline-status-select.tsx` (new)
- `src/components/bookmarks/inline-notes.tsx` (new)
- `src/components/bookmarks/bookmark-filters.tsx` (new)
- `src/components/bookmarks/bookmark-card.tsx` (new)
- `src/lib/auth.ts` (emailVerification added)
- `src/app/(dashboard)/layout.tsx` (verification gate added)
- `src/components/emails/verify-email.tsx` (new)
- `src/app/verify-email/page.tsx` (new)
- `tests/bookmarks/crm-actions.test.ts` (new)
- `tests/auth/email-verification.test.ts` (new)
