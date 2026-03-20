import { compareTwoStrings } from "string-similarity";
import { haversineDistance } from "@/lib/leads/queries";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { eq, and, sql, ne, isNotNull } from "drizzle-orm";

/** Maximum distance in miles for two leads to be considered duplicates */
export const PROXIMITY_THRESHOLD_MILES = 0.1;

/** Minimum Dice coefficient similarity for address or title match */
export const SIMILARITY_THRESHOLD = 0.7;

/**
 * Normalize text for comparison: lowercase, strip non-alphanumeric
 * characters (except spaces), and trim whitespace.
 */
export function normalizeText(text: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Normalize permit numbers for cross-source comparison.
 * Strips common prefixes like "BP-", "BLD-", "BLDG-", "COM-", "RES-",
 * removes dashes and spaces, lowercases.
 * E.g., "BP-2024-12345" and "2024-12345" and "202412345" all normalize
 * to "202412345".
 */
export function normalizePermitNumber(pn: string | null): string {
  if (!pn) return "";
  return pn
    .toLowerCase()
    .replace(/^(bldg|bld|bp|com|res|pmt|permit)[- ]*/i, "")
    .replace(/[-\s]/g, "")
    .trim();
}

/** Shape of lead data used for duplicate comparison */
interface DedupCandidate {
  lat: number | null;
  lng: number | null;
  normalizedAddress: string;
  normalizedTitle: string;
  normalizedPermitNumber: string;
  permitDate: Date | null;
  sourceId: string;
}

/**
 * Determine whether two leads are likely duplicates of the same
 * real-world project.
 *
 * Requires geographic proximity (within PROXIMITY_THRESHOLD_MILES) as a
 * prerequisite, then checks three matching paths:
 *   1. Permit number similarity (> 0.8) -- catches cross-source duplicates
 *   2. Text similarity (address OR title > SIMILARITY_THRESHOLD)
 *   3. Date proximity (within 3 days) + address similarity (> 0.5) --
 *      catches cross-portal duplicates with slightly different formatting
 *
 * Returns false immediately if either lead lacks coordinates --
 * geographic comparison is required for dedup.
 */
export function isLikelyDuplicate(a: DedupCandidate, b: DedupCandidate): boolean {
  // Cannot dedup without coordinates on both leads
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return false;
  }

  // Step 1: Geographic proximity check (prerequisite for all matching paths)
  const distance = haversineDistance(a.lat, a.lng, b.lat, b.lng);
  if (distance > PROXIMITY_THRESHOLD_MILES) {
    return false;
  }

  // Step 2a: Permit number match (cross-source signal)
  if (a.normalizedPermitNumber && b.normalizedPermitNumber) {
    const permitSim = compareTwoStrings(a.normalizedPermitNumber, b.normalizedPermitNumber);
    if (permitSim > 0.8) return true;
  }

  // Step 2b: Original text similarity (address OR title)
  const addressSim = compareTwoStrings(a.normalizedAddress, b.normalizedAddress);
  const titleSim = compareTwoStrings(a.normalizedTitle, b.normalizedTitle);
  if (addressSim > SIMILARITY_THRESHOLD || titleSim > SIMILARITY_THRESHOLD) {
    return true;
  }

  // Step 2c: Date + address compound match (cross-source signal)
  if (a.permitDate && b.permitDate) {
    const daysDiff = Math.abs(a.permitDate.getTime() - b.permitDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 3 && addressSim > 0.5) {
      return true;
    }
  }

  return false;
}

/**
 * Post-pipeline deduplication step. For each newly inserted lead,
 * check against existing leads for duplicates and merge when found.
 *
 * Strategy:
 * 1. For each new lead, fetch its data from the DB
 * 2. Skip leads without coordinates (cannot dedup geographically)
 * 3. Find candidate leads within a bounding box (~0.15 miles)
 * 4. Run isLikelyDuplicate against each candidate
 * 5. If match found, merge the new lead into the existing canonical lead
 *
 * @returns Counts of merged and kept leads
 */
export async function deduplicateNewLeads(
  newLeadIds: string[]
): Promise<{ merged: number; kept: number }> {
  let merged = 0;
  let kept = 0;

  for (const newId of newLeadIds) {
    // Fetch the new lead
    const newLeadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, newId))
      .limit(1);

    if (newLeadRows.length === 0) continue;

    const lead = newLeadRows[0];

    // Skip leads without coordinates -- cannot dedup geographically
    if (lead.lat == null || lead.lng == null) {
      kept++;
      continue;
    }

    // Find candidate leads within a bounding box approximation (~0.15 miles)
    // 0.002 degrees lat ~= 0.14 miles at any latitude
    // 0.002 degrees lng ~= 0.14 miles at ~45 deg latitude (conservative)
    const candidates = await db
      .select()
      .from(leads)
      .where(
        and(
          ne(leads.id, newId),
          isNotNull(leads.lat),
          isNotNull(leads.lng),
          sql`${leads.lat} BETWEEN ${lead.lat - 0.002} AND ${lead.lat + 0.002}`,
          sql`${leads.lng} BETWEEN ${lead.lng - 0.002} AND ${lead.lng + 0.002}`
        )
      );

    let matchedLeadId: string | null = null;

    for (const candidate of candidates) {
      if (candidate.lat == null || candidate.lng == null) continue;

      const a: DedupCandidate = {
        lat: lead.lat,
        lng: lead.lng,
        normalizedAddress: normalizeText(lead.address),
        normalizedTitle: normalizeText(lead.title),
        normalizedPermitNumber: normalizePermitNumber(lead.permitNumber),
        permitDate: lead.permitDate,
        sourceId: lead.sourceId,
      };

      const b: DedupCandidate = {
        lat: candidate.lat,
        lng: candidate.lng,
        normalizedAddress: normalizeText(candidate.address),
        normalizedTitle: normalizeText(candidate.title),
        normalizedPermitNumber: normalizePermitNumber(candidate.permitNumber),
        permitDate: candidate.permitDate,
        sourceId: candidate.sourceId,
      };

      if (isLikelyDuplicate(a, b)) {
        matchedLeadId = candidate.id;
        break;
      }
    }

    if (matchedLeadId) {
      const isCrossSource = lead.sourceId !== candidates.find(c => c.id === matchedLeadId)?.sourceId;
      await mergeLeads(matchedLeadId, newId);
      merged++;
      console.log(
        `[dedup] ${isCrossSource ? 'Cross-source merged' : 'Merged'} lead ${newId} into ${matchedLeadId}`
      );
    } else {
      kept++;
    }
  }

  return { merged, kept };
}

/**
 * Merge a duplicate lead into its canonical lead.
 *
 * 1. Transfer all lead_sources entries from the duplicate to the canonical lead
 * 2. Delete the duplicate lead row
 *
 * Executed as sequential queries (neon-http driver does not support
 * transactions). The order ensures referential integrity: sources are
 * moved before the duplicate row is deleted.
 */
async function mergeLeads(
  canonicalId: string,
  duplicateId: string
): Promise<void> {
  // Transfer source references to canonical lead
  await db
    .update(leadSources)
    .set({ leadId: canonicalId })
    .where(eq(leadSources.leadId, duplicateId));

  // Delete the duplicate lead row
  await db.delete(leads).where(eq(leads.id, duplicateId));
}
