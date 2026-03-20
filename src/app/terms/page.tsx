import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | GroundPulse",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          GroundPulse
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Sign In
        </Link>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p>
            Welcome to GroundPulse. By using our services, you agree to the
            following terms and conditions.
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Use of Service
          </h2>
          <p>
            GroundPulse provides construction lead intelligence services. You
            agree to use our platform in compliance with all applicable laws and
            regulations.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account
            credentials. You agree to provide accurate information when creating
            your account.
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Subscriptions &amp; Billing
          </h2>
          <p>
            Access to GroundPulse requires a paid subscription after the free
            trial period. Billing is handled securely through Stripe.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            For questions about these terms, please{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">GroundPulse</span>
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          <nav className="flex gap-6">
            <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Terms of Service</Link>
            <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
