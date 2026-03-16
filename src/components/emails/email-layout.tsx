import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components";

/** Industry-specific header colors for email branding */
const INDUSTRY_COLORS: Record<string, string> = {
  heavy_equipment: "#1e40af", // blue-800
  hvac: "#0d9488", // teal-600
  roofing: "#dc2626", // red-600
  solar: "#d97706", // amber-600
  electrical: "#4f46e5", // indigo-600
};

const DEFAULT_COLOR = "#1e40af"; // blue-800

interface EmailLayoutProps {
  children: React.ReactNode;
  industry?: string;
  unsubscribeUrl?: string;
  previewText?: string;
}

/**
 * Shared React Email layout component for all LeadForge emails.
 *
 * Provides:
 * - Industry-specific header color
 * - LeadForge branding
 * - CAN-SPAM compliant footer with unsubscribe link and physical address
 */
export function EmailLayout({
  children,
  industry,
  unsubscribeUrl,
  previewText,
}: EmailLayoutProps) {
  const headerColor = industry
    ? INDUSTRY_COLORS[industry] ?? DEFAULT_COLOR
    : DEFAULT_COLOR;

  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section
            style={{ ...headerStyle, backgroundColor: headerColor }}
          >
            <Text style={brandStyle}>LeadForge</Text>
          </Section>

          {/* Content */}
          {children}

          <Hr style={dividerStyle} />

          {/* CAN-SPAM Footer */}
          <Section style={footerStyle}>
            {unsubscribeUrl && (
              <Text style={unsubscribeTextStyle}>
                <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
                  Unsubscribe from these emails
                </Link>
              </Text>
            )}
            <Text style={footerTextStyle}>
              You are receiving this email because you signed up for
              LeadForge.
            </Text>
            <Text style={footerTextStyle}>
              LeadForge | Austin, TX
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
  borderRadius: "8px 8px 0 0",
  padding: "24px 32px",
};

const brandStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 1,
  margin: 0,
  textTransform: "uppercase" as const,
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "20px 32px",
};

const footerStyle: React.CSSProperties = {
  padding: "0 32px 32px",
  textAlign: "center" as const,
};

const unsubscribeTextStyle: React.CSSProperties = {
  margin: "0 0 8px 0",
};

const unsubscribeLinkStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  textDecoration: "underline",
};

const footerTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
  lineHeight: 1.4,
  margin: "0 0 4px 0",
};
