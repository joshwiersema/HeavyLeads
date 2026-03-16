# Phase 12: UI Polish - Research

**Researched:** 2026-03-16
**Domain:** Next.js App Router active navigation state / client component patterns
**Confidence:** HIGH

## Summary

Phase 12 addresses a single requirement (UI-01): visually highlighting the active page in both the desktop sidebar and mobile navigation drawer, including correct parent-item highlighting for nested routes like `/dashboard/leads/[id]`.

The codebase currently has **two separate navigation implementations** with different active-state capabilities. The **mobile nav** (`src/components/dashboard/mobile-nav.tsx`) is already a client component using `usePathname()` with active-state logic, but has an overly strict exact match for `/dashboard` that fails for nested routes like `/dashboard/leads/[id]`. The **desktop sidebar** in `src/app/(dashboard)/layout.tsx` is a server component that renders four static `<Link>` elements with zero active-state logic -- all links always look identical regardless of the current page.

The fix is straightforward: extract the desktop sidebar nav links into a shared client component (or a shared `NavLink` component) that uses `usePathname()` for active-state detection, then fix the route-matching logic for both desktop and mobile to correctly handle all nested routes. No new libraries needed. The existing `cn()` utility from `src/lib/utils.ts` and the `usePathname()` hook from `next/navigation` are sufficient.

**Primary recommendation:** Create a single `NavLink` client component (or a shared `navLinks` config + `SidebarNav` component) that both desktop and mobile nav consume, with a unified route-matching function that correctly handles exact matches, prefix matches, and the `/dashboard` vs `/dashboard/*` distinction.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Active page is visually highlighted in both desktop sidebar and mobile nav drawer | Desktop sidebar needs client component extraction with usePathname(); mobile nav needs route-matching fix for nested routes; both share same navLinks config and matching logic |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/navigation | 16.1.6 | `usePathname()` hook for current route | Built-in Next.js; already used in mobile-nav.tsx and settings-nav.tsx |
| clsx + tailwind-merge | clsx 2.1.1, tw-merge 3.5.0 | `cn()` utility for conditional class merging | Already used throughout project via `src/lib/utils.ts` |
| lucide-react | 0.577.0 | Nav icons (LayoutDashboard, Bookmark, Search, Settings) | Already used in both desktop and mobile nav |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Component testing for nav active states | Test verification of active-state behavior |
| vitest | 4.1.0 | Test runner | Existing test infrastructure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom route matching | next/navigation `useSelectedLayoutSegment()` | Works for segment-based matching but `usePathname()` is simpler and already established in this codebase |

## Architecture Patterns

### Current Navigation Architecture
```
src/app/(dashboard)/layout.tsx          # Server component - desktop sidebar (NO active state)
  -> 4x static <Link> elements          # All identical styling
  -> <MobileNav>                         # Client component (HAS active state, but buggy)

src/components/dashboard/mobile-nav.tsx  # "use client" - uses usePathname()
  -> navLinks array                      # Duplicated from layout.tsx
  -> isActive logic                      # Exact match for /dashboard, startsWith for others

src/components/settings/settings-nav.tsx # "use client" - uses usePathname()
  -> NAV_ITEMS array                     # Settings sub-navigation
  -> pathname === href matching          # Exact match (correct for settings sub-pages)
```

### Target Navigation Architecture
```
src/components/dashboard/nav-links.ts     # Shared navLinks config array
src/components/dashboard/sidebar-nav.tsx   # "use client" - desktop sidebar nav
src/components/dashboard/mobile-nav.tsx    # "use client" - mobile drawer nav (updated)
  -> Both import navLinks + use shared isActive logic
```

### Pattern: Route Matching for Active Nav State

**What:** A function that determines whether a nav link should be highlighted based on the current pathname.

**When to use:** Any nav link that needs active-state highlighting.

