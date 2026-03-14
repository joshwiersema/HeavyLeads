"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { EQUIPMENT_TYPES } from "@/types";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";

interface LeadFiltersProps {
  defaultRadius: number;
  dealerEquipment: string[];
}

export function LeadFilters({
  defaultRadius,
  dealerEquipment,
}: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse equipment filter from URL
  const selectedEquipment = useMemo(() => {
    const param = searchParams.get("equipment");
    if (!param) return [] as string[];
    return param.split(",").filter(Boolean);
  }, [searchParams]);

  // Parse radius from URL, falling back to company default
  const currentRadius = useMemo(() => {
    const param = searchParams.get("radius");
    if (param) {
      const parsed = parseInt(param, 10);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 500) return parsed;
    }
    return defaultRadius;
  }, [searchParams, defaultRadius]);

  // Local radius state for smooth slider dragging (only update URL on commit)
  const [localRadius, setLocalRadius] = useState(currentRadius);

  // Collapsible filter panel state for mobile
  const [isOpen, setIsOpen] = useState(false);

  /** Build new URLSearchParams preserving other params */
  const buildParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      return params;
    },
    [searchParams]
  );

  /** Toggle an equipment type in the filter */
  const handleEquipmentToggle = useCallback(
    (type: string, checked: boolean) => {
      let next: string[];
      if (checked) {
        next = [...selectedEquipment, type];
      } else {
        next = selectedEquipment.filter((t) => t !== type);
      }

      const params = buildParams({
        equipment: next.length > 0 ? next.join(",") : null,
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [selectedEquipment, buildParams, router, pathname]
  );

  /** Update URL when radius slider is released */
  const handleRadiusCommit = useCallback(
    (value: number | readonly number[]) => {
      const radiusValue = Array.isArray(value) ? value[0] : value;
      const params = buildParams({
        radius:
          radiusValue === defaultRadius
            ? null
            : String(radiusValue),
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [buildParams, router, pathname, defaultRadius]
  );

  const filterContent = (
    <div className="space-y-6">
      {/* Radius slider */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Search Radius: {localRadius} miles
        </Label>
        <Slider
          min={10}
          max={500}
          step={10}
          value={[localRadius]}
          onValueChange={(val: number | readonly number[]) => {
            const v = Array.isArray(val) ? val[0] : val;
            setLocalRadius(v);
          }}
          onValueCommitted={handleRadiusCommit}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>10 mi</span>
          <span>500 mi</span>
        </div>
      </div>

      {/* Equipment filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filter by Equipment Need</Label>
        <div className="grid grid-cols-1 gap-2">
          {EQUIPMENT_TYPES.map((type) => {
            const isSelected = selectedEquipment.includes(type);
            const isDealerType = dealerEquipment.includes(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked: boolean) =>
                    handleEquipmentToggle(type, checked)
                  }
                />
                <span className={isDealerType ? "font-medium" : ""}>
                  {type}
                </span>
                {isDealerType && (
                  <span className="text-xs text-muted-foreground">(yours)</span>
                )}
              </label>
            );
          })}
        </div>
        {selectedEquipment.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => {
              const params = buildParams({ equipment: null });
              router.replace(`${pathname}?${params.toString()}`);
            }}
          >
            Clear equipment filter
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible sidebar content */}
      <div className="hidden lg:block">{filterContent}</div>

      {/* Mobile: collapsible panel */}
      <div className="lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex items-center gap-2">
            <Filter className="size-4" />
            Filters
            {selectedEquipment.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {selectedEquipment.length}
              </span>
            )}
          </span>
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
        {isOpen && <div className="mt-3">{filterContent}</div>}
      </div>
    </>
  );
}
