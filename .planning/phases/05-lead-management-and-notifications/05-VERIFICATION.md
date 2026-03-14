---
phase: 05-lead-management-and-notifications
verified: 2026-03-14T20:30:00Z
status: passed
score: 16/16 must-haves verified
---

# Phase 5: Lead Management and Notifications Verification Report

**Phase Goal:** Sales reps can track their lead workflow and receive proactive notifications about new matches
**Verified:** 2026-03-14T20:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

**Plan 05-01 truths**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lead status can be set and retrieved per user per organization | VERIFIED | `updateLeadStatus` upserts to `leadStatuses` scoped by userId+leadId+orgId; `getLeadStatus` queries same; uniqueIndex on (userId, leadId, organizationId) enforced at DB level |
| 2 | Leads without explicit status default to 'new' at the query layer | VERIFIED | `getLeadStatus` returns literal `"new"` when no row found; `getFilteredLeads` uses `COALESCE(${leadStatuses.status}, 'new')` in SELECT |
| 3 | Bookmarks can be toggled on and off per user per organization | VERIFIED | `toggleBookmark` checks existence, deletes or inserts with `onConflictDoNothing`; all WHERE clauses include userId+leadId+orgId |
| 4 | Saved searches store typed filter criteria and can be loaded as URL params | VERIFIED | `savedSearches` table has explicit columns for all 7 filter fields; `savedSearchToParams` in `saved-search-utils.ts` converts row to URLSearchParams string |
| 5 | Keyword search matches across title, description, address, applicantName, contractorName | VERIFIED | `buildFilterConditions` uses `or(ilike(leads.title,...), ilike(leads.description,...), ilike(leads.address,...), ilike(leads.applicantName,...), ilike(leads.contractorName,...))` |
| 6 | Date range and project size filters narrow query results correctly | VERIFIED | `buildFilterConditions` applies `gte`/`lte` on `leads.scrapedAt` for dates, `gte`/`lte` on `leads.estimatedValue` for project size |

**Plan 05-02 truths**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Lead cards display current status badge and bookmark toggle | VERIFIED | `LeadCard` reads `lead.status ?? "new"` and renders colored dot + label (hidden when "new"); renders filled Bookmark icon when `lead.isBookmarked` is true |
| 8 | Lead detail page has status dropdown and bookmark button | VERIFIED | `leads/[id]/page.tsx` imports `LeadStatusSelect` and `BookmarkButton`; both rendered in header section with parallel-fetched `status` and `isBookmarked` values |
| 9 | Dashboard filters sidebar includes keyword input, date range pickers, and project size range | VERIFIED | `lead-filters.tsx` has debounced keyword `<Input type="text">`, two `<Input type="date">` for From/To, two `<Input type="number">` for Min$/Max$ |
| 10 | Bookmarks page lists all bookmarked leads for the current user | VERIFIED | `bookmarks/page.tsx` calls `getBookmarkedLeads()`, resolves each id via `getLeadById`, renders with `LeadCard` component; empty state shown when none |
| 11 | Saved searches page lets user save current filters and load/delete saved searches | VERIFIED | `saved-searches/page.tsx` shows `SaveSearchForm` when `?save=true`; `SavedSearchCard` provides Load (navigates to `/dashboard?{params}`) and Delete (calls `deleteSavedSearch`) actions |
| 12 | Sidebar navigation includes links to Bookmarks and Saved Searches | VERIFIED | `layout.tsx` has four nav links: Leads (`LayoutDashboard`), Bookmarks (`Bookmark`), Saved Searches (`Search`), Settings (`Settings`) — all with lucide-react icons |

**Plan 05-03 truths**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 13 | Daily email digest is generated for each user with digest-enabled saved searches | VERIFIED | `generateDigests()` queries `savedSearches WHERE isDigestEnabled = true`, inner-joins with user table, groups by userId+orgId |
| 14 | Digest email contains new leads matching saved search criteria since last digest | VERIFIED | `generateDigests` calls `getFilteredLeads` with `dateFrom = 24 hours ago` for each saved search; deduplicates leads by Set of lead IDs |
| 15 | Digest email includes lead title, location, score, and direct link to lead detail | VERIFIED | `DailyDigestEmail` component renders each lead with title as link to `${dashboardUrl}/dashboard/leads/${lead.id}`, address, score badge, projectType, distance |
| 16 | Digest runs after the daily scraping pipeline completes | VERIFIED | `scheduler.ts` dynamically imports `generateDigests` inside the pipeline cron callback, after `runPipeline` returns, in its own isolated try/catch |

