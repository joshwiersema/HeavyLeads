import { Resend } from "resend";
import {
  DailyDigestEmail,
  type DigestLead,
} from "@/components/emails/daily-digest";

/**
 * Sends a daily digest email to a single user via the Resend API.
 *
 * Gracefully handles missing RESEND_API_KEY by logging a warning and
 * returning early (no crash). Individual send failures are also caught
 * and logged -- one user's failure does not block others.
 *
 * Includes List-Unsubscribe and List-Unsubscribe-Post headers for
 * CAN-SPAM / RFC 8058 compliance when unsubscribeUrl is provided.
 */
export async function sendDigest(
  to: string,
  userName: string,
  leads: DigestLead[],
  dashboardUrl: string,
  industry?: string,
  unsubscribeUrl?: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY not set, skipping digest for ${to}`
    );
    return;
  }

  try {
    const resend = new Resend((process.env.RESEND_API_KEY ?? "").trim());

    const fromEmail =
      (process.env.RESEND_FROM_EMAIL ?? "").trim() ||
      "HeavyLeads <notifications@resend.dev>";

    const subject = `${leads.length} new lead${leads.length !== 1 ? "s" : ""} matching your criteria`;

    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      react: DailyDigestEmail({
        userName,
        leads,
        dashboardUrl,
        industry,
        unsubscribeUrl,
      }),
      headers,
    });

    if (error) {
      console.error(`[email] Failed to send digest to ${to}:`, error);
    } else {
      console.log(`[email] Digest sent to ${to} (${leads.length} leads)`);
    }
  } catch (err) {
    console.error(
      `[email] Error sending digest to ${to}:`,
      err instanceof Error ? err.message : err
    );
  }
}

export type { DigestLead };
