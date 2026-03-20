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

interface VerifyEmailProps {
  userName: string;
  verificationUrl: string;
}

/**
 * React Email template for HeavyLeads email verification.
 *
 * Sent after a new user signs up. Follows the same inline-style pattern
 * as WelcomeEmail and PasswordResetEmail for brand consistency.
 */
export function VerifyEmail({ userName, verificationUrl }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>HeavyLeads</Text>
            <Text style={headingStyle}>Verify Your Email</Text>
          </Section>

          {/* Content */}
          <Section style={contentStyle}>
            <Text style={textStyle}>Hi {userName},</Text>
            <Text style={textStyle}>
              Please verify your email address to access your dashboard. Click
              the button below to confirm your account.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={ctaStyle}>
            <Link href={verificationUrl} style={buttonStyle}>
              Verify Email
            </Link>
          </Section>

          <Hr style={dividerStyle} />

          {/* Disclaimer */}
          <Section style={disclaimerStyle}>
            <Text style={disclaimerTextStyle}>
              If you didn&apos;t create this account, you can safely ignore this
              email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// -- Inline styles (matching welcome.tsx brand) --

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
