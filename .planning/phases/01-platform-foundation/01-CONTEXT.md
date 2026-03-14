# Phase 1: Platform Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Auth, multi-tenancy with data isolation, company onboarding wizard, and account management. Users can create accounts, join tenant-isolated companies, and configure their dealer profile. No billing, no lead data, no scraping — just the platform shell.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation decisions for this phase are at Claude's discretion. User requested the most efficient approach with no consultation. The following guidelines apply:

- **Auth**: Use the most practical managed or self-hosted auth solution for a Next.js SaaS app — prioritize speed to implement, session persistence, and future extensibility (OAuth, magic links can be added later)
- **Multi-tenancy**: Row-level data isolation via tenant ID on all records — simplest model that meets the "Company A cannot see Company B's data" requirement
- **Onboarding wizard**: Multi-step form (HQ location, equipment types, service radius) — clean, minimal, functional
- **Equipment type selection**: Predefined list of common heavy machinery categories (excavators, boom lifts, forklifts, telehandlers, cranes, skid steers, etc.) with multi-select
- **Service radius**: Numeric input in miles from HQ location
- **HQ location**: Address input with geocoding to lat/lng for future radius queries
- **Roles**: Simple admin/member model — company creator is admin, can invite others
- **User joining**: Invite-based (admin sends invite link or email) — no open registration to companies
- **Account settings**: Users can edit name, email, password. Admins can edit company profile (name, HQ, equipment types, radius)
- **Tech stack**: Choose whatever is fastest to ship a production-quality SaaS foundation

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly requested most efficient option with full Claude discretion.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- This phase establishes the foundation that all subsequent phases build on
- Auth/session system must support future API endpoints for scraping pipeline (Phase 2)
- Tenant isolation model must support future lead data scoping (Phase 3+)
- Company profile (equipment types, HQ, radius) feeds lead scoring and filtering (Phase 3)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-platform-foundation*
*Context gathered: 2026-03-13*
