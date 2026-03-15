import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveSubscription } from "@/lib/billing";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function BillingLayout({
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

  if (!session.session.activeOrganizationId) {
    redirect("/onboarding");
  }

  // NOTE: No subscription check here -- users must be able to reach
  // the billing page to subscribe.  This is the key difference from
  // the (dashboard) layout which redirects non-subscribers to /billing.

  const hasSubscription = await getActiveSubscription(
    session.session.activeOrganizationId
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          {hasSubscription ? (
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Back to Dashboard
            </Link>
          ) : (
            <span className="text-sm font-medium">HeavyLeads</span>
          )}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
