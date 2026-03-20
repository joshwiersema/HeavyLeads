import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  MapPin,
  Clock,
  Shield,
  TrendingUp,
  Flame,
  Sun,
  Home,
  Cable,
  Database,
  Filter,
  Bell,
  BarChart3,
  ChevronRight,
  Star,
  Building2,
  Truck,
} from "lucide-react";

export default async function LandingPage() {
  // --- Auth redirect logic (keep existing) ---
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    if (session.session.activeOrganizationId) {
      const profile = await db.query.companyProfiles.findFirst({
        where: eq(
          companyProfiles.organizationId,
          session.session.activeOrganizationId
        ),
      });

      if (profile?.onboardingCompleted) {
        redirect("/dashboard");
      }
    }

    redirect("/onboarding");
  }

  // --- Landing page for unauthenticated visitors ---
  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1e] text-white">
      {/* ===== NAV ===== */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-bold text-white">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-black tracking-tight text-[#1a1a1e]">
            GP
          </div>
          GroundPulse
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 text-sm font-semibold text-[#1a1a1e] shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:brightness-110"
          >
            Start Free Trial
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section
        id="main-content"
        className="relative flex flex-col items-center gap-8 overflow-hidden px-6 pb-24 pt-36 text-center sm:pb-32 sm:pt-44"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(202,168,83,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(202,168,83,0.05),transparent_50%)]" />

        <div className="relative z-[1] flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-1.5 text-xs font-medium tracking-wide text-amber-300/90">
            <MapPin className="size-3" />
            Nationwide Coverage &middot; 50 States
          </span>

          <h1 className="max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Your next job is already
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              on file somewhere.
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-[#8a8a95] sm:text-xl">
            GroundPulse pulls permits, bids, federal contracts, and storm
            reports from 300+ city data portals and 20+ government sources
            — then scores every lead for your specific trade and territory.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-semibold text-[#1a1a1e] shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:brightness-110"
            >
              Start 7-Day Free Trial
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#industries"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/10"
            >
              See Your Industry
            </Link>
          </div>

          <p className="pt-1 text-xs text-[#555560]">
            No credit card required &middot; Set up in 5 minutes
          </p>
        </div>
      </section>

      {/* ===== LIVE DASHBOARD PREVIEW (Interactive Demo Element) ===== */}
      <section className="relative px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#222226] shadow-2xl shadow-black/50">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#1a1a1e] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-white/10" />
                <div className="size-2.5 rounded-full bg-white/10" />
                <div className="size-2.5 rounded-full bg-white/10" />
              </div>
              <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-[#555560]">
                app.groundpulse.com/dashboard
              </div>
            </div>

            {/* Mock dashboard content */}
            <div className="flex">
              {/* Mini sidebar */}
              <div className="hidden w-48 border-r border-white/5 bg-[#1a1a1e] p-4 sm:block">
                <div className="flex items-center gap-2 pb-4">
                  <div className="flex size-5 items-center justify-center rounded bg-gradient-to-br from-amber-400 to-amber-600 text-[7px] font-black text-[#1a1a1e]">GP</div>
                  <span className="text-xs font-semibold text-white">GroundPulse</span>
                </div>
                <div className="space-y-1">
                  <div className="rounded-md bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400">Lead Feed</div>
                  <div className="px-3 py-1.5 text-xs text-[#555560]">Pipeline</div>
                  <div className="px-3 py-1.5 text-xs text-[#555560]">Saved Searches</div>
                  <div className="px-3 py-1.5 text-xs text-[#555560]">Settings</div>
                </div>
              </div>

              {/* Mock lead cards */}
              <div className="flex-1 p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Today&apos;s Leads</h3>
                    <p className="text-xs text-[#555560]">12 new leads in your area</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">
                      <Filter className="mr-1 inline size-3" />Filters
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Lead card 1 -- high score */}
                  <div className="group rounded-xl border border-white/5 bg-[#1a1a1e] p-4 transition-all hover:border-amber-400/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">92</span>
                          <span className="text-xs font-medium text-amber-400">Permit</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-white">Commercial HVAC Replacement — 4200 Congress Ave</p>
                        <p className="mt-1 text-xs text-[#555560]">Austin, TX &middot; Est. $185,000 &middot; 2.3 mi away</p>
                      </div>
                      <ChevronRight className="size-4 text-[#555560] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">HVAC match</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">High value</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">Filed yesterday</span>
                    </div>
                  </div>

                  {/* Lead card 2 */}
                  <div className="group rounded-xl border border-white/5 bg-[#1a1a1e] p-4 transition-all hover:border-amber-400/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">78</span>
                          <span className="text-xs font-medium text-blue-400">Federal Contract</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-white">Army Corps Facility Roof Replacement — Ft. Hood</p>
                        <p className="mt-1 text-xs text-[#555560]">Killeen, TX &middot; $340,000 awarded &middot; 45 mi</p>
                      </div>
                      <ChevronRight className="size-4 text-[#555560] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">Roofing match</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">USAspending</span>
                    </div>
                  </div>

                  {/* Lead card 3 -- storm alert */}
                  <div className="group rounded-xl border border-amber-400/10 bg-[#1a1a1e] p-4 transition-all hover:border-amber-400/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">95</span>
                          <span className="text-xs font-medium text-red-400">Storm Alert</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-white">Hail Damage — NWS Severe Thunderstorm Warning</p>
                        <p className="mt-1 text-xs text-[#555560]">Round Rock, TX &middot; 1.5&quot; hail reported &middot; 8 mi</p>
                      </div>
                      <ChevronRight className="size-4 text-[#555560] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-red-500/5 px-2 py-0.5 text-[10px] text-red-300/80">Urgent</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8a8a95]">In service area</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Caption below preview */}
          <p className="mt-4 text-center text-sm text-[#555560]">
            Your dashboard — scored leads, filtered to your trade and territory, updated daily.
          </p>
        </div>
      </section>

      {/* ===== INDUSTRY SHOWCASE ===== */}
      <section id="industries" className="border-t border-white/5 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Built for Your Trade
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Same permits. Different opportunities.
            </h2>
            <p className="mt-4 text-lg text-[#8a8a95]">
              A $2M commercial build means excavators for one shop,
              ductwork for another, and panels for a third. GroundPulse
              scores every lead differently based on who you are.
            </p>
          </div>

          {/* Industry cards -- asymmetric layout: 2 large + 3 small */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Heavy Equipment -- large card spanning 2 cols */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#222226] p-8 transition-all hover:border-amber-400/20 lg:col-span-2">
              <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(202,168,83,0.08),transparent_70%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-amber-400/10">
                    <Truck className="size-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Heavy Equipment</h3>
                    <p className="text-xs text-[#555560]">Dealers, Rentals, Earthwork Contractors</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#8a8a95]">
                  When a $4.5M highway interchange permit gets filed with TxDOT, you
                  want to know before your competitors start calling. GroundPulse catches
                  site grading permits, demolition filings, and federal infrastructure
                  contracts — the jobs that need iron on-site.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Site grading permits</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Demolition filings</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">DOT contracts</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">USACE wetland work</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Commercial excavation</span>
                </div>
              </div>
            </div>

            {/* Roofing -- tall card */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#222226] p-8 transition-all hover:border-amber-400/20">
              <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.06),transparent_70%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-red-400/10">
                    <Home className="size-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Roofing</h3>
                    <p className="text-xs text-[#555560]">Residential & Commercial</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#8a8a95]">
                  NWS issues a severe thunderstorm warning with 1.5&quot; hail at 4 PM.
                  By 4:30, GroundPulse has matched the storm polygon against
                  your service area and emailed you. You&apos;re knocking doors
                  before the adjuster shows up.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Storm alerts</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Roof permits</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">FEMA declarations</span>
                </div>
              </div>
            </div>

            {/* HVAC */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#222226] p-8 transition-all hover:border-amber-400/20">
              <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.06),transparent_70%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-blue-400/10">
                    <Flame className="size-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">HVAC</h3>
                    <p className="text-xs text-[#555560]">Install, Service, Commercial</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#8a8a95]">
                  That new 12-story mixed-use building downtown needs mechanical plans.
                  GroundPulse catches the commercial build permit and flags it as
                  HVAC-relevant based on project scope and square footage — not just
                  keyword matching.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Mechanical permits</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Commercial builds</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Code violations</span>
                </div>
              </div>
            </div>

            {/* Solar */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#222226] p-8 transition-all hover:border-amber-400/20">
              <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.06),transparent_70%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-yellow-400/10">
                    <Sun className="size-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Solar</h3>
                    <p className="text-xs text-[#555560]">Residential & Commercial Install</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#8a8a95]">
                  New roof permit filed? That homeowner is already spending money up
                  there. GroundPulse surfaces roofing permits as solar cross-sell
                  opportunities, plus state incentive data and utility rate context
                  for your pitch.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Solar permits</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Roof permits (cross-sell)</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Incentive data</span>
                </div>
              </div>
            </div>

            {/* Electrical */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#222226] p-8 transition-all hover:border-amber-400/20">
              <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.06),transparent_70%)]" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-purple-400/10">
                    <Cable className="size-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Electrical</h3>
                    <p className="text-xs text-[#555560]">Commercial & Industrial</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#8a8a95]">
                  FCC tower registration in your county means someone needs conduit
                  and panel work. FERC filings signal substation upgrades. GroundPulse
                  watches the federal sources your competitors don&apos;t even know exist.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">Electrical permits</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">FCC registrations</span>
                  <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-[#8a8a95]">FERC filings</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="border-t border-white/5 bg-[#1e1e22] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              How It Works
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From permit filing to your phone. Automatically.
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="relative">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-bold text-amber-400">
                1
              </div>
              <h3 className="mb-2 text-lg font-semibold">We scrape the sources</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Every day, GroundPulse queries 300+ municipal data portals,
                USAspending, OSHA, EPA, NWS, FERC, FCC, and Grants.gov.
                New permits, contracts, inspections, and storm events get pulled
                into your feed automatically.
              </p>
            </div>

            <div className="relative">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-bold text-amber-400">
                2
              </div>
              <h3 className="mb-2 text-lg font-semibold">We score for your trade</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Each lead gets a 0-100 score across 5 dimensions: distance from
                your shop, relevance to your trade, estimated project value,
                how fresh the filing is, and urgency (storm alerts score higher
                than month-old permits).
              </p>
            </div>

            <div className="relative">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-bold text-amber-400">
                3
              </div>
              <h3 className="mb-2 text-lg font-semibold">You show up first</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Open your dashboard or check the morning email digest.
                Your best leads are on top, with match reasons so you
                know exactly why each one matters. Click, call, close.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DATA SOURCES STATS ===== */}
      <section className="border-t border-white/5 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              The Data
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              We watch the paperwork so you don&apos;t have to.
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/5 bg-[#222226] p-6 text-center">
              <p className="text-4xl font-bold text-amber-400">300+</p>
              <p className="mt-1 text-sm font-medium text-white">City Data Portals</p>
              <p className="mt-1 text-xs text-[#555560]">Socrata & ArcGIS auto-discovered</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#222226] p-6 text-center">
              <p className="text-4xl font-bold text-amber-400">20+</p>
              <p className="mt-1 text-sm font-medium text-white">Data Sources</p>
              <p className="mt-1 text-xs text-[#555560]">Permits, OSHA, EPA, NWS, FERC, FCC</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#222226] p-6 text-center">
              <p className="text-4xl font-bold text-amber-400">50</p>
              <p className="mt-1 text-sm font-medium text-white">States Covered</p>
              <p className="mt-1 text-xs text-[#555560]">Nationwide from day one</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#222226] p-6 text-center">
              <p className="text-4xl font-bold text-amber-400">5</p>
              <p className="mt-1 text-sm font-medium text-white">Industries</p>
              <p className="mt-1 text-xs text-[#555560]">Heavy equip, HVAC, roofing, solar, electrical</p>
            </div>
          </div>

          {/* Source logos / badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 text-[#555560]">
              <Database className="size-4" />
              <span className="text-xs font-medium">USAspending.gov</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <Shield className="size-4" />
              <span className="text-xs font-medium">OSHA</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <Building2 className="size-4" />
              <span className="text-xs font-medium">EPA Brownfields</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <Zap className="size-4" />
              <span className="text-xs font-medium">NWS Storm Alerts</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <TrendingUp className="size-4" />
              <span className="text-xs font-medium">FERC</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <Cable className="size-4" />
              <span className="text-xs font-medium">FCC</span>
            </div>
            <div className="flex items-center gap-2 text-[#555560]">
              <Star className="size-4" />
              <span className="text-xs font-medium">Grants.gov</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU GET ===== */}
      <section className="border-t border-white/5 bg-[#1e1e22] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Features
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tools that actually help you sell.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <Zap className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">5-Dimension Scoring</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                Distance, relevance, value, freshness, urgency. Every lead ranked
                for your specific business.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <Bell className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">Storm Alerts</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                NWS severe weather matched against your service area. Email
                within 30 minutes of issuance. Roofers only.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <BarChart3 className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">Lead Pipeline</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                Bookmark leads, add notes, track status from saved through
                contacted to won. A lightweight CRM built in.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <MapPin className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">Service Area Filtering</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                Set your radius. See only leads within driving distance.
                PostGIS spatial queries, not slow zip-code lookups.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <Clock className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">Daily Email Digest</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                Top 10 new leads in your inbox at 7 AM. Weekly summary
                every Monday. One-click unsubscribe.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#222226] p-5 transition-all hover:border-white/10">
              <Filter className="mb-3 size-5 text-amber-400" />
              <h3 className="mb-1 text-sm font-semibold">Smart Filters</h3>
              <p className="text-xs leading-relaxed text-[#8a8a95]">
                Filter by source, distance, value range, project type, or date.
                Save searches and get notified when new matches appear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative border-t border-white/5 px-6 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(202,168,83,0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stop Googling for permits.
          </h2>
          <p className="mt-4 text-lg text-[#8a8a95]">
            The leads are already out there. You just need someone watching
            the filings every day. That&apos;s what we do.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-semibold text-[#1a1a1e] shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:brightness-110"
            >
              Start 7-Day Free Trial
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#555560]">
            No credit card required &middot; Cancel anytime &middot; Set up in 5 minutes
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-gradient-to-br from-amber-400 to-amber-600 text-[7px] font-black tracking-tight text-[#1a1a1e]">
              GP
            </div>
            <span className="text-sm font-semibold text-white/80">GroundPulse</span>
            <span className="text-sm text-[#555560]">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          <nav className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-[#555560] transition-colors hover:text-white/70"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-[#555560] transition-colors hover:text-white/70"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="text-sm text-[#555560] transition-colors hover:text-white/70"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
