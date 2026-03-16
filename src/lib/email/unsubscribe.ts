import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema/notification-preferences";

type EmailType = "daily_digest" | "weekly_summary";

/**
 * Returns the HMAC secret used for unsubscribe tokens.
 * Falls back through UNSUBSCRIBE_SECRET -> CRON_SECRET -> hardcoded fallback.
 */
function getSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.CRON_SECRET ??
    "fallback-secret"
  ).trim();
}

/**
 * Generates an HMAC-signed unsubscribe token encoding userId and emailType.
 * Token does NOT expire (CAN-SPAM requires permanent unsubscribe).
 *
 * Format: base64url-encoded JSON { userId, emailType, sig }
 */
export function generateUnsubscribeToken(
  userId: string,
  emailType: EmailType
): string {
  const secret = getSecret();
  const sig = createHmac("sha256", secret)
    .update(`${userId}:${emailType}`)
    .digest("hex");

  const payload = JSON.stringify({ userId, emailType, sig });
  return Buffer.from(payload).toString("base64url");
}

/**
 * Validates an unsubscribe token by verifying its HMAC signature.
 * Returns the decoded { userId, emailType } or null if tampered/invalid.
 */
export function validateUnsubscribeToken(
  token: string
): { userId: string; emailType: string } | null {
  try {
    if (!token) return null;

    const payload = JSON.parse(
      Buffer.from(token, "base64url").toString("utf-8")
    );

    if (
      !payload ||
      typeof payload.userId !== "string" ||
      typeof payload.emailType !== "string" ||
      typeof payload.sig !== "string"
    ) {
      return null;
    }

    const secret = getSecret();
    const expectedSig = createHmac("sha256", secret)
      .update(`${payload.userId}:${payload.emailType}`)
      .digest("hex");

    // Constant-time comparison to avoid timing attacks
    if (payload.sig.length !== expectedSig.length) return null;

    const a = Buffer.from(payload.sig);
    const b = Buffer.from(expectedSig);
    if (!a.equals(b)) return null;

    return { userId: payload.userId, emailType: payload.emailType };
  } catch {
    return null;
  }
}

/**
 * Unsubscribes a user from a specific email type by upserting
 * the notification_preferences row.
 *
 * Uses ON CONFLICT (userId) DO UPDATE to handle both new and existing rows.
 */
export async function unsubscribeUser(
  userId: string,
  emailType: string
): Promise<void> {
  const updateFields: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const insertValues: Record<string, unknown> = {
    userId,
    dailyDigest: true,
    weeklySummary: true,
  };

  // Set the specific email type to false
  if (emailType === "daily_digest") {
    updateFields.dailyDigest = false;
    insertValues.dailyDigest = false;
  } else if (emailType === "weekly_summary") {
    updateFields.weeklySummary = false;
    insertValues.weeklySummary = false;
  }

  await db
    .insert(notificationPreferences)
    .values(insertValues as typeof notificationPreferences.$inferInsert)
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: updateFields,
    });
}

/**
 * Checks if a user is subscribed to a specific email type.
 * Returns true if no preferences row exists (default subscribed per CAN-SPAM opt-out model).
 */
export async function isSubscribed(
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!prefs) return true; // No row = default subscribed

  if (emailType === "daily_digest") return prefs.dailyDigest;
  if (emailType === "weekly_summary") return prefs.weeklySummary;

  return true;
}
