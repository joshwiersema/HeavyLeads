"use client";

import { useTransition } from "react";
import { updateBookmarkStatus } from "@/actions/bookmarks";
import type { PipelineStatus } from "@/actions/bookmark-types";
import { toast } from "sonner";

const STATUS_OPTIONS: {
  value: PipelineStatus;
  label: string;
  dotColor: string;
}[] = [
  { value: "saved", label: "Saved", dotColor: "bg-gray-400" },
  { value: "contacted", label: "Contacted", dotColor: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", dotColor: "bg-amber-500" },
  { value: "won", label: "Won", dotColor: "bg-green-500" },
  { value: "lost", label: "Lost", dotColor: "bg-red-500" },
];

interface PipelineStatusSelectProps {
  bookmarkId: string;
  currentStatus: PipelineStatus;
  onStatusChange?: () => void;
}

export function PipelineStatusSelect({
  bookmarkId,
  currentStatus,
  onStatusChange,
}: PipelineStatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as PipelineStatus;
    startTransition(async () => {
      try {
        await updateBookmarkStatus(bookmarkId, newStatus);
        onStatusChange?.();
      } catch (err) {
        toast.error("Failed to update status");
        console.error("[PipelineStatusSelect]", err);
      }
    });
  }

  const current = STATUS_OPTIONS.find((o) => o.value === currentStatus);
  const dotColor = current?.dotColor ?? "bg-gray-400";

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <span
        className={`inline-block size-2 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className={`
          appearance-none rounded-md border border-input bg-transparent
          py-1 pl-1.5 pr-6 text-xs font-medium
          transition-opacity focus:outline-none focus:ring-2 focus:ring-ring/50
          disabled:cursor-not-allowed
          ${isPending ? "opacity-50" : ""}
        `}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
