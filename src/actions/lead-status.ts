"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  leadStatuses,
  LEAD_STATUS_VALUES,
  type LeadStatus,
} from "@/lib/db/schema/lead-statuses";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const leadStatusSchema = z.enum(["new", "viewed", "contacted", "won", "lost"]);

/**
 * Upserts a lead status for the current user + organization.
 * Creates a new row on first status change, updates existing row thereafter.
 * Validates that the status is one of the 5 valid values.
 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus
): Promise<void> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  // Validate status value
  const parsed = leadStatusSchema.safeParse(status);
  if (!parsed.success) {
    throw new Error(
      `Invalid status "${status}". Must be one of: ${LEAD_STATUS_VALUES.join(", ")}`
    );
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  await db
    .insert(leadStatuses)
    .values({
      leadId,
      userId,
      organizationId: orgId,
      status: parsed.data,
    })
    .onConflictDoUpdate({
      target: [
        leadStatuses.userId,
        leadStatuses.leadId,
        leadStatuses.organizationId,
      ],
      set: { status: parsed.data, updatedAt: new Date() },
    });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${leadId}`);
}

/**
 * Gets the current lead status for the authenticated user + organization.
 * Returns "new" if no explicit status has been set.
 */
export async function getLeadStatus(leadId: string): Promise<LeadStatus> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session.activeOrganizationId) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const orgId = session.session.activeOrganizationId;

  const rows = await db
    .select({ status: leadStatuses.status })
    .from(leadStatuses)
    .where(
      and(
        eq(leadStatuses.userId, userId),
        eq(leadStatuses.leadId, leadId),
        eq(leadStatuses.organizationId, orgId)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    return "new";
  }

  return rows[0].status as LeadStatus;
}
