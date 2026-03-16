"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organization as orgTable,
  user as userTable,
} from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

interface SignUpResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export async function atomicSignUp(data: {
  name: string;
  email: string;
  password: string;
  companyName: string;
  industry?: string;
}): Promise<SignUpResult> {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    // Step 1: Create user
    const userResult = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
    });
    if (!userResult?.user?.id) throw new Error("User creation returned no ID");
    userId = userResult.user.id;

    // Step 2: Create organization with industry default
    const slug =
      slugify(data.companyName) +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const orgResult = await auth.api.createOrganization({
      body: { name: data.companyName, slug, industry: data.industry ?? "heavy_equipment" },
      headers: await headers(),
    });
    if (!orgResult?.id) throw new Error("Organization creation returned no ID");
    orgId = orgResult.id;

    // Step 3: Set active organization
    await auth.api.setActiveOrganization({
      body: { organizationId: orgId },
      headers: await headers(),
    });

    return { success: true, redirectTo: "/onboarding" };
  } catch (error) {
    // Cleanup on failure -- delete in reverse order
    if (orgId) {
      try {
        await db.delete(orgTable).where(eq(orgTable.id, orgId));
      } catch {
        // Cleanup failure is non-fatal
      }
    }
    if (userId) {
      try {
        await db.delete(userTable).where(eq(userTable.id, userId));
      } catch {
        // Cleanup failure is non-fatal
      }
    }

    // Map to specific error messages (order matters -- check more specific patterns first)
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("slug") || msg.includes("taken")) {
      return {
        success: false,
        error: "This company name is already taken. Please choose a different name.",
      };
    }
    if (msg.includes("password") || msg.includes("Password")) {
      return {
        success: false,
        error: "Password must be at least 8 characters.",
      };
    }
    if (msg.includes("already") || msg.includes("exists") || msg.includes("UNIQUE")) {
      return {
        success: false,
        error: "An account with this email already exists. Please sign in instead.",
      };
    }
    return {
      success: false,
      error: msg || "Failed to create account. Please try again.",
    };
  }
}
