import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  Search,
  Zap,
  BarChart3,
  Mail,
  ArrowRight,
  Shield,
  Clock,
  Target,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Authenticated users get routed to dashboard or onboarding
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

  // Unauthenticated visitors see the landing page
  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1e]">
      {/* Nav — Framer-style minimal */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-black text-[#1a1a1e]">
            H
          </div>
          HeavyLeads
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
            Get Started
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero — Framer-inspired dark with dramatic lighting */}
      <section
        id="main-content"
        className="relative flex flex-col items-center gap-8 overflow-hidden px-6 pb-28 pt-36 text-center sm:pb-32 sm:pt-44"
      >
        {/* Dramatic ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(202,168,83,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(202,168,83,0.06),transparent_50%)]" />

        <div className="relative z-[1] flex flex-col items-center gap-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-1.5 text-xs font-medium tracking-wide text-amber-300/90">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            Construction Lead Intelligence Platform
          </span>

          <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Find the right leads.
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              Close more deals.
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-[#8a8a95] sm:text-xl">
            HeavyLeads aggregates construction permits, government bids, and
            project news into a single scored feed — so your sales team reaches
            the right jobsite first.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-semibold text-[#1a1a1e] shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:brightness-110"
            >
              Start Free Trial
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20"
            >
              Sign In
            </Link>
          </div>

          <p className="pt-1 text-xs text-[#555560]">
            7-day free trial &middot; No credit card required
          </p>
        </div>
      </section>

      {/* Stats bar — social proof */}
      <section className="border-y border-white/5 bg-[#1f1f23] px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/10">
              <TrendingUp className="size-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">5 Industries</p>
              <p className="text-xs text-[#8a8a95]">Heavy Equip, HVAC, Solar, Roofing, Electrical</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/10">
              <Shield className="size-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Multi-Source</p>
              <p className="text-xs text-[#8a8a95]">Permits, bids, news, storm alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/10">
              <Users className="size-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Team Ready</p>
              <p className="text-xs text-[#8a8a95]">Org-based access with role management</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features — clean card grid on dark background */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Features
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everything You Need to Win More Deals
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#8a8a95]">
              Our platform monitors thousands of sources daily, scores each lead
              for your specific business, and delivers actionable intelligence.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="group rounded-2xl border border-white/5 bg-[#222226] p-6 transition-all hover:border-amber-400/20 hover:bg-[#262629]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-400/10">
                <Search className="size-5 text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Daily Lead Feed</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Construction permits, bids, and project news scraped daily and
                filtered to your service area. Never miss an opportunity again.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/5 bg-[#222226] p-6 transition-all hover:border-amber-400/20 hover:bg-[#262629]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-400/10">
                <Zap className="size-5 text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Smart Scoring</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Every lead is scored across 5 dimensions — distance, relevance,
                value, freshness, and urgency — personalized to your profile.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/5 bg-[#222226] p-6 transition-all hover:border-amber-400/20 hover:bg-[#262629]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-400/10">
                <BarChart3 className="size-5 text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Industry Matching</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Leads are automatically classified by industry — heavy equipment,
                HVAC, solar, roofing, or electrical — so you see what matters.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/5 bg-[#222226] p-6 transition-all hover:border-amber-400/20 hover:bg-[#262629]">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-400/10">
                <Mail className="size-5 text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Email Digests</h3>
              <p className="text-sm leading-relaxed text-[#8a8a95]">
                Get a daily summary of new matching leads delivered straight
                to your inbox before your competitors see them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(202,168,83,0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to find your next big sale?
          </h2>
          <p className="mt-4 text-lg text-[#8a8a95]">
            Start your 7-day free trial. No credit card required.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-semibold text-[#1a1a1e] shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:brightness-110"
          >
            Get Started Free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/80">HeavyLeads</span>
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
