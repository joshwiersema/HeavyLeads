/** Result from a single adapter's scrape run */
export interface PipelineResult {
  sourceId: string;
  sourceName: string;
  recordsScraped: number;
  recordsStored: number;
  errors: string[];
}

/** Aggregated result from running all registered adapters */
export interface PipelineRunResult {
  results: PipelineResult[];
  startedAt: Date;
  completedAt: Date;
}
