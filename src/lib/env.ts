/**
 * Validates required environment variables.
 *
 * During `next build` (NEXT_PHASE === phase-production-build) env vars
 * like STRIPE_SECRET_KEY may not be present, so we only warn.
 * At runtime the check throws so misconfigurations surface immediately.
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
] as const;

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build";

for (const name of REQUIRED_VARS) {
  const value = process.env[name]?.trim();
  if (!value) {
    if (isBuildPhase) {
      // Warn but don't block the build — Vercel injects env vars at runtime
      console.warn(`[env] Missing ${name} (build phase — will be checked at runtime)`);
    } else {
      throw new Error(
        `Missing required environment variable: ${name}. ` +
          `Set it in .env.local (development) or your hosting provider's environment settings (production).`
      );
    }
  }
}
