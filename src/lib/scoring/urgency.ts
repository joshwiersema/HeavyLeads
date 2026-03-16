import type { LeadScoringInput, ScoreDimension } from "./types";

/**
 * Scores urgency signals on a lead. Takes the highest-scoring signal.
 *
 * Signals (max 10 pts):
 *   storm + deadline <48h          = 10pts "Active storm alert"
 *   bid + deadline <14d            = 10pts "Bid deadline in N days"
 *   severity === "violation"       = 8pts  "Code violation -- mandatory fix"
 *   sourceType === "permit"        = 5pts  "Active building permit"
 *   incentive + deadline <30d      = 10pts "Incentive expiring in N days"
 *   default                        = 0pts
 */
export function scoreUrgency(lead: LeadScoringInput): ScoreDimension {
  const dim: ScoreDimension = {
    name: "urgency",
    score: 0,
    maxScore: 10,
    reasons: [],
  };

  const now = new Date();
  const deadlineDiffMs =
    lead.deadline != null ? lead.deadline.getTime() - now.getTime() : null;
  const deadlineDays =
    deadlineDiffMs != null ? deadlineDiffMs / (1000 * 60 * 60 * 24) : null;

  // Collect all applicable urgency signals with their scores
  interface UrgencySignal {
    score: number;
    reason: string;
  }
  const signals: UrgencySignal[] = [];

  // Storm within 48h
  if (
    lead.sourceType === "storm" &&
    deadlineDays != null &&
    deadlineDays >= 0 &&
    deadlineDays <= 2
  ) {
    signals.push({ score: 10, reason: "Active storm alert" });
  }

  // Bid deadline within 14 days
  if (
    lead.sourceType === "bid" &&
    deadlineDays != null &&
    deadlineDays >= 0 &&
    deadlineDays <= 14
  ) {
    signals.push({
      score: 10,
      reason: `Bid deadline in ${Math.ceil(deadlineDays)} days`,
    });
  }

  // Expiring incentive within 30 days
  if (
    lead.sourceType === "incentive" &&
    deadlineDays != null &&
    deadlineDays >= 0 &&
    deadlineDays <= 30
  ) {
    signals.push({
      score: 10,
      reason: `Incentive expiring in ${Math.ceil(deadlineDays)} days`,
    });
  }

  // Code violation
  if (lead.severity === "violation") {
    signals.push({ score: 8, reason: "Code violation -- mandatory fix" });
  }

  // Active building permit
  if (lead.sourceType === "permit") {
    signals.push({ score: 5, reason: "Active building permit" });
  }

  // Pick the highest signal
  if (signals.length > 0) {
    const best = signals.reduce((a, b) => (a.score >= b.score ? a : b));
    dim.score = best.score;
    dim.reasons.push(best.reason);
  }

  return dim;
}
