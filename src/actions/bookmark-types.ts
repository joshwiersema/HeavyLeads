export const PIPELINE_STATUSES = [
  "saved",
  "contacted",
  "in_progress",
  "won",
  "lost",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface BookmarkWithLead {
  id: string;
  leadId: string;
  userId: string;
  organizationId: string;
  createdAt: Date;
  notes: string | null;
  pipelineStatus: string | null;
  // Lead fields
  title: string | null;
  address: string | null;
  formattedAddress: string | null;
  sourceType: string;
  estimatedValue: number | null;
  city: string | null;
  state: string | null;
}
