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

/** A lead summary for inclusion in the daily digest email */
export interface DigestLead {
  id: string;
  title: string;
  address: string;
  score: number;
  projectType: string | null;
  distance: number | null;
}

interface DailyDigestEmailProps {
  userName: string;
  leads: DigestLead[];
  dashboardUrl: string;
}

/** Maximum number of leads shown inline in the digest email */
const MAX_INLINE_LEADS = 10;

/**
 * React Email template for the HeavyLeads daily lead digest.
 *
 * Renders a summary of new leads matching the user's saved search criteria,
 * with links to individual lead detail pages on the dashboard.
 */
export function DailyDigestEmail({
  userName,
  leads,
  dashboardUrl,
}: DailyDigestEmailProps) {
  const displayedLeads = leads.slice(0, MAX_INLINE_LEADS);
  const extraCount = leads.length - MAX_INLINE_LEADS;

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>HeavyLeads</Text>
            <Text style={headingStyle}>Your Daily Lead Digest</Text>
          </Section>

          {/* Summary */}
          <Section style={summaryStyle}>
            <Text style={summaryTextStyle}>
              Hi {userName}, you have{" "}
              <strong>
                {leads.length} new lead(s)
              </strong>{" "}
              matching your criteria.
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Lead cards */}
          {displayedLeads.map((lead) => (
            <Section key={lead.id} style={leadCardStyle}>
              <Link
                href={`${dashboardUrl}/dashboard/leads/${lead.id}`}
                style={leadTitleStyle}
              >
                {lead.title}
              </Link>
              <Text style={leadDetailStyle}>{lead.address}</Text>
              <Text style={leadMetaStyle}>
                <span style={scoreBadgeStyle}>Score: {lead.score}</span>
                {lead.projectType && (
                  <span style={metaTagStyle}>{lead.projectType}</span>
                )}
                {lead.distance != null && (
                  <span style={metaTagStyle}>
                    {lead.distance.toFixed(1)} mi away
                  </span>
                )}
              </Text>
            </Section>
          ))}

          {/* Overflow notice */}
          {extraCount > 0 && (
            <Section style={overflowStyle}>
              <Text style={overflowTextStyle}>
                ...and {extraCount} more.{" "}
                <Link href={`${dashboardUrl}/dashboard`} style={linkStyle}>
                  View all in your dashboard.
                </Link>
              </Text>
            </Section>
          )}

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Link href={`${dashboardUrl}/dashboard`} style={buttonStyle}>
              View Dashboard
            </Link>
            <Text style={unsubscribeStyle}>
              To stop receiving these digests, disable digest notifications on
              your saved searches in the{" "}
              <Link
                href={`${dashboardUrl}/dashboard/saved-searches`}
                style={linkStyle}
              >
                dashboard settings
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
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
  backgroundColor: "#1e40af",
  borderRadius: "8px 8px 0 0",
  padding: "24px 32px",
};

const brandStyle: React.CSSProperties = {
  color: "#93c5fd",
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

const leadCardStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: "16px 32px",
};

const leadTitleStyle: React.CSSProperties = {
  color: "#1e40af",
  fontSize: 16,
  fontWeight: 600,
  textDecoration: "none",
};

const leadDetailStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  margin: "4px 0",
};

const leadMetaStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  margin: "4px 0 0 0",
};

const scoreBadgeStyle: React.CSSProperties = {
  backgroundColor: "#dbeafe",
  borderRadius: 4,
  color: "#1e40af",
  display: "inline-block",
  fontSize: 12,
  fontWeight: 600,
  marginRight: 8,
  padding: "2px 8px",
};

const metaTagStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginRight: 8,
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
  color: "#1e40af",
  textDecoration: "underline",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 32px 32px",
  textAlign: "center" as const,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#1e40af",
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
