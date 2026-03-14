"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSavedSearch } from "@/actions/saved-searches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Save, X } from "lucide-react";

export function SaveSearchForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  // Extract filter params from URL (excluding the save flag)
  const keyword = searchParams.get("keyword") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const minProjectSize = searchParams.get("minProjectSize") ?? undefined;
  const maxProjectSize = searchParams.get("maxProjectSize") ?? undefined;
  const radiusMiles = searchParams.get("radius") ?? undefined;
  const equipment = searchParams.get("equipment") ?? undefined;

  // Build filter summary for display
  const parts: string[] = [];
  if (keyword) parts.push(`Keyword: "${keyword}"`);
  if (dateFrom) parts.push(`From: ${dateFrom.slice(0, 10)}`);
  if (dateTo) parts.push(`To: ${dateTo.slice(0, 10)}`);
  if (minProjectSize) parts.push(`Min: $${minProjectSize}`);
  if (maxProjectSize) parts.push(`Max: $${maxProjectSize}`);
  if (radiusMiles) parts.push(`Radius: ${radiusMiles}mi`);
  if (equipment) parts.push(`Equipment: ${equipment}`);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }

    startTransition(async () => {
      try {
        await createSavedSearch({
          name: name.trim(),
          keyword,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
          minProjectSize: minProjectSize
            ? parseInt(minProjectSize, 10)
            : undefined,
          maxProjectSize: maxProjectSize
            ? parseInt(maxProjectSize, 10)
            : undefined,
          radiusMiles: radiusMiles ? parseFloat(radiusMiles) : undefined,
          equipmentFilter: equipment
            ? equipment.split(",").filter(Boolean)
            : undefined,
        });
        toast.success("Search saved");
        router.replace("/dashboard/saved-searches");
      } catch {
        toast.error("Failed to save search");
      }
    });
  }

  function handleCancel() {
    router.replace("/dashboard/saved-searches");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Save Current Search</CardTitle>
        <CardDescription>
          {parts.length > 0
            ? `Filters: ${parts.join(", ")}`
            : "No filters applied -- this will save the default search."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., Hospital projects near HQ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="gap-1.5"
            >
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
              className="gap-1.5"
            >
              <X className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
