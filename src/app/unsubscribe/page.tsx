import Link from "next/link";

interface UnsubscribePageProps {
  searchParams: Promise<{ success?: string }>;
}

/**
 * Public unsubscribe confirmation page.
 * Not inside the dashboard layout -- accessible without login.
 */
export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const params = await searchParams;
  const isSuccess = params.success === "true";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f4f4f5",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          maxWidth: 480,
          padding: "48px 32px",
          textAlign: "center",
          boxShadow:
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 8,
          }}
        >
          HeavyLeads
        </h1>

        {isSuccess ? (
          <>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 12,
              }}
            >
              You have been unsubscribed
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "#6b7280",
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              You will no longer receive these emails.
            </p>
          </>
        ) : (
          <>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 12,
              }}
            >
              Invalid unsubscribe link
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "#6b7280",
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              Please use the link from your email.
            </p>
          </>
        )}

        <p style={{ fontSize: 14, color: "#9ca3af" }}>
          Changed your mind?{" "}
          <Link
            href="/dashboard/settings"
            style={{ color: "#1e40af", textDecoration: "underline" }}
          >
            Sign in to manage notification preferences
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
