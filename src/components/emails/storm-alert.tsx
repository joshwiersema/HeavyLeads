import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import type { StormAlert } from "@/lib/storm-alerts/types";

interface StormAlertEmailProps {
  userName: string;
  alerts: StormAlert[];
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

/** Maximum number of alerts shown inline in the email */
const MAX_INLINE_ALERTS = 5;

/**
 * React Email template for HeavyLeads storm alert notifications.
 *
 * Renders an amber/orange-themed email with storm alert details,
 * severity badges, and a CTA to view storm leads on the dashboard.
 */
export function StormAlertEmail({
  userName,
  alerts,
  dashboardUrl,
  unsubscribeUrl,
}: StormAlertEmailProps) {
  const displayedAlerts = alerts.slice(0, MAX_INLINE_ALERTS);
  const extraCount = alerts.length - MAX_INLINE_ALERTS;

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>HeavyLeads</Text>
            <Text style={headingStyle}>Storm Alert</Text>
          </Section>

          {/* Summary */}
          <Section style={summaryStyle}>
            <Text style={summaryTextStyle}>
              Hi {userName},{" "}
              <strong>
                {alerts.length} active storm alert{alerts.length !== 1 ? "s" : ""}
              </strong>{" "}
              detected in your service area.
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Alert cards */}
          {displayedAlerts.map((alert) => (
            <Section key={alert.id} style={alertCardStyle}>
              <Text style={alertTitleStyle}>{alert.title}</Text>
              <Text style={alertMetaStyle}>
                <span style={getSeverityBadgeStyle(alert.severity)}>
                  {alert.severity ?? "Unknown"}
                </span>
                {alert.city && alert.state && (
                  <span style={locationTagStyle}>
                    {alert.city}, {alert.state}
                  </span>
                )}
              </Text>
              {alert.expiresAt && (
                <Text style={expiresStyle}>
                  Expires: {formatExpiry(alert.expiresAt)}
                </Text>
              )}
            </Section>
          ))}

          {/* Overflow notice */}
          {extraCount > 0 && (
            <Section style={overflowStyle}>
              <Text style={overflowTextStyle}>
                ...and {extraCount} more.{" "}
                <Link
                  href={`${dashboardUrl}/dashboard?sourceTypes=storm`}
                  style={linkStyle}
                >
                  View all in your dashboard.
                </Link>
              </Text>
            </Section>
          )}

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Link
              href={`${dashboardUrl}/dashboard?sourceTypes=storm`}
              style={buttonStyle}
            >
              View Storm Leads
            </Link>
            <Text style={unsubscribeStyle}>
              You are receiving this because you have a roofing profile on
              HeavyLeads.{" "}
              {unsubscribeUrl ? (
                <Link href={unsubscribeUrl} style={linkStyle}>
                  Unsubscribe from storm alerts
                </Link>
              ) : (
                <Link href={`${dashboardUrl}/settings`} style={linkStyle}>
                  Manage notification preferences
                </Link>
              )}
            </Text>
            <Text style={canSpamStyle}>
              HeavyLeads | United States
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function formatExpiry(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getSeverityBadgeStyle(
  severity: string | null
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 4,
    display: "inline-block",
    fontSize: 12,
    fontWeight: 600,
    marginRight: 8,
    padding: "2px 8px",
  };

  switch (severity) {
    case "Extreme":
      return { ...base, backgroundColor: "#fecaca", color: "#991b1b" };
    case "Severe":
      return { ...base, backgroundColor: "#fed7aa", color: "#9a3412" };
    case "Moderate":
      return { ...base, backgroundColor: "#fef08a", color: "#854d0e" };
    default:
      return { ...base, backgroundColor: "#e5e7eb", color: "#374151" };
  }
}

// -- Inline styles --

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  margin: "40px auto",
  maxWidth: 600,
  padding: 0,
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#d97706",
  borderRadius: "8px 8px 0 0",
  padding: "24px 32px",
};

const brandStyle: React.CSSProperties = {
  color: "#fef3c7",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: 1,
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
};

const headingStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
};

const summaryStyle: React.CSSProperties = {
  padding: "24px 32px 0",
};

const summaryTextStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 16,
  lineHeight: 1.5,
  margin: 0,
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "20px 32px",
};

const alertCardStyle: React.CSSProperties = {
  borderBottom: "1px solid #fef3c7",
  padding: "16px 32px",
};

const alertTitleStyle: React.CSSProperties = {
  color: "#92400e",
  fontSize: 16,
  fontWeight: 600,
  margin: "0 0 4px 0",
};

const alertMetaStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  margin: "4px 0 0 0",
};

const locationTagStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginRight: 8,
};

const expiresStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  margin: "4px 0 0 0",
};

const overflowStyle: React.CSSProperties = {
  padding: "8px 32px 16px",
};

const overflowTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  fontStyle: "italic",
  margin: 0,
};

const linkStyle: React.CSSProperties = {
  color: "#d97706",
  textDecoration: "underline",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 32px 32px",
  textAlign: "center" as const,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#d97706",
  borderRadius: 6,
  color: "#ffffff",
  display: "inline-block",
  fontSize: 16,
  fontWeight: 600,
  padding: "12px 32px",
  textDecoration: "none",
};

const unsubscribeStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 16,
};

const canSpamStyle: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: 11,
  marginTop: 8,
};
