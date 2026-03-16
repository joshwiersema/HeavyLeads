import type { InferSelectModel } from "drizzle-orm";
import type { EquipmentType } from "@/types";
import type { leads } from "@/lib/db/schema/leads";
import type { LeadStatus } from "@/lib/db/schema/lead-statuses";
import type { ScoringResult } from "@/lib/scoring/types";

/** Equipment inferred from project type and description keywords */
export interface InferredEquipment {
  type: EquipmentType;
  confidence: "high" | "medium" | "low";
  reason: string;
}

/** Input to the lead scoring algorithm */
export interface ScoringInput {
  inferredEquipment: EquipmentType[];
  dealerEquipment: string[];
  distanceMiles: number;
  serviceRadiusMiles: number;
  estimatedValue: number | null;
}

/** A detected project phase mapped to equipment needs and urgency */
export interface TimelineWindow {
  phase: string;
  equipment: EquipmentType[];
  urgency: "Now" | "Soon" | "Later";
  description: string;
}

/** Age-based freshness indicator for a lead */
export type FreshnessBadge = "New" | "This Week" | "Older";

/** A lead row enriched with computed intelligence fields */
export interface EnrichedLead extends InferSelectModel<typeof leads> {
  distance: number | null;
  inferredEquipment: InferredEquipment[];
  score: number;
  freshness: FreshnessBadge;
  timeline: TimelineWindow[];
  /** Per-user lead status (defaults to "new" when no explicit status set) */
  status?: LeadStatus;
  /** Whether the current user has bookmarked this lead */
  isBookmarked?: boolean;
}

/** A lead enriched with per-subscriber scoring. Used by the new lead feed. */
export interface ScoredLead extends InferSelectModel<typeof leads> {
  distance: number | null;
  scoring: ScoringResult;
  freshness: FreshnessBadge;
  /** Per-user lead status (defaults to "new" when no explicit status set) */
  status?: LeadStatus;
  /** Whether the current user has bookmarked this lead */
  isBookmarked?: boolean;
}

/**
 * Returns a freshness badge based on how recently the lead was scraped.
 * - "New": scraped today (< 1 day ago)
 * - "This Week": scraped 1-7 days ago
 * - "Older": scraped more than 7 days ago
 */
export function getFreshnessBadge(scrapedAt: Date): FreshnessBadge {
  const now = new Date();
  const diffMs = now.getTime() - scrapedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "New";
  if (diffDays <= 7) return "This Week";
  return "Older";
}
