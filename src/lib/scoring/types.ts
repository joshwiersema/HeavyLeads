import type { Industry } from "@/lib/onboarding/types";

export interface OrgScoringContext {
  industry: Industry;
  hqLat: number;
  hqLng: number;
  serviceRadiusMiles: number;
  specializations: string[];
  preferredLeadTypes: string[];
  targetProjectValueMin: number | null;
  targetProjectValueMax: number | null;
}

export interface LeadScoringInput {
  lat: number | null;
  lng: number | null;
  projectType: string | null;
  sourceType: string;
  applicableIndustries: string[];
  estimatedValue: number | null;
  valueTier: string | null;
  severity: string | null;
  deadline: Date | null;
  scrapedAt: Date;
}

export interface ScoreDimension {
  name: string;
  score: number;
  maxScore: number;
  reasons: string[];
}

export interface ScoringResult {
  total: number;
  dimensions: ScoreDimension[];
  matchReasons: string[];
}
