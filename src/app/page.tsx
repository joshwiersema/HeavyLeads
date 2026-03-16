import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, BarChart3, Mail } from "lucide-react";

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
        <span className="text-xl font-bold">HeavyLeads</span>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
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
          <Link href="/sign-up">
            <Button size="lg">Start Free Trial</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
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
        <Link href="/sign-up">
          <Button size="lg">Get Started Free</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} HeavyLeads. All rights reserved.
      </footer>
    </div>
  );
}
