/** Result from a single adapter's scrape run */
export interface PipelineResult {
  sourceId: string;
  sourceName: string;
  recordsScraped: number;
  recordsStored: number;
  errors: string[];
  /** IDs of newly inserted leads (for downstream dedup processing) */
  newLeadIds?: string[];
}

/** Aggregated result from running all registered adapters */
export interface PipelineRunResult {
  results: PipelineResult[];
  startedAt: Date;
  completedAt: Date;
  /** Cross-source deduplication stats (present when dedup runs) */
  dedup?: { merged: number; kept: number };
}
