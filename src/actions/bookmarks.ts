"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema/bookmarks";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

/**
 * Toggles a bookmark for the current user + organization.
 * If the bookmark exists, it's deleted. If not, it's created.
 * Uses ON CONFLICT DO NOTHING for safe concurrent inserts.
 */
export async function toggleBookmark(
  leadId: string
): Promise<{ bookmarked: boolean }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  // Check if bookmark exists
  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.leadId, leadId),
        eq(bookmarks.organizationId, orgId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Delete existing bookmark
    await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.leadId, leadId),
          eq(bookmarks.organizationId, orgId)
        )
      );

    revalidatePath("/dashboard");
    return { bookmarked: false };
  }

  // Create new bookmark with conflict safety
  await db
    .insert(bookmarks)
    .values({
      leadId,
      userId,
      organizationId: orgId,
    })
    .onConflictDoNothing();

  revalidatePath("/dashboard");
  return { bookmarked: true };
}

/**
 * Gets all bookmarked lead IDs for the current user + organization.
 * Returns an array of lead ID strings.
 */
export async function getBookmarkedLeads(): Promise<string[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  const rows = await db
    .select({ leadId: bookmarks.leadId })
    .from(bookmarks)
    .where(
      and(eq(bookmarks.userId, userId), eq(bookmarks.organizationId, orgId))
    );

  return rows.map((r) => r.leadId);
}
