import { Resend } from "resend";
import { StormAlertEmail } from "@/components/emails/storm-alert";
import type { StormAlert } from "@/lib/storm-alerts/types";

/**
 * Sends a storm alert email to a single user via the Resend API.
 *
 * Gracefully handles missing RESEND_API_KEY by logging a warning and
 * returning early (no crash). Individual send failures are also caught
 * and logged -- one user's failure does not block others.
 */
export async function sendStormAlertEmail(
  to: string,
  userName: string,
  alerts: StormAlert[],
  dashboardUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY not set, skipping storm alert for ${to}`
    );
    return;
  }

  try {
    const resend = new Resend((process.env.RESEND_API_KEY ?? "").trim());

    const fromEmail = (
      process.env.RESEND_FROM_EMAIL ?? "LeadForge <onboarding@resend.dev>"
    ).trim();

    const subject = `Storm Alert: ${alerts.length} active storm${alerts.length !== 1 ? "s" : ""} in your service area`;

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      react: StormAlertEmail({ userName, alerts, dashboardUrl }),
    });

    if (error) {
      console.error(
        `[email] Failed to send storm alert to ${to}:`,
        error
      );
    } else {
      console.log(
        `[email] Storm alert sent to ${to} (${alerts.length} alerts)`
      );
    }
  } catch (err) {
    console.error(
      `[email] Error sending storm alert to ${to}:`,
      err instanceof Error ? err.message : err
    );
  }
}
