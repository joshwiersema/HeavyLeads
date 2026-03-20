import { Section, Text, Link, Hr } from "@react-email/components";
import { EmailLayout } from "./email-layout";

export interface WeeklySummaryStats {
  totalLeadsThisWeek: number;
  totalLeadsLastWeek: number;
  topSourceTypes: { type: string; count: number }[];
  topCities: { city: string; count: number }[];
  bookmarkCount: number;
  newLeadsByDay: { day: string; count: number }[];
}

interface WeeklySummaryEmailProps {
  userName: string;
  industry?: string;
  unsubscribeUrl?: string;
  stats: WeeklySummaryStats;
  dashboardUrl: string;
}

/**
 * React Email template for the GroundPulse weekly summary.
 *
 * Uses EmailLayout for industry-specific theming and CAN-SPAM footer.
 * Shows lead volume trends, top source types, top cities, and bookmarks.
 */
export function WeeklySummaryEmail({
  userName,
  industry,
  unsubscribeUrl,
  stats,
  dashboardUrl,
}: WeeklySummaryEmailProps) {
  const {
    totalLeadsThisWeek,
    totalLeadsLastWeek,
    topSourceTypes,
    topCities,
    bookmarkCount,
    newLeadsByDay,
  } = stats;

  // Calculate trend
  const trendPercent =
    totalLeadsLastWeek > 0
      ? Math.round(
          ((totalLeadsThisWeek - totalLeadsLastWeek) / totalLeadsLastWeek) *
            100
        )
      : totalLeadsThisWeek > 0
        ? 100
        : 0;

  const trendUp = trendPercent >= 0;
  const trendArrow = trendUp ? "^" : "v";
  const trendColor = trendUp ? "#16a34a" : "#dc2626";

  return (
    <EmailLayout
      industry={industry}
      unsubscribeUrl={unsubscribeUrl}
      previewText={`Weekly Summary: ${totalLeadsThisWeek} new leads this week`}
    >
      {/* Heading */}
      <Section style={headingSection}>
        <Text style={headingStyle}>Your Weekly Summary</Text>
      </Section>

      {/* Greeting */}
      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hi {userName},</Text>
        <Text style={subTextStyle}>
          Here is your lead activity summary for the past week.
        </Text>
      </Section>

      {/* Summary Card */}
      <Section style={cardStyle}>
        <Text style={bigNumberStyle}>{totalLeadsThisWeek}</Text>
        <Text style={cardLabelStyle}>new leads this week</Text>
        <Text style={{ ...trendStyle, color: trendColor }}>
          {trendArrow} {Math.abs(trendPercent)}%{" "}
          {trendUp ? "increase" : "decrease"} vs last week
        </Text>
      </Section>

      {/* Daily Breakdown */}
      {newLeadsByDay.length > 0 && (
        <Section style={sectionStyle}>
          <Text style={sectionHeadingStyle}>Daily Breakdown</Text>
          {newLeadsByDay.map((day) => (
            <Text key={day.day} style={dayRowStyle}>
              <span style={dayLabelStyle}>{day.day}</span>
              <span style={dayCountStyle}>{day.count} leads</span>
            </Text>
          ))}
        </Section>
      )}

      <Hr style={dividerStyle} />

      {/* Top Source Types */}
      {topSourceTypes.length > 0 && (
        <Section style={sectionStyle}>
          <Text style={sectionHeadingStyle}>Top Sources</Text>
          {topSourceTypes.map((src) => (
            <Text key={src.type} style={listItemStyle}>
              <span style={sourceTypeStyle}>{src.type}</span>
              <span style={sourceCountStyle}>{src.count}</span>
            </Text>
          ))}
        </Section>
      )}

      {/* Top Cities */}
      {topCities.length > 0 && (
        <Section style={sectionStyle}>
          <Text style={sectionHeadingStyle}>Top Cities</Text>
          {topCities.slice(0, 3).map((c) => (
            <Text key={c.city} style={listItemStyle}>
              <span style={cityNameStyle}>{c.city}</span>
              <span style={sourceCountStyle}>{c.count} leads</span>
            </Text>
          ))}
        </Section>
      )}

      <Hr style={dividerStyle} />

      {/* Bookmarks */}
      <Section style={sectionStyle}>
        <Text style={bookmarkStyle}>
          You have <strong>{bookmarkCount}</strong> bookmarked leads.
        </Text>
      </Section>

      {/* CTA Button */}
      <Section style={ctaStyle}>
        <Link href={`${dashboardUrl}/dashboard`} style={buttonStyle}>
          View Dashboard
        </Link>
      </Section>
    </EmailLayout>
  );
}

// -- Inline styles --

const headingSection: React.CSSProperties = {
  padding: "24px 32px 0",
};

const headingStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  padding: "12px 32px 0",
};

const greetingStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 16,
  lineHeight: 1.5,
  margin: "0 0 4px 0",
};

const subTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  margin: "0 0 16px 0",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: 8,
  margin: "0 32px",
  padding: "24px",
  textAlign: "center" as const,
};

const bigNumberStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 40,
  fontWeight: 700,
  margin: "0 0 4px 0",
};

const cardLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  margin: "0 0 8px 0",
};

const trendStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  margin: 0,
};

const sectionStyle: React.CSSProperties = {
  padding: "16px 32px",
};

const sectionHeadingStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 14,
  fontWeight: 600,
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const dayRowStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 14,
  margin: "0 0 4px 0",
};

const dayLabelStyle: React.CSSProperties = {
  display: "inline-block",
  fontWeight: 600,
  minWidth: 40,
};

const dayCountStyle: React.CSSProperties = {
  color: "#6b7280",
};

const listItemStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 14,
  margin: "0 0 4px 0",
};

const sourceTypeStyle: React.CSSProperties = {
  display: "inline-block",
  fontWeight: 500,
  minWidth: 100,
  textTransform: "capitalize" as const,
};

const sourceCountStyle: React.CSSProperties = {
  color: "#6b7280",
  fontWeight: 600,
};

const cityNameStyle: React.CSSProperties = {
  display: "inline-block",
  fontWeight: 500,
  minWidth: 100,
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "4px 32px",
};

const bookmarkStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: 14,
  margin: 0,
};

const ctaStyle: React.CSSProperties = {
  padding: "8px 32px 24px",
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
