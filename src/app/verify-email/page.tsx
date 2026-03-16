"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";

export default function VerifyEmailPage() {
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);

  function handleResend() {
    startTransition(async () => {
      try {
        await authClient.sendVerificationEmail({
          email: "", // Better Auth uses the current session's email
          callbackURL: "/dashboard",
        });
        setResent(true);
      } catch (err) {
        console.error("[verify-email] Failed to resend:", err);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click the link to
            verify and access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            onClick={handleResend}
            disabled={isPending || resent}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resent
              ? "Verification email sent!"
              : isPending
                ? "Sending..."
                : "Resend verification email"}
          </button>
          <div className="text-center">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
