import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Check if user has an active org with completed onboarding
  if (session.session.activeOrganizationId) {
    const profile = await db.query.companyProfiles.findFirst({
      where: eq(companyProfiles.organizationId, session.session.activeOrganizationId),
    });

    if (profile?.onboardingCompleted) {
      redirect("/dashboard");
    }
  }

  // No org or onboarding not complete
  redirect("/onboarding");
}
