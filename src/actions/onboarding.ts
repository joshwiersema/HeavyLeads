"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import {
  onboardingSchema,
  composeAddress,
  type OnboardingFormData,
} from "@/lib/validators/onboarding";
import { geocodeAddress } from "@/lib/geocoding";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function completeOnboarding(data: OnboardingFormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const validated = onboardingSchema.parse(data);

  // Compose structured fields into a single address string for geocoding
  const fullAddress = composeAddress(validated);

  const { lat, lng, formattedAddress } = await geocodeAddress(fullAddress);

  if (lat == null || lng == null) {
    return {
      success: false,
      error:
        "Unable to determine coordinates for your address. Please verify your address and try again.",
    };
  }

  await db
    .insert(companyProfiles)
    .values({
      organizationId: session.session.activeOrganizationId,
      hqAddress: formattedAddress,
      hqLat: lat,
      hqLng: lng,
      equipmentTypes: validated.equipmentTypes,
      serviceRadiusMiles: validated.serviceRadius,
      onboardingCompleted: true,
    })
    .onConflictDoUpdate({
      target: [companyProfiles.organizationId],
      set: {
        hqAddress: formattedAddress,
        hqLat: lat,
        hqLng: lng,
        equipmentTypes: validated.equipmentTypes,
        serviceRadiusMiles: validated.serviceRadius,
        onboardingCompleted: true,
      },
    });

  revalidatePath("/");

  return { success: true };
}