Additional truths also verified:
- "Users with no matching new leads receive no email" — `generateDigests` increments `skipped` and calls `continue` when `allLeads.length === 0`
- "Missing RESEND_API_KEY logs a warning and skips sending (no crash)" — `sendDigest` returns early with `console.log` when `!process.env.RESEND_API_KEY`

**Score:** 16/16 truths verified

---

## Required Artifacts

### Plan 05-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema/lead-statuses.ts` | Lead status junction table (userId+leadId+organizationId unique) | VERIFIED | pgTable `lead_statuses`; uniqueIndex on (userId, leadId, organizationId); exports `leadStatuses`, `LeadStatus`, `LEAD_STATUS_VALUES` |
| `src/lib/db/schema/bookmarks.ts` | Bookmark junction table (userId+leadId+organizationId unique) | VERIFIED | pgTable `bookmarks`; uniqueIndex on (userId, leadId, organizationId); cascade delete from leads |
| `src/lib/db/schema/saved-searches.ts` | Saved search configuration table with explicit filter columns | VERIFIED | pgTable `saved_searches`; 7 explicit filter columns plus `isDigestEnabled`; no JSON blob |
| `src/lib/leads/queries.ts` | Extended getFilteredLeads with keyword, dateFrom, dateTo, minProjectSize, maxProjectSize | VERIFIED | `GetFilteredLeadsParams` has all 7 new optional params; `buildFilterConditions` uses ilike+gte+lte; LEFT JOINs added when userId+orgId provided |
| `src/actions/lead-status.ts` | Server action for upsert lead status | VERIFIED | `updateLeadStatus` (upsert via onConflictDoUpdate) + `getLeadStatus`; Zod validation; auth guard; revalidatePath |
| `src/actions/bookmarks.ts` | Server action for bookmark toggle and list | VERIFIED | `toggleBookmark` + `getBookmarkedLeads`; auth guard; orgId-scoped queries |
| `src/actions/saved-searches.ts` | Server actions for saved search CRUD | VERIFIED | `createSavedSearch`, `deleteSavedSearch`, `getSavedSearches`, `getSavedSearchById`; Zod validation; auth guards; note on `savedSearchToParams` relocation |

### Plan 05-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/dashboard/lead-card.tsx` | Lead card with status badge and bookmark icon | VERIFIED | Renders colored status dot + label (suppressed for "new"); fills Bookmark icon when `lead.isBookmarked` |
| `src/app/(dashboard)/dashboard/lead-filters.tsx` | Extended filters with keyword, date range, project size | VERIFIED | 300ms debounced keyword input; two date inputs; two number inputs; Save Search button; URL param routing |
| `src/app/(dashboard)/dashboard/leads/[id]/lead-status-select.tsx` | Client component for status dropdown using updateLeadStatus action | VERIFIED | Imports and calls `updateLeadStatus`; uses `useTransition`; shadcn Select with color-coded StatusDot; sonner toast |
| `src/app/(dashboard)/dashboard/leads/[id]/bookmark-button.tsx` | Client component for bookmark toggle using toggleBookmark action | VERIFIED | Imports and calls `toggleBookmark`; uses `useOptimistic` + `useTransition`; filled/outline Bookmark icon |
| `src/app/(dashboard)/dashboard/bookmarks/page.tsx` | Bookmarked leads listing page | VERIFIED | Server component; calls `getBookmarkedLeads()` and `getLeadById`; renders LeadCard per lead; empty state |
| `src/app/(dashboard)/dashboard/saved-searches/page.tsx` | Saved search management page | VERIFIED | Server component; calls `getSavedSearches()`; conditionally renders `SaveSearchForm` when `?save=true`; `SavedSearchCard` per search |
| `src/app/(dashboard)/layout.tsx` | Updated sidebar with Bookmarks and Saved Searches nav links | VERIFIED | Four nav links with lucide-react icons: Leads, Bookmarks, Saved Searches, Settings |

