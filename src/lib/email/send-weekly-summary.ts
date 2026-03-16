import { Resend } from "resend";
import {
  WeeklySummaryEmail,
  type WeeklySummaryStats,
} from "@/components/emails/weekly-summary";

/**
 * Sends a weekly summary email to a single user via the Resend API.
 *
 * Gracefully handles missing RESEND_API_KEY by logging a warning and
 * returning early (no crash). Includes List-Unsubscribe headers for
 * CAN-SPAM / RFC 8058 compliance.
 */
export async function sendWeeklySummary(
  to: string,
  userName: string,
  stats: WeeklySummaryStats,
  industry: string | undefined,
  dashboardUrl: string,
  unsubscribeUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY not set, skipping weekly summary for ${to}`
    );
    return;
  }

  try {
    const resend = new Resend((process.env.RESEND_API_KEY ?? "").trim());

    const fromEmail =
      (process.env.RESEND_FROM_EMAIL ?? "").trim() ||
      "LeadForge <notifications@resend.dev>";

    const subject = `Weekly Summary: ${stats.totalLeadsThisWeek} new leads this week`;

    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      react: WeeklySummaryEmail({
        userName,
        industry,
        unsubscribeUrl,
        stats,
        dashboardUrl,
      }),
      headers,
    });

    if (error) {
      console.error(
        `[email] Failed to send weekly summary to ${to}:`,
        error
      );
    } else {
      console.log(
        `[email] Weekly summary sent to ${to} (${stats.totalLeadsThisWeek} leads this week)`
      );
    }
  } catch (err) {
    console.error(
      `[email] Error sending weekly summary to ${to}:`,
      err instanceof Error ? err.message : err
    );
  }
}
