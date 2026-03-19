# HeavyLeads - Claude Code Guide

## Project
B2B SaaS platform for construction lead intelligence. Aggregates permits, bids, and project news into scored leads for heavy equipment dealers and related trades.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Database:** Drizzle ORM + Neon PostgreSQL (serverless)
- **Auth:** Better Auth (email/password, organizations, email verification)
- **Billing:** Stripe (7-day trial + subscriptions)
- **UI:** Tailwind CSS 4 + shadcn/ui (base-nova, @base-ui/react primitives)
- **Email:** Resend
- **Scraping:** Crawlee + RSS Parser
- **Deployment:** Vercel (auto-deploy from main)

## Key Conventions
- Route groups: `(auth)`, `(dashboard)`, `(billing)`, `(onboarding)`
- Server actions in `src/actions/`
- Zod v4 validators in `src/lib/validators/`
- Uses `@base-ui/react` primitives (not radix) for UI components
- Multi-industry support via `Industry` type union
- Org-based multi-tenancy via Better Auth organizations

## Workflow
- Use GSD framework and superpowers skills library for task execution
- Use design-inspiration skill before UI work (reference: Stripe, Vercel, Linear, HubSpot aesthetic)
- Pull latest → implement → type-check → commit → push → verify Vercel deploy
- Save context to memory after each session

## Common Commands
```bash
export PATH="/c/Program Files/nodejs:$PATH"  # Node.js path for bash shell
npm run dev          # Start dev server
npx next build       # Production build (needs env vars for full build)
npx drizzle-kit push # Push schema changes to DB
```

## Environment
- `.env` required for Stripe, Neon, Resend, Google Maps, Better Auth
- `NEXT_PUBLIC_DEV_ACCESS=true` bypasses billing and email verification in dev
- Full build requires all env vars; TypeScript compilation is the local validation gate
