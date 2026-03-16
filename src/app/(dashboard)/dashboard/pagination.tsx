"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

/**
 * Pagination controls with Previous/Next buttons and page indicator.
 * Preserves all existing URL search params (filters, radius, etc.)
 * when navigating between pages. Renders nothing when totalPages <= 1.
 */
export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function navigate(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => navigate(currentPage - 1)}
        className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => navigate(currentPage + 1)}
        className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
