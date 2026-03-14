import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { eq } from "drizzle-orm";
import { CompanyForm } from "@/components/settings/company-form";

export default async function CompanySettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    redirect("/sign-in");
  }

  // Get company profile
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  // Get member role to determine admin status
  const member = await auth.api.getActiveMember({
    headers: await headers(),
  });

  const isAdmin = member?.role === "owner" || member?.role === "admin";

  return (
    <CompanyForm
      initialData={{
        hqAddress: profile?.hqAddress ?? "",
        equipmentTypes: profile?.equipmentTypes ?? [],
        serviceRadius: profile?.serviceRadiusMiles ?? 50,
      }}
      isAdmin={isAdmin}
    />
  );
}
