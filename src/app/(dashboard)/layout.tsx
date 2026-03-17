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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-muted/40 md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center px-4">
            <Link href="/dashboard" className="text-lg font-semibold">
              HeavyLeads
            </Link>
          </div>
          <Separator />
          <SidebarNav industry={orgIndustry} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2 md:hidden">
            <MobileNav userName={session.user.name} industry={orgIndustry} />
            <Link href="/dashboard" className="text-lg font-semibold">
              HeavyLeads
            </Link>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-sm text-muted-foreground">
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
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
