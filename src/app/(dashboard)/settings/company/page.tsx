import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { organization } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { CompanyForm } from "@/components/settings/company-form";
import type { Industry } from "@/lib/onboarding/types";

/**
 * Try to parse a Google-formatted address into structured fields.
 * Example: "123 Main St, Dallas, TX 75201, USA" → { street, city, state, zip }
 * Falls back to putting the whole address in the street field if parsing fails.
 */
function parseAddress(address: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const parts = address.split(",").map((p) => p.trim());

  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    // "TX 75201" or "TX 75201, USA"
    const stateZip = parts[2].split(" ").filter(Boolean);
    const state = stateZip[0] || "";
    const zip = stateZip[1] || "";
    return { street, city, state, zip };
  }

  return { street: address, city: "", state: "", zip: "" };
}

export default async function CompanySettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    redirect("/sign-in");
  }

  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  const member = await auth.api.getActiveMember({
    headers: await headers(),
  });

  const isAdmin = member?.role === "owner" || member?.role === "admin";

  // Fetch org industry
  const orgId = session.session.activeOrganizationId;
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
    columns: { industry: true },
  });
  const industry = (org?.industry ?? "heavy_equipment") as Industry;

  // Parse existing address into structured fields for the form
  const parsed = parseAddress(profile?.hqAddress ?? "");

  return (
    <CompanyForm
      initialData={{
        street: parsed.street,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        equipmentTypes: profile?.equipmentTypes ?? [],
        serviceRadius: profile?.serviceRadiusMiles ?? 50,
        targetProjectValueMin: profile?.targetProjectValueMin ?? null,
        targetProjectValueMax: profile?.targetProjectValueMax ?? null,
      }}
      isAdmin={isAdmin}
      industry={industry}
    />
  );
}
