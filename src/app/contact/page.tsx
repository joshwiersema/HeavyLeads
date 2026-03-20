import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact | GroundPulse",
};

export default function ContactPage() {
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

      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Contact Us</CardTitle>
            <CardDescription>
              We&apos;d love to hear from you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Have questions about GroundPulse? Need help with your account? Reach
              out to our team and we&apos;ll get back to you as soon as possible.
            </p>
            <p>
              Email us at{" "}
              <a
                href="mailto:support@groundpulse.com"
                className="font-medium text-primary hover:underline"
              >
                support@groundpulse.com
              </a>
            </p>
          </CardContent>
        </Card>
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
