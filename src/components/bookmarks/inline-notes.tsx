"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { updateBookmarkNotes } from "@/actions/bookmarks";

interface InlineNotesProps {
  bookmarkId: string;
  initialNotes: string | null;
}

export function InlineNotes({ bookmarkId, initialNotes }: InlineNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [isPending, startTransition] = useTransition();
  const lastSavedRef = useRef(initialNotes ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (value: string) => {
      if (value === lastSavedRef.current) return;

      setSaveState("saving");
      startTransition(async () => {
        try {
          await updateBookmarkNotes(bookmarkId, value);
          lastSavedRef.current = value;
          setSaveState("saved");
          // Clear "Saved" indicator after 2s
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
        } catch (err) {
          setSaveState("idle");
          console.error("[InlineNotes] Failed to save:", err);
        }
      });
    },
    [bookmarkId, startTransition]
  );

  return (
    <div className="relative">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => save(notes)}
        placeholder="Add notes..."
        rows={1}
        className="
          w-full resize-none rounded-md border border-input bg-transparent
          px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground
          transition-all focus:outline-none focus:ring-2 focus:ring-ring/50
          focus:rows-3
        "
        style={{ minHeight: "2rem", maxHeight: "6rem" }}
        onFocus={(e) => {
          e.currentTarget.style.minHeight = "4.5rem";
        }}
        onBlurCapture={(e) => {
          if (!notes.trim()) {
            e.currentTarget.style.minHeight = "2rem";
          }
        }}
        disabled={isPending}
      />
      {saveState !== "idle" && (
        <span className="absolute right-2 top-1 text-[10px] text-muted-foreground">
          {saveState === "saving" ? "Saving..." : "Saved"}
        </span>
      )}
    </div>
  );
}
