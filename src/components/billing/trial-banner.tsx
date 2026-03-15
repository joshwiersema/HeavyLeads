import Link from "next/link";
import { Clock } from "lucide-react";

export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  const message =
    daysRemaining === 0
      ? "Your trial ends today"
      : daysRemaining === 1
        ? "1 day left in your trial"
        : `${daysRemaining} days left in your trial`;

  return (
    <div
      data-testid="trial-banner"
      className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <div className="flex items-center gap-2">
        <Clock className="size-4" />
        <span>{message}</span>
      </div>
      <Link
        href="/billing"
        className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
      >
        Subscribe now
      </Link>
    </div>
  );
}
