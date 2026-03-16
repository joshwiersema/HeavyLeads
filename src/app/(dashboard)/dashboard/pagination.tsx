"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Cursor-based "Load more leads" pagination.
 * Preserves all existing URL search params (filters, sort, etc.)
 * when navigating to the next page. Renders nothing when there
 * are no more results to load.
 */
export function Pagination({ nextCursor, hasMore }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!hasMore || !nextCursor) return null;

  function handleLoadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cursor", nextCursor!);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center justify-center py-4">
      <button
        type="button"
        onClick={handleLoadMore}
        className="rounded border px-4 py-2 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Load more leads
      </button>
    </div>
  );
}
