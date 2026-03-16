# Phase 11: Forgot Password - Research

**Researched:** 2026-03-16
**Domain:** better-auth password reset with Resend email delivery
**Confidence:** HIGH

## Summary

Phase 11 implements forgot-password functionality using better-auth's native password reset flow with Resend for email delivery. The project already has all required infrastructure: better-auth v1.5.5 with the `verification` table for tokens, Resend SDK v6.9.3 with `@react-email/components`, and an established email sending pattern in `src/lib/email/send-digest.ts`. No new dependencies or database migrations are needed.

The implementation requires: (1) adding `sendResetPassword` to the server-side `emailAndPassword` config in `src/lib/auth.ts`, (2) creating a React Email template for the reset email, (3) building two new pages under `src/app/(auth)/` -- `forgot-password` and `reset-password`, and (4) adding a "Forgot password?" link to the existing sign-in form.

**Primary recommendation:** Use better-auth's native `sendResetPassword` + `requestPasswordReset` / `resetPassword` client methods with Resend for delivery. No plugins needed -- this is built into core better-auth.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can reset forgotten password via email link from sign-in page (better-auth native sendResetPassword with Resend) | All infrastructure exists. Server config addition to auth.ts, two new route pages, one email template, one sign-in form link. See Architecture Patterns and Code Examples sections for complete implementation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.5.5 | Auth framework with built-in password reset flow | Already installed; provides `sendResetPassword`, `requestPasswordReset`, `resetPassword` out of the box |
| resend | 6.9.3 | Email delivery API | Already installed; used by digest emails; proven deliverability |
| @react-email/components | 1.0.9 | Email templates in React | Already installed; used by daily-digest template |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.71.2 | Form state management | Already used in sign-in, sign-up, change-password forms |
| @hookform/resolvers | 5.2.2 | Zod integration for RHF | Already used across auth forms |
| zod | 4.3.6 | Schema validation | Already used for auth form validation |
| sonner | 2.0.7 | Toast notifications | Already used for success/error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth native reset | email-otp plugin | OTP adds complexity; link-based is simpler, standard, and matches the requirement |
| Resend | Nodemailer/SES | Resend already integrated; changing providers adds unnecessary risk |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(auth)/
│   ├── forgot-password/
│   │   └── page.tsx           # NEW: forgot password page
│   └── reset-password/
│       └── page.tsx           # NEW: reset password page
├── components/
│   ├── auth/
│   │   ├── sign-in-form.tsx   # MODIFY: add "Forgot password?" link
│   │   ├── forgot-password-form.tsx  # NEW: email input form
│   │   └── reset-password-form.tsx   # NEW: new password form
│   └── emails/
│       ├── daily-digest.tsx   # EXISTING: reference for style
│       └── password-reset.tsx # NEW: password reset email template
├── lib/
│   ├── auth.ts                # MODIFY: add sendResetPassword config
│   ├── auth-client.ts         # EXISTING: already exports authClient
│   └── validators/
│       └── auth.ts            # MODIFY: add forgot/reset password schemas
```

### Pattern 1: Server-Side Auth Config
**What:** Add `sendResetPassword` callback to `emailAndPassword` config in `src/lib/auth.ts`
**When to use:** Required to enable the password reset flow
**Example:**
```typescript
// Source: https://better-auth.com/docs/authentication/email-password
// In src/lib/auth.ts, modify the emailAndPassword config:
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    const resend = new Resend(
      (process.env.RESEND_API_KEY ?? "").trim()
    );
    const fromEmail =
      (process.env.RESEND_FROM_EMAIL ?? "").trim() ||
      "HeavyLeads <onboarding@resend.dev>";
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Reset your HeavyLeads password",
      react: PasswordResetEmail({ url, userName: user.name }),
    });
  },
  resetPasswordTokenExpiresIn: 3600, // 1 hour (default)
  revokeSessionsOnPasswordReset: true, // security best practice
},
```

### Pattern 2: Client-Side Forgot Password Flow
**What:** Call `authClient.requestPasswordReset()` with email and redirectTo
**When to use:** On the forgot-password form submission
**Example:**
```typescript
// Source: https://better-auth.com/docs/authentication/email-password
const { data, error } = await authClient.requestPasswordReset({
  email: formData.email,
  redirectTo: "/reset-password", // relative path -- better-auth prepends BETTER_AUTH_URL
});
// Always show success message (prevents user enumeration)
```

### Pattern 3: Client-Side Reset Password Flow
**What:** Extract token from URL search params, call `authClient.resetPassword()`
**When to use:** On the reset-password page after user clicks email link
**Example:**
```typescript
// Source: https://better-auth.com/docs/authentication/email-password
const searchParams = useSearchParams();
const token = searchParams.get("token");
const error = searchParams.get("error");

