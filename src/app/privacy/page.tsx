import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | HeavyLeads",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          HeavyLeads
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
          Privacy Policy
        </h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p>
            HeavyLeads (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is
            committed to protecting your privacy. This Privacy Policy explains
            how we collect, use, and share information about you when you use our
            services.
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Information We Collect
          </h2>
          <p>
            We collect information you provide directly, such as your name,
            email address, company name, and location. We also collect usage data
            to improve our services.
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            How We Use Your Information
          </h2>
          <p>
            We use your information to provide and improve our lead intelligence
            services, communicate with you, and ensure the security of our
            platform.
          </p>
          <h2 className="text-lg font-semibold text-foreground">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please{" "}
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
            <span className="text-sm font-semibold">HeavyLeads</span>
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
