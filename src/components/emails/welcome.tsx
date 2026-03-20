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

interface WelcomeEmailProps {
  userName: string;
  companyName: string;
  industry: string;
  dashboardUrl: string;
}

/** Map industry IDs to human-readable labels. */
const INDUSTRY_LABELS: Record<string, string> = {
  heavy_equipment: "Heavy Equipment",
  hvac: "HVAC",
  roofing: "Roofing",
  solar: "Solar",
  electrical: "Electrical",
};

/**
 * React Email template for GroundPulse welcome email.
 *
 * Sent after a user completes the onboarding wizard.
 * Follows the same inline-style pattern as PasswordResetEmail for brand consistency.
 */
export function WelcomeEmail({
  userName,
  companyName,
  industry,
  dashboardUrl,
}: WelcomeEmailProps) {
  const industryLabel =
    INDUSTRY_LABELS[industry] ?? industry.replace(/_/g, " ");

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>GroundPulse</Text>
            <Text style={headingStyle}>Welcome to GroundPulse!</Text>
          </Section>

          {/* Content */}
          <Section style={contentStyle}>
            <Text style={textStyle}>Hi {userName},</Text>
            <Text style={textStyle}>
              Your company {companyName} is all set up for {industryLabel} lead
              generation. Here&apos;s what happens next:
            </Text>

            <Text style={stepStyle}>
              <strong>1.</strong> Start your free trial -- you&apos;ll have 7
              days to explore GroundPulse at no cost
            </Text>
            <Text style={stepStyle}>
              <strong>2.</strong> Fresh leads -- we&apos;ll start finding leads
              in your service area right away
            </Text>
            <Text style={stepStyle}>
              <strong>3.</strong> Daily updates -- check your dashboard daily for
              new matching leads
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={ctaStyle}>
            <Link href={dashboardUrl} style={buttonStyle}>
              Go to Dashboard
            </Link>
          </Section>

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={disclaimerStyle}>
            <Text style={disclaimerTextStyle}>
              If you have questions, reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// -- Inline styles (matching password-reset.tsx brand) --

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

const contentStyle: React.CSSProperties = {
  padding: "24px 32px 0",
};

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 16,
  lineHeight: 1.5,
  margin: "0 0 12px 0",
};

const stepStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 16,
  lineHeight: 1.5,
  margin: "0 0 8px 0",
  paddingLeft: 8,
};

const ctaStyle: React.CSSProperties = {
  padding: "16px 32px 24px",
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

const dividerStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 32px",
};

const disclaimerStyle: React.CSSProperties = {
  padding: "16px 32px 32px",
};

const disclaimerTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
  lineHeight: 1.5,
  margin: 0,
};