**Route map (all dashboard routes):**
```
/dashboard                    -> highlights "Leads"
/dashboard/bookmarks          -> highlights "Bookmarks"
/dashboard/saved-searches     -> highlights "Saved Searches"
/dashboard/leads/[id]         -> highlights "Leads" (nested route)
/settings                     -> highlights "Settings"
/settings/account             -> highlights "Settings"
/settings/company             -> highlights "Settings"
/settings/subscription        -> highlights "Settings"
/settings/security            -> highlights "Settings"
```

**Matching logic:**
```typescript
// Source: Analysis of existing mobile-nav.tsx and route structure
function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    // Match /dashboard exactly OR /dashboard/leads/* (nested lead detail)
    // But NOT /dashboard/bookmarks or /dashboard/saved-searches (they have their own nav items)
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/leads");
  }
  // For all other links: standard prefix match
  return pathname.startsWith(href);
}
```

**Key insight:** The `/dashboard` nav item is special because it is both the root AND the parent of `/dashboard/leads/[id]`, but NOT the parent of `/dashboard/bookmarks` or `/dashboard/saved-searches` (those are separate nav items). A naive `startsWith("/dashboard")` would highlight "Leads" for ALL dashboard sub-pages.

### Anti-Patterns to Avoid
- **Duplicating navLinks in two places:** The current code defines nav items inline in both `layout.tsx` and `mobile-nav.tsx`. Consolidate into a single shared array.
- **Server component for active nav:** A server component cannot access `usePathname()`. The desktop sidebar nav must be a client component. Keep the outer layout as a server component (for auth/data fetching) but extract just the nav links into a client child.
- **Using `useSelectedLayoutSegment()` when `usePathname()` works:** The project already has an established pattern with `usePathname()` in two components. Stick with it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional CSS classes | String concatenation | `cn()` from `src/lib/utils.ts` | Already used in settings-nav.tsx; handles Tailwind class conflicts |
| Route detection | Custom context/state | `usePathname()` from `next/navigation` | Built-in, reactive, SSR-safe |

**Key insight:** This phase needs zero new dependencies. Everything required already exists in the codebase.

## Common Pitfalls

### Pitfall 1: /dashboard Matching Too Broadly
**What goes wrong:** Using `pathname.startsWith("/dashboard")` makes the "Leads" item highlight for ALL dashboard pages including bookmarks and saved searches.
**Why it happens:** `/dashboard/bookmarks` starts with `/dashboard`.
**How to avoid:** Use a specific check: exact match on `/dashboard` OR prefix match on `/dashboard/leads` (the only nested child that should highlight "Leads").
**Warning signs:** "Leads" appears active when on the Bookmarks or Saved Searches page.

### Pitfall 2: Desktop Sidebar Stays a Server Component
**What goes wrong:** Trying to use `usePathname()` in the layout.tsx server component causes a build error or runtime crash.
**Why it happens:** `usePathname()` is a client-side hook; it cannot be used in a server component.
**How to avoid:** Extract the nav links section into a separate `"use client"` component. The layout remains a server component; only the nav portion becomes a client component.
**Warning signs:** `Error: usePathname only works in Client Components` at build time.

### Pitfall 3: Forgetting /settings Route Lives Under (dashboard) Group
**What goes wrong:** Settings link matching breaks because the route is `/settings` but lives under the `(dashboard)` route group.
**Why it happens:** Confusion between URL path and file-system route group.
**How to avoid:** Match on URL pathname `/settings`, which correctly handles all sub-routes via `pathname.startsWith("/settings")`.
**Warning signs:** Settings link never highlights, or highlights incorrectly.

### Pitfall 4: Flash of Incorrect Active State on Navigation
**What goes wrong:** Brief visual flicker where old page's nav item is still highlighted after clicking a new link.
**Why it happens:** `usePathname()` updates reactively with Next.js client-side navigation, so this is generally not an issue. But if the component unmounts/remounts (e.g., due to a layout boundary), there could be a flash.
**How to avoid:** Keep the nav component within the same layout boundary (both desktop and mobile nav are in the dashboard layout -- this is already correct).
**Warning signs:** Visual flicker when navigating between dashboard pages.

