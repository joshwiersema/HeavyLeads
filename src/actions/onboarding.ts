"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema/auth";
import { organizationProfiles } from "@/lib/db/schema/organization-profiles";
import { composeAddress } from "@/lib/validators/onboarding";
import { geocodeAddress } from "@/lib/geocoding";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { WizardState } from "@/lib/onboarding/types";

const VALID_INDUSTRIES = [
  "heavy_equipment",
  "hvac",
  "roofing",
  "solar",
  "electrical",
] as const;

export async function completeOnboarding(
  data: WizardState,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const orgId = session.session.activeOrganizationId;

  // Validate industry
  if (
    !data.industry ||
    !VALID_INDUSTRIES.includes(
      data.industry as (typeof VALID_INDUSTRIES)[number],
    )
  ) {
    return { success: false, error: "Please select a valid industry." };
  }

  // Compose full address for geocoding
  const fullAddress = composeAddress({
    street: data.street,
    city: data.city,
    state: data.state,
    zip: data.zip,
  });

  // Resolve coordinates: use Places-provided lat/lng or geocode the address
  let lat = data.serviceAreaLat;
  let lng = data.serviceAreaLng;
  let formattedAddress = fullAddress;

  if (lat == null || lng == null) {
    const geo = await geocodeAddress(fullAddress);
    lat = geo.lat;
    lng = geo.lng;
    formattedAddress = geo.formattedAddress;

    if (lat == null || lng == null) {
      return {
        success: false,
        error:
          "Unable to determine coordinates for your address. Please verify your address and try again.",
      };
    }
  }

  // Update organization industry
  await db
    .update(organization)
    .set({ industry: data.industry })
    .where(eq(organization.id, orgId));

  // Upsert organization profile with all wizard fields
  await db
    .insert(organizationProfiles)
    .values({
      organizationId: orgId,
      hqAddress: formattedAddress,
      hqLat: lat,
      hqLng: lng,
      serviceRadiusMiles: data.serviceRadiusMiles,
      equipmentTypes: data.specializations,
      specializations: data.specializations,
      serviceTypes: data.serviceTypes,
      certifications: data.certifications,
      targetProjectValueMin: data.minProjectValue,
      targetProjectValueMax: data.maxProjectValue,
      yearsInBusiness: data.yearsInBusiness,
      companySize: data.companySize,
      onboardingCompleted: true,
    })
    .onConflictDoUpdate({
      target: [organizationProfiles.organizationId],
      set: {
        hqAddress: formattedAddress,
        hqLat: lat,
        hqLng: lng,
        serviceRadiusMiles: data.serviceRadiusMiles,
        equipmentTypes: data.specializations,
        specializations: data.specializations,
        serviceTypes: data.serviceTypes,
        certifications: data.certifications,
        targetProjectValueMin: data.minProjectValue,
        targetProjectValueMax: data.maxProjectValue,
        yearsInBusiness: data.yearsInBusiness,
        companySize: data.companySize,
        onboardingCompleted: true,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");

  return { success: true };
}
