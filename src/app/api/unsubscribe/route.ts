import type { NextRequest } from "next/server";
import {
  validateUnsubscribeToken,
  unsubscribeUser,
} from "@/lib/email/unsubscribe";

/**
 * GET /api/unsubscribe?token=XXXX
 *
 * One-click unsubscribe endpoint per CAN-SPAM / RFC 8058.
 * No authentication required -- unsubscribe must work without login.
 * Validates the HMAC-signed token and updates notification preferences.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.json(
      { error: "Missing unsubscribe token" },
      { status: 400 }
    );
  }

  const payload = validateUnsubscribeToken(token);
  if (!payload) {
    return Response.json(
      { error: "Invalid or expired unsubscribe token" },
      { status: 400 }
    );
  }

  try {
    await unsubscribeUser(payload.userId, payload.emailType);

    // Redirect to confirmation page
    const url = new URL("/unsubscribe", request.url);
    url.searchParams.set("success", "true");
    return Response.redirect(url.toString(), 302);
  } catch (error) {
    console.error(
      "[unsubscribe] Error processing unsubscribe:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { error: "Failed to process unsubscribe request" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unsubscribe
 *
 * List-Unsubscribe-Post handler per RFC 8058.
 * Email clients send a POST with List-Unsubscribe=One-Click body.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.json(
      { error: "Missing unsubscribe token" },
      { status: 400 }
    );
  }

  const payload = validateUnsubscribeToken(token);
  if (!payload) {
    return Response.json(
      { error: "Invalid or expired unsubscribe token" },
      { status: 400 }
    );
  }

  try {
    await unsubscribeUser(payload.userId, payload.emailType);
    return Response.json({ success: true });
  } catch (error) {
    console.error(
      "[unsubscribe] Error processing POST unsubscribe:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { error: "Failed to process unsubscribe request" },
      { status: 500 }
    );
  }
}
