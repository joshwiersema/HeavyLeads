import { createHash } from "crypto";

/**
 * Compute a SHA-256 content hash for deduplication based on source type.
 *
 * Each source type uses different fields to construct its identity:
 * - permit: "sourceId:permitNumber"
 * - bid: "sourceId:externalId:title"
 * - news / deep-web: sourceUrl
 *
 * Returns null when required fields are missing or source type is unknown.
 * All inputs are lowercased and trimmed before hashing.
 */
export function computeContentHash(record: {
  sourceType: string;
  sourceId?: string;
  permitNumber?: string;
  externalId?: string;
  title?: string;
  sourceUrl?: string;
}): string | null {
  const { sourceType } = record;

  let raw: string | null = null;

  switch (sourceType) {
    case "permit": {
      const sourceId = record.sourceId?.trim();
      const permitNumber = record.permitNumber?.trim();
      if (!permitNumber) return null;
      raw = `${sourceId ?? ""}:${permitNumber}`;
      break;
    }
    case "bid": {
      const sourceId = record.sourceId?.trim();
      const externalId = record.externalId?.trim();
      const title = record.title?.trim();
      raw = `${sourceId ?? ""}:${externalId ?? ""}:${title ?? ""}`;
      break;
    }
    case "news":
    case "deep-web": {
      const sourceUrl = record.sourceUrl?.trim();
      if (!sourceUrl) return null;
      raw = sourceUrl;
      break;
    }
    case "storm":
    case "disaster": {
      const sourceId = record.sourceId?.trim();
      const externalId = record.externalId?.trim();
      if (!externalId) return null;
      raw = `${sourceId ?? ""}:${externalId}`;
      break;
    }
    default:
      return null;
  }

  return createHash("sha256").update(raw.toLowerCase()).digest("hex");
}
