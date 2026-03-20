import { Section, Text, Link, Hr } from "@react-email/components";
import { EmailLayout } from "./email-layout";

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
  industry?: string;
  unsubscribeUrl?: string;
}

/** Maximum number of leads shown inline in the digest email */
const MAX_INLINE_LEADS = 10;

/**
 * React Email template for the GroundPulse daily lead digest.
 *
 * Uses EmailLayout for industry-specific theming and CAN-SPAM footer.
 * Renders a summary of new leads matching the user's saved search criteria,
 * with links to individual lead detail pages on the dashboard.
 */
export function DailyDigestEmail({
  userName,
  leads,
  dashboardUrl,
  industry,
  unsubscribeUrl,
}: DailyDigestEmailProps) {
  const displayedLeads = leads.slice(0, MAX_INLINE_LEADS);
  const extraCount = leads.length - MAX_INLINE_LEADS;

  return (
    <EmailLayout
      industry={industry}
      unsubscribeUrl={unsubscribeUrl}
      previewText={`${leads.length} new lead${leads.length !== 1 ? "s" : ""} matching your criteria`}
    >
      {/* Heading */}
      <Section style={headingSection}>
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
              View all {leads.length} leads in your dashboard.
            </Link>
          </Text>
        </Section>
      )}

      <Hr style={dividerStyle} />

      {/* CTA Button */}
      <Section style={ctaStyle}>
        <Link href={`${dashboardUrl}/dashboard`} style={buttonStyle}>
          View Dashboard
        </Link>
      </Section>
    </EmailLayout>
  );
}

// -- Inline styles (local to this template) --

const headingSection: React.CSSProperties = {
  padding: "24px 32px 0",
};

const headingStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
};

const summaryStyle: React.CSSProperties = {
  padding: "12px 32px 0",
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

const ctaStyle: React.CSSProperties = {
  padding: "0 32px 24px",
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