## Code Examples

Verified patterns from the existing codebase:

### Mobile Nav Active State (existing pattern in mobile-nav.tsx)
```typescript
// Source: src/components/dashboard/mobile-nav.tsx, lines 76-79
const isActive =
  href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
```
This is the current logic. It handles `/dashboard` exact matching and prefix matching for others, but **misses** `/dashboard/leads/[id]` because it requires exact `/dashboard` match for the Leads item.

### Settings Nav Active State (existing pattern)
```typescript
// Source: src/components/settings/settings-nav.tsx, lines 24-26
className={cn(
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
  pathname === href && "bg-accent text-accent-foreground"
)}
```
Uses `cn()` for clean conditional class application. This is the preferred pattern.

### Corrected isActive Logic
```typescript
// Corrected version that handles nested routes
function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    // Exact match OR nested lead detail pages
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/leads");
  }
  return pathname.startsWith(href);
}
```

### Shared NavLinks Config
```typescript
// Consolidated nav items (currently duplicated between layout.tsx and mobile-nav.tsx)
import { LayoutDashboard, Bookmark, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Leads", icon: LayoutDashboard },
  { href: "/dashboard/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/dashboard/saved-searches", label: "Saved Searches", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

### Active CSS Classes (existing in codebase)
```typescript
// Active state: bg-accent text-accent-foreground (already used in mobile-nav and settings-nav)
// Hover state: hover:bg-accent hover:text-accent-foreground
// Both desktop and mobile should use the same visual treatment for consistency
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual window.location checks | `usePathname()` from next/navigation | Next.js 13+ (App Router) | Reactive, SSR-compatible, no manual listeners |
| CSS :active pseudo-class | Tailwind conditional classes via `cn()` | N/A (project convention) | Full control over active state styling |

**No deprecated/outdated concerns for this phase.** The `usePathname()` hook is stable and current in Next.js 16.

## Open Questions

None. This phase is well-scoped with clear requirements and a straightforward implementation path. All needed patterns already exist in the codebase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/regressions/mobile-nav.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01a | Desktop sidebar highlights active page | unit | `npx vitest run tests/ui/sidebar-nav.test.tsx -x` | No - Wave 0 |
| UI-01b | Mobile nav highlights active page | unit | `npx vitest run tests/ui/mobile-nav-active.test.tsx -x` | No - Wave 0 |
| UI-01c | Nested route /dashboard/leads/[id] highlights Leads parent | unit | `npx vitest run tests/ui/sidebar-nav.test.tsx -x` | No - Wave 0 |
| UI-01d | /settings sub-routes highlight Settings parent | unit | `npx vitest run tests/ui/sidebar-nav.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/ui/ -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/ui/sidebar-nav.test.tsx` -- covers UI-01a, UI-01c, UI-01d (desktop sidebar active state for all routes)
- [ ] `tests/ui/mobile-nav-active.test.tsx` -- covers UI-01b (mobile nav active state with corrected matching)
- [ ] Existing `tests/regressions/mobile-nav.test.tsx` covers rendering but NOT active-state correctness (it hardcodes `usePathname` to always return `/dashboard`)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/app/(dashboard)/layout.tsx` (desktop sidebar, lines 58-97)
- Direct codebase analysis of `src/components/dashboard/mobile-nav.tsx` (mobile nav, full file)
- Direct codebase analysis of `src/components/settings/settings-nav.tsx` (settings nav pattern)
- Direct codebase analysis of route structure via `src/app/(dashboard)/` directory tree

### Secondary (MEDIUM confidence)
- Next.js `usePathname()` behavior -- stable hook, well-documented, used in two existing components in this codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in the project; no new dependencies
- Architecture: HIGH - Patterns directly observed in existing codebase (settings-nav.tsx, mobile-nav.tsx)
- Pitfalls: HIGH - Route matching edge cases identified by analyzing actual route tree in src/app/
- Implementation: HIGH - This is a small, well-bounded change with clear before/after behavior

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable; no external dependency changes expected)
