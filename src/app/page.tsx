import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  Zap,
  BarChart3,
  Mail,
  ArrowRight,
  Shield,
  Clock,
  Target,
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
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="text-xl font-bold text-white">
          HeavyLeads
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-white/90 transition-colors hover:text-white hover:bg-white/10"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition-all hover:bg-white/90"
          >
            Get Started
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero — dark gradient like GitHub/Monday/Framer */}
      <section
        id="main-content"
        className="relative flex flex-col items-center gap-6 overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-6 pb-24 pt-32 text-center sm:pb-28 sm:pt-40"
      >
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_70%)]" />

        <div className="relative z-[1] flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <Target className="size-3" />
            Built for Heavy Equipment Dealers
          </span>

          <h1 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Find Construction Leads
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Before Your Competitors
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            HeavyLeads aggregates construction permits, government bids, and
            project news into a single scored feed — so your sales team reaches
            the right jobsite first.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40"
            >
              Start Free Trial
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/25"
            >
              Sign In
            </Link>
          </div>

          <p className="pt-1 text-xs text-slate-500">
            7-day free trial &middot; No credit card required
          </p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b bg-white px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="size-4 text-primary" />
            256-bit SSL encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            Daily lead updates
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-4 text-primary" />
            Multi-source intelligence
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-4 text-primary" />
            Email digest alerts
          </span>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
              Features
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Win More Deals
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Our platform monitors thousands of sources daily, scores each lead
              for your specific business, and delivers actionable intelligence
              straight to your team.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Daily Lead Feed</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Construction permits, bids, and project news scraped daily and
                filtered to your service area. Never miss an opportunity again.
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Multi-Source Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                We cross-reference permits, government postings, and industry
                news so you have the complete picture on every project.
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Equipment Matching</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Each lead is scored based on the equipment you sell and how
                close the jobsite is to your dealership — prioritized for you.
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Email Digests</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Get a daily summary of new matching leads delivered straight
                to your inbox before your competitors see them.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-20 text-center">
        <div className="relative mx-auto max-w-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_70%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to find your next big sale?
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Start your 7-day free trial. No credit card required.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40"
            >
              Get Started Free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">HeavyLeads</span>
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          <nav className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
