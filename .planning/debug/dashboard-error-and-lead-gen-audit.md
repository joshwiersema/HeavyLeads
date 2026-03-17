---
status: awaiting_human_verify
trigger: "Dashboard page throws an error after fresh dev account setup (onboarding completed, dev subscription created via Skip Dev Only button). Other tabs work. Also audit all lead generation code paths across 5 industry verticals."
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - db.execute() returns {rows: [...]} not an array, storm-alerts queries treated it as array
test: Build passes, storm-alerts tests pass (9/9), runtime verified via script
expecting: Dashboard now loads for roofing industry users; storm alert cron also fixed
next_action: Awaiting human verification that dashboard loads correctly

## Symptoms

expected: Dashboard loads properly showing leads after completing onboarding + using dev skip button for billing
actual: Dashboard page errors on load. Other tabs (bookmarks, saved-searches, settings) work fine.
errors: "rows.map is not a function" - db.execute() returns {rows: [...]} but code treated it as array
reproduction: 1) Create dev account 2) Complete onboarding as roofing industry 3) Use dev skip for subscription 4) Navigate to dashboard - crashes
started: Affects roofing industry orgs specifically. Storm alerts query is only called for roofing.

## Eliminated

- hypothesis: Empty leads table causes null access in dashboard rendering
  evidence: Dashboard page handles empty leads gracefully with DashboardEmptyState component
  timestamp: 2026-03-16T00:30:00Z

- hypothesis: Missing org profile or subscription prevents dashboard access
  evidence: DB confirmed org profile exists (onboarding_completed=true) and active subscription exists
  timestamp: 2026-03-16T00:40:00Z

## Evidence

- timestamp: 2026-03-16T00:30:00Z
  checked: Database state via debug script
  found: Org "New Tec" (roofing industry) has completed onboarding, active subscription, session with activeOrganizationId. Zero leads in DB.
  implication: Dashboard should render but something in the roofing-specific code path fails

- timestamp: 2026-03-16T00:45:00Z
  checked: db.execute() return type with neon-http driver
  found: Returns {rows: [...], fields: [...], ...} - NOT an array. Calling .map() on it throws "rows.map is not a function"
  implication: getActiveStormAlertsForOrg line 74 crashes for any roofing org

- timestamp: 2026-03-16T00:50:00Z
  checked: Only file using db.execute() in src/
  found: Only src/lib/storm-alerts/queries.ts uses db.execute(). Both functions have the same bug.
  implication: Both functions need the same fix

- timestamp: 2026-03-16T01:00:00Z
  checked: Fix applied and verified
  found: Changing (rows as ...).map() to (rows.rows as ...).map() fixes both functions. Build passes, 9/9 storm alert tests pass.
  implication: Fix is correct and complete

- timestamp: 2026-03-16T01:30:00Z
  checked: Full lead generation audit across all 5 verticals
  found: All adapter mappings, pipeline, scoring, enrichment, and cron scheduling are properly wired for heavy_equipment, hvac, roofing, solar, electrical. No other issues found.
  implication: The only bug was the db.execute() result handling in storm-alerts queries

## Resolution

root_cause: db.execute() with the neon-http Drizzle driver returns an object {rows: [...]} not an array. The storm-alerts/queries.ts file treated the result as an array and called .map() on it, causing "rows.map is not a function". This only affects roofing industry users because getActiveStormAlertsForOrg is only called when industry === "roofing" on the dashboard page, and also affected the storm-alerts cron route which calls both getActiveStormAlertsForOrg and getRoofingSubscribersInStormArea.
fix: Access .rows on the db.execute() result in both getActiveStormAlertsForOrg and getRoofingSubscribersInStormArea. Updated test mocks to return {rows: [...]} instead of bare arrays.
verification: Build passes, 9/9 storm alerts tests pass, runtime db.execute() verified via standalone script
files_changed:
  - src/lib/storm-alerts/queries.ts
  - tests/storm-alerts/queries.test.ts
