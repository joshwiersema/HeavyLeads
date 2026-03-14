"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import { onboardingSchema, type OnboardingFormData } from "@/lib/validators/onboarding";
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

  const { lat, lng, formattedAddress } = await geocodeAddress(
    validated.hqAddress
  );

  await db.insert(companyProfiles).values({
    organizationId: session.session.activeOrganizationId,
    hqAddress: formattedAddress,
    hqLat: lat,
    hqLng: lng,
    equipmentTypes: validated.equipmentTypes,
    serviceRadiusMiles: validated.serviceRadius,
    onboardingCompleted: true,
  });

  revalidatePath("/");

  return { success: true };
}
