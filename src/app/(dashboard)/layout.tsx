import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { organization } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { getActiveSubscription, getTrialStatus } from "@/lib/billing";
import Link from "next/link";
import { TrialBanner } from "@/components/billing/trial-banner";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import type { Industry } from "@/lib/onboarding/types";

/**
 * Users created before this date are treated as pre-verified (legacy users).
 * Email verification was introduced on 2026-03-16. Existing users who signed
 * up before that date have emailVerified=false in the DB but should not be
 * blocked. This avoids the need for a data migration.
 */
export const LEGACY_USER_CUTOFF = "2026-03-17T00:00:00.000Z";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Email verification gate -- new users must verify before accessing dashboard.
  // Legacy users (created before the cutoff) are treated as pre-verified.
  // DEV_ACCESS: skip verification when dev access is enabled (no email service needed)
  const devAccess = process.env.NEXT_PUBLIC_DEV_ACCESS === "true";
  const isLegacyUser = session.user.createdAt
    ? new Date(session.user.createdAt) < new Date(LEGACY_USER_CUTOFF)
    : true; // Treat users without createdAt as legacy (pre-existing)
  if (!session.user.emailVerified && !isLegacyUser && !devAccess) {
    redirect("/verify-email");
  }

  // Check for active organization
  if (!session.session.activeOrganizationId) {
    redirect("/onboarding");
  }

  // Check onboarding completion
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  if (!profile || !profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  // Check subscription status -- must have active subscription to access dashboard
  const activeSubscription = await getActiveSubscription(
    session.session.activeOrganizationId
  );
  if (!activeSubscription) {
    redirect("/billing");
  }

  const trialStatus = getTrialStatus(activeSubscription);

  // Query org industry for sidebar badge
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, session.session.activeOrganizationId!),
    columns: { industry: true },
  });
  const orgIndustry = (org?.industry ?? "heavy_equipment") as Industry;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — Asana-inspired dark charcoal */}
      <aside className="hidden w-64 shrink-0 bg-[#1a1a1e] md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center gap-2.5 px-5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-black tracking-tight text-[#1a1a1e]">
              GP
            </div>
            <Link href="/dashboard" className="text-base font-semibold tracking-tight text-white">
              GroundPulse
            </Link>
          </div>
          <div className="mx-4 h-px bg-white/8" />
          <SidebarNav industry={orgIndustry} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:hidden">
            <MobileNav userName={session.user.name} industry={orgIndustry} />
            <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600 text-[9px] font-black tracking-tight text-[#1a1a1e]">
                GP
              </div>
              GroundPulse
            </Link>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 text-xs font-semibold text-amber-600">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <span className="hidden text-sm font-medium sm:inline">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
        </header>

        {/* Trial countdown banner */}
        {trialStatus.isTrialing && (
          <TrialBanner daysRemaining={trialStatus.daysRemaining} />
        )}

        {/* Page content */}
        <main id="main-content" className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