Note: `savedSearchToParams` was extracted to `src/lib/leads/saved-search-utils.ts` (cannot export non-async from "use server" file — correct architectural decision).

### Plan 05-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/emails/daily-digest.tsx` | React Email template for daily lead digest | VERIFIED | `DailyDigestEmail` component; uses @react-email/components; inline styles; max 10 leads + overflow notice; footer with dashboard link |
| `src/lib/email/send-digest.ts` | Resend API wrapper for sending digest emails | VERIFIED | `sendDigest(to, userName, leads, dashboardUrl)`; env-var guard; Resend.emails.send with react param; per-recipient error isolation |
| `src/lib/email/digest-generator.ts` | Generates per-user digest data by matching new leads to saved searches | VERIFIED | `generateDigests()`; queries isDigestEnabled=true; groups by user; 24h window; deduplicates; returns DigestSummary |
| `src/app/api/email-digest/route.ts` | API route for triggering digest (POST, cron-compatible) | VERIFIED | POST handler; CRON_SECRET bearer auth with dev-mode bypass; calls `generateDigests()`; returns JSON summary + timestamps |
| `src/lib/scraper/scheduler.ts` | Updated scheduler that triggers digest after pipeline completion | VERIFIED | Dynamic import of `generateDigests` inside cron callback after `runPipeline`; isolated try/catch so digest failure does not abort pipeline |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/lead-status.ts` | `src/lib/db/schema/lead-statuses.ts` | `db.insert(leadStatuses)` | WIRED | Line 45: `db.insert(leadStatuses).values(...).onConflictDoUpdate(...)` |
| `src/actions/bookmarks.ts` | `src/lib/db/schema/bookmarks.ts` | `db.insert/delete` | WIRED | Lines 31/44: select check then delete or insert into bookmarks |
| `src/lib/leads/queries.ts` | `src/lib/db/schema/lead-statuses.ts` | LEFT JOIN for status enrichment | WIRED | Lines 284-293: `query.leftJoin(leadStatuses, and(...eq(leadStatuses.leadId, leads.id)...))` |
| `src/app/(dashboard)/dashboard/leads/[id]/lead-status-select.tsx` | `src/actions/lead-status.ts` | server action import | WIRED | Line 4: `import { updateLeadStatus } from "@/actions/lead-status"` + called in handleChange |
| `src/app/(dashboard)/dashboard/leads/[id]/bookmark-button.tsx` | `src/actions/bookmarks.ts` | server action import | WIRED | Line 4: `import { toggleBookmark } from "@/actions/bookmarks"` + called in handleClick |
| `src/app/(dashboard)/dashboard/saved-searches/page.tsx` | `src/actions/saved-searches.ts` | server action imports | WIRED | Line 2: `import { getSavedSearches }` called on line 26; `SavedSearchCard` imports `deleteSavedSearch` |
| `src/app/(dashboard)/dashboard/page.tsx` | `src/lib/leads/queries.ts` | getFilteredLeads with new filter params | WIRED | Lines 114-134: `getFilteredLeads({..., keyword, dateFrom, dateTo, minProjectSize, maxProjectSize, userId, organizationId})` — all new params passed |
| `src/lib/email/digest-generator.ts` | `src/lib/db/schema/saved-searches.ts` | query savedSearches with isDigestEnabled=true | WIRED | Line 46: `where(eq(savedSearches.isDigestEnabled, true))` |
| `src/lib/email/digest-generator.ts` | `src/lib/leads/queries.ts` | getFilteredLeads for matching leads | WIRED | Line 115: `await getFilteredLeads({...})` inside per-search loop |
| `src/lib/email/send-digest.ts` | `src/components/emails/daily-digest.tsx` | Resend react param | WIRED | Line 40: `react: DailyDigestEmail({ userName, leads, dashboardUrl })` |
| `src/lib/scraper/scheduler.ts` | `src/lib/email/digest-generator.ts` | dynamic import after pipeline | WIRED | Lines 37-38: `const { generateDigests } = await import("@/lib/email/digest-generator")` then awaited |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UX-02 | 05-01, 05-02 | User can track lead status (New / Viewed / Contacted / Won / Lost) | SATISFIED | `leadStatuses` schema table, `updateLeadStatus`/`getLeadStatus` server actions, `LeadStatusSelect` UI component, status indicators on `LeadCard` |
| UX-03 | 05-01, 05-02 | User can save searches and bookmark individual leads for quick re-access | SATISFIED | `bookmarks` + `savedSearches` schema tables, `toggleBookmark`/`getBookmarkedLeads`/saved-search CRUD server actions, `BookmarkButton` UI, `bookmarks/page.tsx`, `saved-searches/page.tsx` |
| UX-04 | 05-03 | User receives a daily email digest summarizing new matching leads with links to dashboard | SATISFIED | `DailyDigestEmail` React Email template, `generateDigests` function, `sendDigest` Resend integration, scheduler integration after pipeline |
| UX-06 | 05-01, 05-02 | User can search leads by keyword and filter by date range and project size | SATISFIED | `buildFilterConditions` with ilike keyword + gte/lte date/size filters, `LeadFilters` UI with all three filter groups, `dashboard/page.tsx` parsing and passing new URL params |

All 4 requirements assigned to Phase 5 are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

No blocking or warning-level anti-patterns found in any Phase 5 artifact.

The `deferred-items.md` documents a prior `Record<string, unknown>` type error in `queries.ts:279`. This was fixed in Plan 05-02 (auto-fixed issue #3 in `05-02-SUMMARY.md`) — the file now uses `Record<string, any>` at line 268, resolving the TypeScript compilation error.

---

## Human Verification Required

The following items cannot be verified programmatically and require browser testing:

### 1. Status dropdown interaction

**Test:** Log in, open any lead detail page, change the status from "New" to "Contacted" using the dropdown
**Expected:** Dropdown shows loading spinner during update, toast "Status updated" appears, status dot changes color; navigate back to dashboard and the lead card shows the "Contacted" indicator
**Why human:** UI transition state and toast visibility require browser execution

### 2. Bookmark toggle optimistic UI

**Test:** Open a lead detail page, click the Bookmark button
**Expected:** Icon immediately fills (optimistic update), toast "Lead bookmarked" appears; navigate to /dashboard/bookmarks and the lead appears in the list
**Why human:** Optimistic update visual feedback and cross-page state propagation require browser execution

### 3. Save Search round-trip

**Test:** On the dashboard, set keyword="hospital" and a date range; click "Save Search"; enter a name; click Save
**Expected:** Redirects to /dashboard/saved-searches; new saved search card shows the filter summary; clicking "Load" navigates to /dashboard with filters pre-applied
**Why human:** Form submission flow and URL parameter restoration require browser execution

### 4. Email digest rendering

**Test:** With `RESEND_API_KEY` set, POST to `/api/email-digest` and receive the email
**Expected:** Email arrives with lead titles as clickable links, score badges, distance and project type metadata, "View Dashboard" button in footer
**Why human:** Email rendering across clients (Gmail, Outlook) requires external service + visual inspection

---

## Gaps Summary

No gaps. All 16 must-have truths are verified. All 19 required artifacts exist with substantive implementations. All 11 key links are wired. All 4 requirements (UX-02, UX-03, UX-04, UX-06) are satisfied with direct implementation evidence.

The phase goal — "Sales reps can track their lead workflow and receive proactive notifications about new matches" — is achieved:
- Lead workflow tracking: status dropdown (5 states), bookmark toggle, and status/bookmark indicators on cards are all implemented and wired
- Proactive notifications: digest generator queries saved search criteria, matches new leads from a 24h window, and sends via Resend; scheduler triggers after each daily pipeline run
- Advanced discovery: keyword search and date/size filters are implemented end-to-end from URL params through SQL conditions

---

_Verified: 2026-03-14T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
