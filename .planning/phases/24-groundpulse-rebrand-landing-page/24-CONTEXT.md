# Phase 24: GroundPulse Rebrand & Landing Page - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Full rebrand from HeavyLeads to GroundPulse across the entire codebase. New logo/mark, email templates, metadata, OG tags. Complete landing page redesign that feels handcrafted and showcases all 5 industries with specific value propositions. The landing page must NOT look AI-generated — it needs personality, specificity, and trust signals.

</domain>

<decisions>
## Implementation Decisions

### Rebrand
- Replace ALL occurrences of "HeavyLeads" with "GroundPulse" across src/, tests/, and config files
- New logo mark: "GP" monogram in gold gradient (charcoal/white/gold color scheme stays)
- Update page titles, metadata, OG tags, email from addresses, User-Agent headers
- Update CLAUDE.md project description

### Landing Page Design
- Must feel handcrafted, not template-generated. Key principles:
  - Use SPECIFIC numbers and stats (e.g., "300+ city data portals", "20+ data sources", "5 industries")
  - Industry-specific sections with real examples (not generic "we help contractors")
  - Asymmetric layout with visual personality (not a grid of identical cards)
  - Micro-interactions and subtle animations via CSS (not JavaScript libraries)
  - Copy that speaks directly to tradespeople, not corporate jargon
  - Trust signals: data source logos, coverage map visualization, industry badges
- Color scheme: charcoal grey (#1a1a1e), white, gold (#c8a951 / amber-400-500)
- Typography: bold display headings, readable body text
- Keep the Framer-inspired dark aesthetic from the current hero

### Industry Showcase
- Each of 5 industries gets its own mini-section with:
  - Industry icon
  - Specific lead types for that industry (not generic)
  - Example lead description
  - Why it matters to that specific trade

### Claude's Discretion
- Exact copy/messaging
- Animation details
- Section ordering beyond hero → industries → stats → CTA → footer
- Whether to add a "How it works" section

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/page.tsx` — current landing page (charcoal/gold theme already)
- `src/app/layout.tsx` — root layout with metadata
- `src/app/(auth)/layout.tsx` — auth pages with branded panel
- `src/app/(dashboard)/layout.tsx` — dashboard with dark sidebar
- `src/app/globals.css` — charcoal/white/gold CSS custom properties
- `src/components/emails/*.tsx` — 6 email templates
- `src/lib/auth.ts` — email from addresses
- `src/lib/email/*.ts` — email sending utilities

### Established Patterns
- Tailwind CSS for all styling
- lucide-react for icons
- No CSS animation libraries — use Tailwind transitions/animations

### Integration Points
- Every file in src/ that references "HeavyLeads"
- `vercel.json` — if domain needs updating
- CLAUDE.md — project description

</code_context>

<specifics>
## Specific Ideas

User explicitly said:
- "I want another complete redesign on the landing page, it looks AI generated"
- "change the name to groundpulse"
- Color scheme: charcoal grey, white, gold
- Referenced Monday for onboarding, Framer for landing page, Asana for dashboard

The landing page needs to feel like a real product page, not a template.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
