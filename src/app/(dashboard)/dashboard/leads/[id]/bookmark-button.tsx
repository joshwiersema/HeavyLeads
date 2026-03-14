"use client";

import { useOptimistic, useTransition } from "react";
import { toggleBookmark } from "@/actions/bookmarks";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

interface BookmarkButtonProps {
  leadId: string;
  isBookmarked: boolean;
}

export function BookmarkButton({ leadId, isBookmarked }: BookmarkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticBookmarked, setOptimisticBookmarked] =
    useOptimistic(isBookmarked);

  function handleClick() {
    startTransition(async () => {
      setOptimisticBookmarked(!optimisticBookmarked);
      try {
        const result = await toggleBookmark(leadId);
        toast.success(
          result.bookmarked ? "Lead bookmarked" : "Bookmark removed"
        );
      } catch {
        toast.error("Failed to update bookmark");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="gap-1.5"
      aria-label={optimisticBookmarked ? "Remove bookmark" : "Bookmark lead"}
    >
      <Bookmark
        className={`size-4 ${optimisticBookmarked ? "fill-current" : ""}`}
      />
      {optimisticBookmarked ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}