// If error=INVALID_TOKEN, show expiry/invalid message
// If token exists, show new password form

const { data, error: resetError } = await authClient.resetPassword({
  newPassword: formData.newPassword,
  token: token!,
});
```

### Pattern 4: The URL Flow (how better-auth generates and validates the reset link)
**What:** Understanding the full redirect chain
**Flow:**
1. Client calls `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`
2. Server creates a verification record in the `verification` table with identifier `reset-password:<token>`
3. Server calls `sendResetPassword({ user, url, token })` where `url` = `{BETTER_AUTH_URL}/api/auth/reset-password/{token}?callbackURL={redirectTo}`
4. User clicks email link -> hits better-auth's GET `/api/auth/reset-password/:token` endpoint
5. better-auth validates token, then redirects to `{redirectTo}?token={token}` (or `?error=INVALID_TOKEN` if expired/invalid)
6. Reset password page reads `token` from search params and calls `authClient.resetPassword({ newPassword, token })`
7. Server validates token again, updates password, deletes verification record

### Anti-Patterns to Avoid
- **Awaiting email send in the handler:** Use fire-and-forget (`void`) or better-auth's built-in `runInBackgroundOrAwait` to prevent timing attacks that reveal whether an email exists. However, better-auth v1.5.5 already wraps the callback in `runInBackgroundOrAwait` internally, so awaiting inside the callback is safe.
- **Custom token generation:** Do NOT build custom token logic. better-auth handles token creation, storage in the `verification` table, expiry, and cleanup.
- **Revealing email existence:** The `requestPasswordReset` endpoint always returns `{ status: true }` regardless of whether the email exists. The forgot-password form must always show a generic success message.
- **Forgetting to .trim() env vars:** Per project convention, always `.trim()` environment variables to handle Vercel trailing newlines.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation/storage | Custom token table or crypto | better-auth's `verification` table + native flow | Token lifecycle (creation, expiry check, single-use deletion) is handled automatically |
| Password hashing | Custom bcrypt/argon2 | better-auth's `resetPassword` endpoint | Handles hashing, old session revocation, and verification cleanup |
| Rate limiting | Custom IP tracking | better-auth's built-in rate limiter on `/request-password-reset` | Already applied at 10 requests/60 seconds by default |
| Email template | Raw HTML strings | @react-email/components (already installed) | Consistent styling, tested rendering, matches existing digest template |
| Timing attack prevention | Custom delays | better-auth's `runInBackgroundOrAwait` | Framework handles async email sending without leaking user existence |

**Key insight:** The entire password reset flow is a first-party feature of better-auth. The only custom code needed is the email template and two UI forms.

## Common Pitfalls

### Pitfall 1: Incorrect redirectTo URL
**What goes wrong:** The reset link in the email redirects to the wrong page or a 404
**Why it happens:** `redirectTo` in `requestPasswordReset` is relative to `BETTER_AUTH_URL`. If `BETTER_AUTH_URL` is not set correctly (especially in production vs dev), the callback URL breaks.
**How to avoid:** Ensure `BETTER_AUTH_URL` matches the actual deployment URL in both development and production. The existing config already uses `(process.env.BETTER_AUTH_URL ?? "").trim()`.
**Warning signs:** Reset links in emails point to `localhost:3000` in production.

### Pitfall 2: Missing RESEND_API_KEY
**What goes wrong:** `sendResetPassword` silently fails, user never receives email
**Why it happens:** The Resend API key is marked as OPTIONAL in `.env.example` (used for digest emails). Password reset is critical path -- it MUST have the API key.
**How to avoid:** Log a clear error (not just silent skip) when RESEND_API_KEY is missing in the sendResetPassword callback. Consider throwing so better-auth returns an error to the user.
**Warning signs:** User reports "I never got the email" but no errors in logs.

### Pitfall 3: Token expired/invalid with no clear UX
**What goes wrong:** User clicks an old reset link and sees a blank page or cryptic error
**Why it happens:** better-auth redirects with `?error=INVALID_TOKEN` but the reset-password page doesn't handle this query param
**How to avoid:** The reset-password page MUST check for `error` search param and show a clear message like "This reset link has expired. Please request a new one." with a link back to forgot-password.
**Warning signs:** Users stuck on reset-password page with no feedback.

### Pitfall 4: Email deliverability (spam filters)
**What goes wrong:** Reset emails land in spam
**Why it happens:** Without a verified custom domain in Resend, emails come from `onboarding@resend.dev` which has lower deliverability. STATE.md already notes: "Custom Resend domain status unknown -- password reset emails may land in spam without SPF/DKIM"
**How to avoid:** Configure a custom sending domain in Resend with proper SPF/DKIM records. Use `RESEND_FROM_EMAIL` env var with the verified domain. For immediate testing, `onboarding@resend.dev` works but is not production-grade.
**Warning signs:** Emails arrive for Gmail but not corporate email providers.

### Pitfall 5: Not adding side-effect imports to auth.ts
**What goes wrong:** Production 500 errors
**Why it happens:** Per project STATE.md decision: "Never add side-effect imports to db/index.ts or auth.ts -- caused production 500"
**How to avoid:** The Resend client should be instantiated inside the `sendResetPassword` callback (not at module top level). The email template import is safe since it's a React component with no side effects.
**Warning signs:** Build passes but runtime crashes on Vercel.

### Pitfall 6: Password confirmation mismatch
**What goes wrong:** User types mismatched passwords, frustrating UX
**Why it happens:** Reset password form without client-side confirmation check
**How to avoid:** Use Zod `.refine()` to validate `newPassword === confirmPassword` before submission (same pattern as existing `change-password-form.tsx`).
**Warning signs:** API error after submission instead of inline validation.

## Code Examples

Verified patterns from official sources and existing project code:

### Forgot Password Email Schema (Zod)
```typescript
// Add to src/lib/validators/auth.ts
export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
```

### Reset Password Schema (Zod)
```typescript
// Add to src/lib/validators/auth.ts
export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
```

### Password Reset Email Template (React Email)
```typescript
// src/components/emails/password-reset.tsx
// Follow same inline-style pattern as daily-digest.tsx
import { Html, Head, Body, Container, Section, Text, Link, Hr } from "@react-email/components";

