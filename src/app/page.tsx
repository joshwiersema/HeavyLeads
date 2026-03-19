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
import { Badge } from "@/components/ui/badge";
import { Search, Zap, BarChart3, Mail } from "lucide-react";

/** Button-like link styles (avoids nesting <a><button>) */
const linkBtn =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80";
const linkBtnOutline =
  "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground";
const linkBtnGhost =
  "inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground";

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
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-xl font-bold">HeavyLeads</Link>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className={linkBtnGhost}>
            Sign In
          </Link>
          <Link href="/sign-up" className={linkBtn}>
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="main-content" className="flex flex-col items-center gap-6 px-6 py-20 text-center">
        <Badge variant="secondary" className="text-sm">
          Built for Heavy Equipment Dealers
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Find Construction Leads Before Your Competitors
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          HeavyLeads aggregates construction permits, government bids, and
          project news into a single scored feed — so your sales team reaches
          the right jobsite first.
        </p>
        <div className="flex gap-3">
          <Link href="/sign-up" className={linkBtn}>
            Start Free Trial
          </Link>
          <Link href="/sign-in" className={linkBtnOutline}>
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold">
            Everything You Need to Win More Deals
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <Search className="mb-2 size-8 text-primary" />
                <CardTitle>Daily Lead Feed</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Construction permits, bids, and project news scraped daily and
                filtered to your service area.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="mb-2 size-8 text-primary" />
                <CardTitle>Multi-Source Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                We cross-reference permits, government postings, and industry
                news so you never miss an opportunity.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 size-8 text-primary" />
                <CardTitle>Equipment Matching</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Each lead is scored based on the equipment you sell and how
                close the jobsite is to your dealership.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Mail className="mb-2 size-8 text-primary" />
                <CardTitle>Email Digests</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Get a daily summary of new matching leads delivered straight
                to your inbox before your competitors see them.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold">
          Ready to find your next big sale?
        </h2>
        <p className="text-muted-foreground">
          Start your 7-day free trial. No credit card required.
        </p>
        <Link href="/sign-up" className={linkBtn}>
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} HeavyLeads. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
