/**
 * Seed a dev account directly into the database.
 *
 * Bypasses the Next.js runtime so it can run standalone with tsx.
 * Hashes the password using the same scrypt config Better Auth uses.
 *
 * Usage:
 *   npx tsx scripts/seed-dev-account.ts \
 *     --email=josh.wiersema06@gmail.com \
 *     --password='jwiers2024!' \
 *     --name='Josh Wiersema' \
 *     --company='LeadForge Dev'
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function generateId(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/** Hash using the same scrypt config as Better Auth */
async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384,
    p: 1,
    r: 16,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${bytesToHex(key)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const email = getArg("email");
  const password = getArg("password");
  const name = getArg("name") ?? "Dev User";
  const company = getArg("company") ?? "Dev Company";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/seed-dev-account.ts --email=... --password=...");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set.");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("=== Seeding Dev Account ===\n");

  // Check if email already exists
  const existing = await db.execute(
    sql`SELECT id FROM "user" WHERE email = ${email}`
  );
  if (existing.rows.length > 0) {
    console.log(`User ${email} already exists (${existing.rows[0].id}). Skipping.`);
    process.exit(0);
  }

  // Create user
  const userId = generateId();
  const now = new Date();
  await db.execute(
    sql`INSERT INTO "user" (id, name, email, "email_verified", "created_at", "updated_at")
        VALUES (${userId}, ${name}, ${email}, true, ${now}, ${now})`
  );
  console.log(`  Created user: ${email} (${userId})`);

  // Create account (credential provider with hashed password)
  const hashedPassword = await hashPassword(password);
  const accountId = generateId();
  await db.execute(
    sql`INSERT INTO "account" (id, "account_id", "provider_id", "user_id", password, "created_at", "updated_at")
        VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}, ${now}, ${now})`
  );
  console.log(`  Created account (credential)`);

  // Create organization
  const orgId = generateId();
  const slug = slugify(company) + "-" + Math.random().toString(36).slice(2, 6);
  await db.execute(
    sql`INSERT INTO "organization" (id, name, slug, industry, "created_at")
        VALUES (${orgId}, ${company}, ${slug}, 'heavy_equipment', ${now})`
  );
  console.log(`  Created org: ${company} (${slug})`);

  // Create membership (owner)
  const memberId = generateId();
  await db.execute(
    sql`INSERT INTO "member" (id, "organization_id", "user_id", role, "created_at")
        VALUES (${memberId}, ${orgId}, ${userId}, 'owner', ${now})`
  );
  console.log(`  Created membership (owner)`);

  console.log("\n=== Done ===");
  console.log(`Email:    ${email}`);
  console.log(`Verified: true`);
  console.log(`Org:      ${company}`);
  console.log(`\nSign in at your app, complete onboarding, then use "Skip (Dev Only)" on billing.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
