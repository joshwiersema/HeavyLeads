"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSavedSearch } from "@/actions/saved-searches";
import type { SavedSearchRow } from "@/actions/saved-searches";
import { savedSearchToParams } from "@/lib/leads/saved-search-utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Play, Trash2 } from "lucide-react";

interface SavedSearchCardProps {
  search: SavedSearchRow;
}

/** Builds a human-readable summary of the search filters */
function buildFilterSummary(search: SavedSearchRow): string {
  const parts: string[] = [];

  if (search.keyword) parts.push(`Keyword: "${search.keyword}"`);
  if (search.radiusMiles != null) parts.push(`Radius: ${search.radiusMiles}mi`);
  if (search.equipmentFilter && search.equipmentFilter.length > 0) {
    parts.push(`Equipment: ${search.equipmentFilter.join(", ")}`);
  }
  if (search.dateFrom) {
    parts.push(`From: ${new Date(search.dateFrom).toLocaleDateString()}`);
  }
  if (search.dateTo) {
    parts.push(`To: ${new Date(search.dateTo).toLocaleDateString()}`);
  }
  if (search.minProjectSize != null) {
    parts.push(`Min: $${search.minProjectSize.toLocaleString()}`);
  }
  if (search.maxProjectSize != null) {
    parts.push(`Max: $${search.maxProjectSize.toLocaleString()}`);
  }

  return parts.length > 0 ? parts.join(", ") : "Default filters";
}

export function SavedSearchCard({ search }: SavedSearchCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLoad() {
    const params = savedSearchToParams(search);
    router.push(`/dashboard?${params}`);
  }

  function handleDelete() {
    if (!confirm(`Delete saved search "${search.name}"?`)) return;

    startTransition(async () => {
      try {
        await deleteSavedSearch(search.id);
        toast.success("Saved search deleted");
      } catch {
        toast.error("Failed to delete saved search");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{search.name}</CardTitle>
        <CardDescription>{buildFilterSummary(search)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Created {new Date(search.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              Load
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
