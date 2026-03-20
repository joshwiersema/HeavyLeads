import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/onboarding/wizard-shell";

export const metadata = {
  title: "Onboarding | HeavyLeads",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // If no active organization, redirect to sign-in
  // (sign-up flow should set active org automatically)
  if (!session.session.activeOrganizationId) {
    redirect("/sign-in");
  }

  // Check if onboarding is already completed -- prevent re-entry
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  if (profile?.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Monday-inspired branded header */}
      <header className="flex items-center gap-2.5 px-6 py-5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-black text-[#1a1a1e]">
          H
        </div>
        <span className="text-base font-semibold tracking-tight">HeavyLeads</span>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <OnboardingWizard />
        </div>
      </div>
    </div>
  );
}