interface PasswordResetEmailProps {
  url: string;
  userName: string;
}

export function PasswordResetEmail({ url, userName }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>HeavyLeads</Text>
            <Text style={headingStyle}>Reset Your Password</Text>
          </Section>
          <Section style={contentStyle}>
            <Text>Hi {userName},</Text>
            <Text>Click the button below to reset your password. This link expires in 1 hour.</Text>
            <Link href={url} style={buttonStyle}>Reset Password</Link>
            <Text style={smallStyle}>If you didn't request this, you can safely ignore this email.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
// Reuse same inline style constants as daily-digest.tsx for brand consistency
```

### Sign-In Form Link Addition
```typescript
// In src/components/auth/sign-in-form.tsx, add between password field and submit button:
<div className="flex justify-end">
  <Link
    href="/forgot-password"
    className="text-sm text-primary hover:underline"
  >
    Forgot password?
  </Link>
</div>
```

### Auth Client Exports
```typescript
// src/lib/auth-client.ts -- already exports authClient
// The following methods are available on authClient without changes:
// - authClient.requestPasswordReset({ email, redirectTo })
// - authClient.resetPassword({ newPassword, token })
// No changes needed to auth-client.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `authClient.forgetPassword()` | `authClient.requestPasswordReset()` | better-auth v1.4+ | Method renamed; old name removed |
| `timestamp` columns | `timestamp with time zone` | better-auth v1.2.13+ (PR #3477) | Fixes timezone-related invalid token errors |
| Custom token logic | Native `verification` table flow | Since initial release | No custom code needed for token lifecycle |

**Deprecated/outdated:**
- `authClient.forgetPassword()`: Renamed to `authClient.requestPasswordReset()` in v1.4. The old name does not exist in v1.5.5.

## Open Questions

1. **Resend custom domain configuration**
   - What we know: STATE.md notes "Custom Resend domain status unknown -- password reset emails may land in spam without SPF/DKIM"
   - What's unclear: Whether Josh has configured a custom sending domain in Resend
   - Recommendation: Use `RESEND_FROM_EMAIL` env var for the from address. If custom domain not configured, password reset will still work via `onboarding@resend.dev` for testing. Document that production deployments should verify a custom domain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/regressions/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01a | Forgot password form renders and validates email | unit | `npx vitest run tests/auth/forgot-password-form.test.tsx -x` | No -- Wave 0 |
| AUTH-01b | Reset password form renders, validates passwords, handles token/error params | unit | `npx vitest run tests/auth/reset-password-form.test.tsx -x` | No -- Wave 0 |
| AUTH-01c | Sign-in form has "Forgot password?" link to /forgot-password | unit | `npx vitest run tests/auth/sign-in-forgot-link.test.tsx -x` | No -- Wave 0 |
| AUTH-01d | sendResetPassword config calls Resend with correct template | unit | `npx vitest run tests/auth/send-reset-password.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/auth/ -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/auth/forgot-password-form.test.tsx` -- covers AUTH-01a (form render, email validation, success message)
- [ ] `tests/auth/reset-password-form.test.tsx` -- covers AUTH-01b (form render, password validation, token handling, error state)
- [ ] `tests/auth/sign-in-forgot-link.test.tsx` -- covers AUTH-01c (link present, correct href)
- [ ] `tests/auth/send-reset-password.test.ts` -- covers AUTH-01d (Resend called with correct args, handles missing API key)

## Sources

### Primary (HIGH confidence)
- [better-auth Email & Password docs](https://better-auth.com/docs/authentication/email-password) - sendResetPassword config, client methods, token flow
- [better-auth Options reference](https://better-auth.com/docs/reference/options) - resetPasswordTokenExpiresIn, revokeSessionsOnPasswordReset defaults
- better-auth v1.5.5 source code (node_modules inspection) - verified exact method names, endpoint paths, verification table usage, runInBackgroundOrAwait behavior
- Existing project code: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/email/send-digest.ts`, `src/components/emails/daily-digest.tsx`, `src/components/settings/change-password-form.tsx`, `src/components/auth/sign-in-form.tsx`

### Secondary (MEDIUM confidence)
- [better-auth GitHub Issue #3461](https://github.com/better-auth/better-auth/issues/3461) - timezone fix for token validation (resolved in PR #3477, relevant to v1.2.13+)
- [better-auth GitHub Issue #2082](https://github.com/better-auth/better-auth/issues/2082) - ID stringification bug (resolved in v1.2.5+, not applicable to v1.5.5)
- [DEV.to tutorial: Forgot/Reset Password with better-auth + Next.js + Resend](https://dev.to/daanish2003/forgot-and-reset-password-using-betterauth-nextjs-and-resend-ilj) - practical implementation reference (uses older API names but same flow)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in node_modules
- Architecture: HIGH - verified exact API surface by reading better-auth v1.5.5 source code; existing project patterns provide clear templates
- Pitfalls: HIGH - cross-referenced GitHub issues with source code; project-specific pitfalls from STATE.md decisions

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- better-auth API unlikely to change within minor version)
