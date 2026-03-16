/**
 * Validates required environment variables at import time.
 * Import this module early (from db, stripe, auth) to catch
 * misconfiguration at startup instead of at runtime.
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
] as const;

for (const name of REQUIRED_VARS) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (development) or your hosting provider's environment settings (production).`
    );
  }
}
