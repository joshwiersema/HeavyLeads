"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import type { InferSelectModel } from "drizzle-orm";

/** Input type for creating a saved search */
export interface SavedSearchInput {
  name: string;
  equipmentFilter?: string[];
  radiusMiles?: number;
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minProjectSize?: number;
  maxProjectSize?: number;
  isDigestEnabled?: boolean;
}

/** Row type from the saved_searches table */
export type SavedSearchRow = InferSelectModel<typeof savedSearches>;

const savedSearchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  equipmentFilter: z.array(z.string()).optional(),
  radiusMiles: z.number().positive().optional(),
  keyword: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  minProjectSize: z.number().int().nonnegative().optional(),
  maxProjectSize: z.number().int().nonnegative().optional(),
  isDigestEnabled: z.boolean().optional(),
});

/**
 * Creates a new saved search for the current user + organization.
 * Validates input with Zod schema (name required, all filters optional).
 */
export async function createSavedSearch(
  data: SavedSearchInput
): Promise<{ id: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const validated = savedSearchSchema.parse(data);
  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  const [result] = await db
    .insert(savedSearches)
    .values({
      userId,
      organizationId: orgId,
      name: validated.name,
      equipmentFilter: validated.equipmentFilter ?? null,
      radiusMiles: validated.radiusMiles ?? null,
      keyword: validated.keyword ?? null,
      dateFrom: validated.dateFrom ?? null,
      dateTo: validated.dateTo ?? null,
      minProjectSize: validated.minProjectSize ?? null,
      maxProjectSize: validated.maxProjectSize ?? null,
      isDigestEnabled: validated.isDigestEnabled ?? false,
    })
    .returning({ id: savedSearches.id });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/saved-searches");

  return { id: result.id };
}

/**
 * Deletes a saved search by ID. Security: only the owning user+org can delete.
 */
export async function deleteSavedSearch(
  id: string
): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  await db
    .delete(savedSearches)
    .where(
      and(
        eq(savedSearches.id, id),
        eq(savedSearches.userId, userId),
        eq(savedSearches.organizationId, orgId)
      )
    );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/saved-searches");

  return { success: true };
}

/**
 * Gets all saved searches for the current user + organization,
 * ordered by creation date descending.
 */
export async function getSavedSearches(): Promise<SavedSearchRow[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  const rows = await db
    .select()
    .from(savedSearches)
    .where(
      and(
        eq(savedSearches.userId, userId),
        eq(savedSearches.organizationId, orgId)
      )
    )
    .orderBy(desc(savedSearches.createdAt));

  return rows;
}

/**
 * Gets a single saved search by ID for the current user + organization.
 */
export async function getSavedSearchById(
  id: string
): Promise<SavedSearchRow | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  const rows = await db
    .select()
    .from(savedSearches)
    .where(
      and(
        eq(savedSearches.id, id),
        eq(savedSearches.userId, userId),
        eq(savedSearches.organizationId, orgId)
      )
    )
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

// Note: savedSearchToParams pure function has been moved to
// src/lib/leads/saved-search-utils.ts for client component import compatibility.
// "use server" files cannot export non-async functions.
