/**
 * Database Reset Script
 *
 * Wipes all non-admin data from the database. Preserves the admin user
 * and their org/membership. Clears all leads, subscriptions, pipeline runs, etc.
 *
 * Usage:
 *   npx tsx scripts/db-reset.ts
 *   npx tsx scripts/db-reset.ts --admin-email=josh@example.com
 *
 * Requires DATABASE_URL in .env.local
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const adminEmail = process.argv
  .find((arg) => arg.startsWith("--admin-email="))
  ?.split("=")[1];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("=== HeavyLeads Database Reset ===\n");

  // Find admin user(s) to preserve
  let adminCondition = "";
  if (adminEmail) {
    adminCondition = adminEmail;
    console.log(`Preserving admin: ${adminEmail}`);
  } else {
    // Preserve the first user created (assumed to be admin)
    const firstUser = await db.execute(
      sql`SELECT email FROM "user" ORDER BY "createdAt" ASC LIMIT 1`
    );
    if (firstUser.rows.length > 0) {
      adminCondition = firstUser.rows[0].email as string;
      console.log(`Preserving first user (assumed admin): ${adminCondition}`);
    } else {
      console.log("No users found — wiping everything.");
    }
  }

  // Get admin user ID and org IDs to preserve
  let adminUserId: string | null = null;
  let adminOrgIds: string[] = [];

  if (adminCondition) {
    const adminResult = await db.execute(
      sql`SELECT id FROM "user" WHERE email = ${adminCondition}`
    );
    if (adminResult.rows.length > 0) {
      adminUserId = adminResult.rows[0].id as string;
      const orgResult = await db.execute(
        sql`SELECT "organizationId" FROM "member" WHERE "userId" = ${adminUserId}`
      );
      adminOrgIds = orgResult.rows.map((r) => r.organizationId as string);
      console.log(`Admin user ID: ${adminUserId}`);
      console.log(`Admin org IDs: ${adminOrgIds.join(", ") || "none"}\n`);
    }
  }

  // Clear tables in dependency-safe order
  const tables = [
    // App data (no FK deps)
    "pipeline_runs",
    "bookmark",
    "saved_search",
    "lead_status",
    "lead_source",
    "lead",
    // Billing
    "subscription",
    // Company
    "company_profile",
  ];

  for (const table of tables) {
    const result = await db.execute(sql.raw(`DELETE FROM "${table}"`));
    console.log(`  Cleared: ${table} (${result.rowCount} rows)`);
  }

  // Clear non-admin auth data
  if (adminUserId) {
    // Delete sessions for non-admin users
    const sessionResult = await db.execute(
      sql`DELETE FROM "session" WHERE "userId" != ${adminUserId}`
    );
    console.log(`  Cleared: session (${sessionResult.rowCount} non-admin rows)`);

    // Delete non-admin members
    const memberResult = await db.execute(
      sql`DELETE FROM "member" WHERE "userId" != ${adminUserId}`
    );
    console.log(`  Cleared: member (${memberResult.rowCount} non-admin rows)`);

    // Delete non-admin accounts
    const accountResult = await db.execute(
      sql`DELETE FROM "account" WHERE "userId" != ${adminUserId}`
    );
    console.log(`  Cleared: account (${accountResult.rowCount} non-admin rows)`);

    // Delete non-admin users
    const userResult = await db.execute(
      sql`DELETE FROM "user" WHERE id != ${adminUserId}`
    );
    console.log(`  Cleared: user (${userResult.rowCount} non-admin rows)`);

    // Delete orgs not owned by admin
    if (adminOrgIds.length > 0) {
      const placeholders = adminOrgIds.map((id) => `'${id}'`).join(", ");
      const orgResult = await db.execute(
        sql.raw(`DELETE FROM "organization" WHERE id NOT IN (${placeholders})`)
      );
      console.log(`  Cleared: organization (${orgResult.rowCount} non-admin rows)`);
    }
  } else {
    // No admin to preserve — wipe everything
    for (const table of ["session", "member", "account", "verification", "user", "organization"]) {
      try {
        const result = await db.execute(sql.raw(`DELETE FROM "${table}"`));
        console.log(`  Cleared: ${table} (${result.rowCount} rows)`);
      } catch {
        // Table may not exist
      }
    }
  }

  console.log("\n=== Reset complete ===");
  if (adminUserId) {
    console.log(`Admin account preserved: ${adminCondition}`);
    console.log("Admin can log in and access dashboard without subscription.");
    console.log("\nNote: Admin will be redirected to /billing (no active subscription).");
    console.log("Use the dev skip button or create a subscription via Stripe to proceed.");
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
