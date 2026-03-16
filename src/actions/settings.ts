"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema/company-profiles";
import {
  accountSettingsSchema,
  type AccountSettingsInput,
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/lib/validators/settings";
import { composeAddress } from "@/lib/validators/onboarding";
import { geocodeAddress } from "@/lib/geocoding";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function updateAccount(data: AccountSettingsInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated = accountSettingsSchema.parse(data);

  await auth.api.updateUser({
    body: { name: validated.name },
    headers: await headers(),
  });

  revalidatePath("/settings/account");

  return { success: true };
}

export async function updateCompanyProfile(data: CompanySettingsInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const member = await auth.api.getActiveMember({
    headers: await headers(),
  });

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new Error("Only admins can update company profile");
  }

  const validated = companySettingsSchema.parse(data);

  // Compose structured fields into address string
  const fullAddress = composeAddress(validated);

  // Get current profile to check if address changed
  const currentProfile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  let hqLat = currentProfile?.hqLat ?? 0;
  let hqLng = currentProfile?.hqLng ?? 0;
  let hqAddress = fullAddress;

  // Re-geocode if address changed
  if (currentProfile?.hqAddress !== fullAddress) {
    const geocoded = await geocodeAddress(fullAddress);
    if (geocoded.lat == null || geocoded.lng == null) {
      return {
        success: false,
        error:
          "Unable to determine coordinates for your address. Please verify and try again.",
      };
    }
    hqLat = geocoded.lat;
    hqLng = geocoded.lng;
    hqAddress = geocoded.formattedAddress;
  }

  await db
    .update(companyProfiles)
    .set({
      hqAddress,
      hqLat,
      hqLng,
      equipmentTypes: validated.equipmentTypes,
      serviceRadiusMiles: validated.serviceRadius,
      updatedAt: new Date(),
    })
    .where(
      eq(
        companyProfiles.organizationId,
        session.session.activeOrganizationId
      )
    );

  revalidatePath("/settings/company");

  return { success: true };
}

export async function getCompanyProfile() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    return null;
  }

  const profile = await db.query.companyProfiles.findFirst({
    where: eq(
      companyProfiles.organizationId,
      session.session.activeOrganizationId
    ),
  });

  return profile ?? null;
}
