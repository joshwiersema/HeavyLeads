import type { SavedSearchRow } from "@/actions/saved-searches";

/**
 * Pure function that converts a saved search row into a URLSearchParams string
 * for applying as dashboard filters.
 *
 * Maps:
 * - equipmentFilter -> "equipment" (comma-separated)
 * - radiusMiles -> "radius"
 * - keyword -> "keyword"
 * - dateFrom -> "dateFrom" (ISO string)
 * - dateTo -> "dateTo" (ISO string)
 * - minProjectSize -> "minProjectSize"
 * - maxProjectSize -> "maxProjectSize"
 *
 * Skips null/undefined values.
 */
export function savedSearchToParams(search: SavedSearchRow): string {
  const params = new URLSearchParams();

  if (search.equipmentFilter && search.equipmentFilter.length > 0) {
    params.set("equipment", search.equipmentFilter.join(","));
  }

  if (search.radiusMiles != null) {
    params.set("radius", String(search.radiusMiles));
  }

  if (search.keyword) {
    params.set("keyword", search.keyword);
  }

  if (search.dateFrom) {
    params.set("dateFrom", new Date(search.dateFrom).toISOString());
  }

  if (search.dateTo) {
    params.set("dateTo", new Date(search.dateTo).toISOString());
  }

  if (search.minProjectSize != null) {
    params.set("minProjectSize", String(search.minProjectSize));
  }

  if (search.maxProjectSize != null) {
    params.set("maxProjectSize", String(search.maxProjectSize));
  }

  return params.toString();
}
