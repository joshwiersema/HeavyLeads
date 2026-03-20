"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { INDUSTRY_CONFIG } from "@/lib/onboarding/config";
import type { Industry } from "@/lib/onboarding/types";
import { ChevronDown, ChevronUp, Filter, Search, Save } from "lucide-react";

interface LeadFiltersProps {
  defaultRadius: number;
  industry: Industry;
  specializations: string[];
}

/** Source type options for the checkbox filter */
const SOURCE_TYPES = [
  { value: "permit", label: "Permits" },
  { value: "bid", label: "Bids" },
  { value: "news", label: "News" },
  { value: "deep-web", label: "Government Contracts" },
] as const;

/** Sort options */
const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "distance", label: "Distance" },
  { value: "value", label: "Value" },
  { value: "date", label: "Date" },
] as const;

export function LeadFilters({
  defaultRadius,
  industry,
  specializations,
}: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse source type filter from URL
  const selectedSourceTypes = useMemo(() => {
    const param = searchParams.get("sourceTypes");
    if (!param) return [] as string[];
    return param.split(",").filter(Boolean);
  }, [searchParams]);

  // Parse project type filter from URL
  const selectedProjectTypes = useMemo(() => {
    const param = searchParams.get("projectTypes");
    if (!param) return [] as string[];
    return param.split(",").filter(Boolean);
  }, [searchParams]);

  // Parse radius from URL, falling back to company default
  const currentRadius = useMemo(() => {
    const param = searchParams.get("maxDistance");
    if (param) {
      const parsed = parseInt(param, 10);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 2000) return parsed;
    }
    return defaultRadius;
  }, [searchParams, defaultRadius]);

  // Parse other filter params from URL
  const currentKeyword = searchParams.get("keyword") ?? "";
  const currentDateFrom = searchParams.get("dateFrom") ?? "";
  const currentDateTo = searchParams.get("dateTo") ?? "";
  const currentMinValue = searchParams.get("minValue") ?? "";
  const currentMaxValue = searchParams.get("maxValue") ?? "";
  const currentSortBy = searchParams.get("sortBy") ?? "score";
  const currentMatchOnly = searchParams.get("matchOnly") === "true";

  // Local radius state for smooth slider dragging (only update URL on commit)
  const [localRadius, setLocalRadius] = useState(currentRadius);

  // Local keyword state for debouncing
  const [localKeyword, setLocalKeyword] = useState(currentKeyword);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local keyword state when URL changes externally
  useEffect(() => {
    setLocalKeyword(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  // Collapsible filter panel state for mobile
  const [isOpen, setIsOpen] = useState(false);

  // Get industry-specific project type options
  const projectTypeOptions = useMemo(() => {
    return INDUSTRY_CONFIG[industry].specializations;
  }, [industry]);

  /** Build new URLSearchParams preserving other params */
  const buildParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset cursor whenever any filter changes
      params.delete("cursor");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      return params;
    },
    [searchParams]
  );

  /** Navigate with updated params */
  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = buildParams(updates);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [buildParams, router, pathname]
  );

  /** Toggle a source type in the filter */
  const handleSourceTypeToggle = useCallback(
    (type: string, checked: boolean) => {
      let next: string[];
      if (checked) {
        next = [...selectedSourceTypes, type];
      } else {
        next = selectedSourceTypes.filter((t) => t !== type);
      }
      navigate({ sourceTypes: next.length > 0 ? next.join(",") : null });
    },
    [selectedSourceTypes, navigate]
  );

  /** Toggle a project type in the filter */
  const handleProjectTypeToggle = useCallback(
    (type: string, checked: boolean) => {
      let next: string[];
      if (checked) {
        next = [...selectedProjectTypes, type];
      } else {
        next = selectedProjectTypes.filter((t) => t !== type);
      }
      navigate({ projectTypes: next.length > 0 ? next.join(",") : null });
    },
    [selectedProjectTypes, navigate]
  );

  /** Update URL when radius slider is released */
  const handleRadiusCommit = useCallback(
    (value: number | readonly number[]) => {
      const radiusValue = Array.isArray(value) ? value[0] : value;
      navigate({
        maxDistance:
          radiusValue === defaultRadius ? null : String(radiusValue),
      });
    },
    [navigate, defaultRadius]
  );

  /** Debounced keyword update */
  const handleKeywordChange = useCallback(
    (value: string) => {
      setLocalKeyword(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({ keyword: value || null });
      }, 300);
    },
    [navigate]
  );

  /** Handle date range changes */
  const handleDateChange = useCallback(
    (field: "dateFrom" | "dateTo", value: string) => {
      navigate({ [field]: value || null });
    },
    [navigate]
  );

  /** Handle value range changes */
  const handleValueChange = useCallback(
    (field: "minValue" | "maxValue", value: string) => {
      const parsed = parseInt(value, 10);
      navigate({
        [field]: !isNaN(parsed) && parsed >= 0 ? String(parsed) : null,
      });
    },
    [navigate]
  );

  /** Handle sort change */
  const handleSortChange = useCallback(
    (value: string) => {
      navigate({ sortBy: value === "score" ? null : value });
    },
    [navigate]
  );

  /** Handle matching specializations only toggle */
  const handleMatchOnlyToggle = useCallback(
    (checked: boolean) => {
      navigate({ matchOnly: checked ? "true" : null });
    },
    [navigate]
  );

  /** Navigate to saved searches page with current filter params to save */
  const handleSaveSearch = useCallback(() => {
    const currentParams = searchParams.toString();
    const saveUrl = currentParams
      ? `/dashboard/saved-searches?save=true&${currentParams}`
      : `/dashboard/saved-searches?save=true`;
    router.push(saveUrl);
  }, [searchParams, router]);

  /** Check if any filters are active */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSourceTypes.length > 0) count++;
    if (selectedProjectTypes.length > 0) count++;
    if (currentKeyword) count++;
    if (currentDateFrom) count++;
    if (currentDateTo) count++;
    if (currentMinValue) count++;
    if (currentMaxValue) count++;
    if (currentRadius !== defaultRadius) count++;
    if (currentSortBy !== "score") count++;
    if (currentMatchOnly) count++;
    return count;
  }, [
    selectedSourceTypes,
    selectedProjectTypes,
    currentKeyword,
    currentDateFrom,
    currentDateTo,
    currentMinValue,
    currentMaxValue,
    currentRadius,
    defaultRadius,
    currentSortBy,
    currentMatchOnly,
  ]);

  const filterContent = (
    <div className="space-y-6">
      {/* Keyword search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Keyword Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search leads..."
            value={localKeyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Source type checkboxes */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Source Type</Label>
        <div className="grid grid-cols-1 gap-2">
          {SOURCE_TYPES.map(({ value, label }) => {
            const isSelected = selectedSourceTypes.includes(value);
            return (
              <label
                key={value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked: boolean) =>
                    handleSourceTypeToggle(value, checked)
                  }
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
        {selectedSourceTypes.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => navigate({ sourceTypes: null })}
          >
            Clear source filter
          </button>
        )}
      </div>

      {/* Distance slider */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Max Distance: {localRadius} miles
        </Label>
        <Slider
          min={10}
          max={2000}
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
          <span>2000 mi</span>
        </div>
      </div>

      {/* Value range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Value Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Min $</label>
            <Input
              type="number"
              placeholder="0"
              value={currentMinValue}
              onChange={(e) => handleValueChange("minValue", e.target.value)}
              min={0}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max $</label>
            <Input
              type="number"
              placeholder="No limit"
              value={currentMaxValue}
              onChange={(e) => handleValueChange("maxValue", e.target.value)}
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Project type (industry-specific specializations) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Project Type</Label>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
          {projectTypeOptions.map((type) => {
            const isSelected = selectedProjectTypes.includes(type);
            const isOrgSpecialization = specializations.includes(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked: boolean) =>
                    handleProjectTypeToggle(type, checked)
                  }
                />
                <span className={isOrgSpecialization ? "font-medium" : ""}>
                  {type}
                </span>
                {isOrgSpecialization && (
                  <span className="text-xs text-muted-foreground">(yours)</span>
                )}
              </label>
            );
          })}
        </div>
        {selectedProjectTypes.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => navigate({ projectTypes: null })}
          >
            Clear project type filter
          </button>
        )}
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Date Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={currentDateFrom ? currentDateFrom.slice(0, 10) : ""}
              onChange={(e) => handleDateChange("dateFrom", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={currentDateTo ? currentDateTo.slice(0, 10) : ""}
              onChange={(e) => handleDateChange("dateTo", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sort by */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sort By</Label>
        <div className="grid grid-cols-2 gap-2">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSortChange(value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                currentSortBy === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Matching specializations only toggle */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={currentMatchOnly}
            onCheckedChange={(checked: boolean) =>
              handleMatchOnlyToggle(checked)
            }
          />
          <span className="font-medium">My industry only</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Only show leads relevant to your industry
        </p>
      </div>

      {/* Save Search button */}
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={handleSaveSearch}
      >
        <Save className="size-4" />
        Save Search
      </Button>
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
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {activeFilterCount}
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
