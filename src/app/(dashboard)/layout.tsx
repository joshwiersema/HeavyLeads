import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Separator } from "@/components/ui/separator";

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
          <nav className="flex-1 space-y-1 p-4">
            <Link
              href="/dashboard"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Settings
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="md:hidden">
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

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
