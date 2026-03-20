/**
 * Database Reset Script
 *
 * Wipes all non-admin data. Preserves the admin user and their org.
 *
 * Usage:
 *   npx tsx scripts/db-reset.ts --admin-email=josh@wiersema.xyz
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
    console.error("ERROR: DATABASE_URL not set.");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("=== GroundPulse Database Reset ===\n");

  // List actual tables
  const tablesResult = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const allTables = tablesResult.rows.map((r) => r.tablename as string);
  console.log("Tables found:", allTables.join(", "), "\n");

  // Find admin user
  let adminUserId: string | null = null;
  let adminOrgIds: string[] = [];

  if (adminEmail) {
    const adminResult = await db.execute(
      sql`SELECT id FROM "user" WHERE email = ${adminEmail}`
    );
    if (adminResult.rows.length > 0) {
      adminUserId = adminResult.rows[0].id as string;
      console.log(`Admin: ${adminEmail} (${adminUserId})`);

      const orgResult = await db.execute(
        sql`SELECT "organization_id" FROM "member" WHERE "user_id" = ${adminUserId}`
      );
      adminOrgIds = orgResult.rows.map((r) => r.organization_id as string);
      console.log(`Admin orgs: ${adminOrgIds.join(", ") || "none"}\n`);
    } else {
      console.log(`Admin email ${adminEmail} not found — wiping everything.\n`);
    }
  }

  // Tables to fully wipe (no FK deps to auth tables)
  const wipeTables = [
    "scraper_runs",
    "pipeline_runs",
    "lead_enrichments",
    "lead_statuses",
    "lead_sources",
    "bookmarks",
    "leads",
    "saved_searches",
    "notification_preferences",
    "subscription",
    "organization_profiles",
    // Legacy table names (pre-rename)
    "lead_status",
    "lead_source",
    "lead",
    "saved_search",
    "company_profile",
  ];

  for (const table of wipeTables) {
    if (!allTables.includes(table)) continue;
    try {
      const result = await db.execute(sql.raw(`DELETE FROM "${table}"`));
      console.log(`  Cleared: ${table} (${result.rowCount} rows)`);
    } catch (err) {
      console.log(`  Skip: ${table} (${err instanceof Error ? err.message : "error"})`);
    }
  }

  // Clear auth tables, preserving admin
  if (adminUserId) {
    // Invitations (FK to org + user)
    if (allTables.includes("invitation")) {
      const ir = await db.execute(sql`DELETE FROM "invitation"`);
      console.log(`  Cleared: invitation (${ir.rowCount} rows)`);
    }

    // Sessions
    const sr = await db.execute(
      sql`DELETE FROM "session" WHERE "user_id" != ${adminUserId}`
    );
    console.log(`  Cleared: session (${sr.rowCount} non-admin rows)`);

    // Members
    const mr = await db.execute(
      sql`DELETE FROM "member" WHERE "user_id" != ${adminUserId}`
    );
    console.log(`  Cleared: member (${mr.rowCount} non-admin rows)`);

    // Accounts
    const ar = await db.execute(
      sql`DELETE FROM "account" WHERE "user_id" != ${adminUserId}`
    );
    console.log(`  Cleared: account (${ar.rowCount} non-admin rows)`);

    // Users
    const ur = await db.execute(
      sql`DELETE FROM "user" WHERE id != ${adminUserId}`
    );
    console.log(`  Cleared: user (${ur.rowCount} non-admin rows)`);

    // Orgs not owned by admin
    if (adminOrgIds.length > 0) {
      const placeholders = adminOrgIds.map((id) => `'${id}'`).join(", ");
      const or2 = await db.execute(
        sql.raw(`DELETE FROM "organization" WHERE id NOT IN (${placeholders})`)
      );
      console.log(`  Cleared: organization (${or2.rowCount} non-admin rows)`);
    }

    // Clear admin's stripe customer ID so it can be recreated
    if (adminOrgIds.length > 0) {
      await db.execute(
        sql.raw(
          `UPDATE "organization" SET "stripe_customer_id" = NULL WHERE id IN (${adminOrgIds.map((id) => `'${id}'`).join(", ")})`
        )
      );
      console.log("  Reset: admin org stripe_customer_id → NULL");
    }
  } else {
    // No admin — wipe everything
    for (const table of ["session", "member", "account", "verification", "user", "organization"]) {
      if (!allTables.includes(table)) continue;
      try {
        const result = await db.execute(sql.raw(`DELETE FROM "${table}"`));
        console.log(`  Cleared: ${table} (${result.rowCount} rows)`);
      } catch {
        // table might not exist
      }
    }
  }

  console.log("\n=== Reset complete ===");
  if (adminUserId) {
    console.log(`Admin preserved: ${adminEmail}`);
    console.log("Admin will need to re-complete onboarding and subscribe.");
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
