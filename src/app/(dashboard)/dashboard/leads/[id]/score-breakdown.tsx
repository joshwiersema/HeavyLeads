"use client";

import type { ScoringResult } from "@/lib/scoring/types";

interface ScoreBreakdownProps {
  scoring: ScoringResult;
}

function getScoreColor(total: number): string {
  if (total >= 70) return "text-green-600";
  if (total >= 40) return "text-yellow-600";
  return "text-gray-500";
}

function getBarColor(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct > 0.7) return "bg-green-500";
  if (pct > 0.4) return "bg-yellow-500";
  return "bg-gray-400";
}

export function ScoreBreakdown({ scoring }: ScoreBreakdownProps) {
  return (
    <div className="space-y-5">
      {/* Large score number */}
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${getScoreColor(scoring.total)}`}>
          {scoring.total}
        </span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-3">
        {scoring.dimensions.map((dim) => {
          const pct =
            dim.maxScore > 0 ? (dim.score / dim.maxScore) * 100 : 0;
          return (
            <div key={dim.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{dim.name}</span>
                <span className="text-muted-foreground">
                  {dim.score}/{dim.maxScore}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${getBarColor(dim.score, dim.maxScore)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {dim.reasons.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {dim.reasons.join("; ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Match reasons */}
      {scoring.matchReasons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Match Reasons</h4>
          <ul className="list-disc pl-4 space-y-1">
            {scoring.matchReasons.map((reason, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
