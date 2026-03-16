"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { PipelineStatus } from "@/actions/bookmark-types";

const FILTER_OPTIONS: {
  value: PipelineStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "saved", label: "Saved" },
  { value: "contacted", label: "Contacted" },
  { value: "in_progress", label: "In Progress" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

interface BookmarkFiltersProps {
  counts: Record<string, number>;
  total: number;
}

export function BookmarkFilters({ counts, total }: BookmarkFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("status") ?? "all";

  function handleFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`/dashboard/bookmarks?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_OPTIONS.map((opt) => {
        const count = opt.value === "all" ? total : (counts[opt.value] ?? 0);
        const isActive = activeFilter === opt.value;

        return (
          <button
            key={opt.value}
            onClick={() => handleFilter(opt.value)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm
              font-medium transition-colors
              ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }
            `}
          >
            {opt.label}
            <span
              className={`
                inline-flex items-center justify-center rounded-full px-1.5
                text-[10px] font-semibold min-w-[1.25rem]
                ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-foreground/10 text-muted-foreground"
                }
              `}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
