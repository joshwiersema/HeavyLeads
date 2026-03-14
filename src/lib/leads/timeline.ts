import type { EquipmentType } from "@/types";
import type { TimelineWindow } from "./types";
import { INFERENCE_RULES } from "./equipment-inference";

/**
 * Mapping of construction phases to urgency levels and descriptions.
 * Urgency reflects when the equipment is typically needed relative to project start.
 */
const PHASE_TIMELINE: Record<
  string,
  { urgency: "Now" | "Soon" | "Later"; description: string }
> = {
  "Site Preparation": {
    urgency: "Now",
    description: "Equipment needed immediately for site work",
  },
  Foundation: {
    urgency: "Now",
    description: "Equipment needed for foundation work",
  },
  "Framing/Structural": {
    urgency: "Soon",
    description: "Equipment needed once framing begins",
  },
  "Exterior/Roofing": {
    urgency: "Soon",
    description: "Equipment needed for exterior work",
  },
  "Interior Finishing": {
    urgency: "Later",
    description: "Equipment needed during finish phase",
  },
  "Paving/Roadwork": {
    urgency: "Now",
    description: "Equipment needed for paving operations",
  },
  Landscaping: {
    urgency: "Later",
    description: "Equipment needed for final site landscaping",
  },
  "Commercial Construction": {
    urgency: "Now",
    description: "Equipment needed throughout project",
  },
  "Residential Construction": {
    urgency: "Now",
    description: "Equipment needed for build",
  },
};

/**
 * Detects construction project phases from project type and description keywords,
 * then maps each detected phase to a timeline window with equipment needs and urgency.
 *
 * Uses the same keyword rules as equipment inference (INFERENCE_RULES) to detect phases.
 * Only rules that have a `phase` field produce timeline windows.
 *
 * Returns an empty array when no phase keywords are detected.
 */
export function mapTimeline(
  projectType: string | null,
  description: string | null
): TimelineWindow[] {
  const ptLower = (projectType ?? "").toLowerCase();
  const descLower = (description ?? "").toLowerCase();

  const detectedPhases = new Set<string>();
  const phaseEquipment = new Map<string, EquipmentType[]>();

  for (const rule of INFERENCE_RULES) {
    // Skip rules without a phase mapping
    if (!rule.phase) continue;

    for (const keyword of rule.keywords) {
      if (ptLower.includes(keyword) || descLower.includes(keyword)) {
        detectedPhases.add(rule.phase);
        phaseEquipment.set(rule.phase, rule.equipment);
        break; // One keyword match per rule is enough
      }
    }
  }

  const windows: TimelineWindow[] = [];

  for (const phase of detectedPhases) {
    const timeline = PHASE_TIMELINE[phase];
    if (!timeline) continue;

    windows.push({
      phase,
      equipment: phaseEquipment.get(phase) ?? [],
      urgency: timeline.urgency,
      description: timeline.description,
    });
  }

  return windows;
}
