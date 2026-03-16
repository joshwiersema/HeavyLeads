"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema/bookmarks";
import { leads } from "@/lib/db/schema/leads";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";

// ---- Types ----

export const PIPELINE_STATUSES = [
  "saved",
  "contacted",
  "in_progress",
  "won",
  "lost",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface BookmarkWithLead {
  id: string;
  leadId: string;
  userId: string;
  organizationId: string;
  createdAt: Date;
  notes: string | null;
  pipelineStatus: string | null;
  // Lead fields
  title: string | null;
  address: string | null;
  formattedAddress: string | null;
  sourceType: string;
  estimatedValue: number | null;
  city: string | null;
  state: string | null;
}

// ---- Helpers ----

async function getSessionOrThrow() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  return {
    userId: session.user.id,
    orgId: session.session.activeOrganizationId,
  };
}

async function verifyBookmarkOwnership(bookmarkId: string, userId: string, orgId: string) {
  const rows = await db
    .select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      organizationId: bookmarks.organizationId,
    })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.id, bookmarkId),
        eq(bookmarks.userId, userId),
        eq(bookmarks.organizationId, orgId)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Bookmark not found");
  }

  return rows[0];
}

// ---- Actions ----

/**
 * Toggles a bookmark for the current user + organization.
 * If the bookmark exists, it's deleted. If not, it's created.
 * Uses ON CONFLICT DO NOTHING for safe concurrent inserts.
 */
export async function toggleBookmark(
  leadId: string
): Promise<{ bookmarked: boolean }> {
  const { userId, orgId } = await getSessionOrThrow();

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
  const { userId, orgId } = await getSessionOrThrow();

  const rows = await db
    .select({ leadId: bookmarks.leadId })
    .from(bookmarks)
    .where(
      and(eq(bookmarks.userId, userId), eq(bookmarks.organizationId, orgId))
    );

  return rows.map((r) => r.leadId);
}

/**
 * Updates the notes field for a given bookmark.
 * Validates session and verifies bookmark belongs to user+org.
 */
export async function updateBookmarkNotes(
  bookmarkId: string,
  notes: string
): Promise<void> {
  const { userId, orgId } = await getSessionOrThrow();
  await verifyBookmarkOwnership(bookmarkId, userId, orgId);

  await db
    .update(bookmarks)
    .set({ notes })
    .where(eq(bookmarks.id, bookmarkId));

  revalidatePath("/dashboard/bookmarks");
}

/**
 * Updates the pipeline status for a given bookmark.
 * Validates session, validates status value, verifies bookmark belongs to user+org.
 */
export async function updateBookmarkStatus(
  bookmarkId: string,
  status: PipelineStatus
): Promise<void> {
  if (!PIPELINE_STATUSES.includes(status)) {
    throw new Error(
      `Invalid pipeline status: "${status}". Must be one of: ${PIPELINE_STATUSES.join(", ")}`
    );
  }

  const { userId, orgId } = await getSessionOrThrow();
  await verifyBookmarkOwnership(bookmarkId, userId, orgId);

  await db
    .update(bookmarks)
    .set({ pipelineStatus: status })
    .where(eq(bookmarks.id, bookmarkId));

  revalidatePath("/dashboard/bookmarks");
}

/**
 * Returns bookmarks joined with lead data, including notes and pipelineStatus.
 * When statusFilter is provided, adds WHERE clause for pipelineStatus.
 * Ordered by createdAt DESC.
 */
export async function getBookmarksWithDetails(
  statusFilter?: PipelineStatus
): Promise<BookmarkWithLead[]> {
  const { userId, orgId } = await getSessionOrThrow();

  const conditions = [
    eq(bookmarks.userId, userId),
    eq(bookmarks.organizationId, orgId),
  ];

  if (statusFilter) {
    conditions.push(eq(bookmarks.pipelineStatus, statusFilter));
  }

  const rows = await db
    .select({
      id: bookmarks.id,
      leadId: bookmarks.leadId,
      userId: bookmarks.userId,
      organizationId: bookmarks.organizationId,
      createdAt: bookmarks.createdAt,
      notes: bookmarks.notes,
      pipelineStatus: bookmarks.pipelineStatus,
      title: leads.title,
      address: leads.address,
      formattedAddress: leads.formattedAddress,
      sourceType: leads.sourceType,
      estimatedValue: leads.estimatedValue,
      city: leads.city,
      state: leads.state,
    })
    .from(bookmarks)
    .innerJoin(leads, eq(bookmarks.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt));

  return rows;
}
