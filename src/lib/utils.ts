import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic date formatter that avoids server/client locale mismatch */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Safe wrapper that handles null/invalid dates */
export function safeFormatDate(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return formatDate(date);
}
