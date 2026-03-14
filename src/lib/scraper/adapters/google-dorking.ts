import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { extractLocation } from "./utils";

/**
 * Google dorking adapter using Serper.dev API.
 *
 * Sends construction-specific search queries to Serper.dev and returns
 * search result metadata (title, snippet, URL) as deep-web leads.
 *
 * IMPORTANT: This adapter only stores search result metadata. It does NOT
 * follow links to scrape third-party sites. This is a deliberate legal
 * safety measure -- storing search snippets from Serper.dev is fair use,
 * but scraping the target sites could violate their ToS.
 *
 * Requires SERPER_API_KEY environment variable.
 * Gracefully returns [] when key is missing or on API error.
 *
 * Query rotation: Uses day-of-year to determine which queries to run,
 * ensuring coverage of all query templates over multiple days while
 * staying within the daily query budget.
 */
export class GoogleDorkingAdapter implements ScraperAdapter {
  readonly sourceId = "google-dorking";
  readonly sourceName = "Google Deep Web Search";
  readonly sourceType = "deep-web" as const;

  private readonly endpoint = "https://google.serper.dev/search";

  /** Maximum number of Serper API calls per daily scrape run */
  static readonly DAILY_QUERY_BUDGET = 50;

  /** Construction-focused Google dorking query templates */
  private readonly queries = [
    'site:linkedin.com/jobs "heavy equipment" OR "construction equipment" operator',
    '"groundbreaking ceremony" construction project 2026',
    '"contract awarded" construction "million" -news',
    'filetype:pdf "request for proposal" construction equipment',
    'intitle:"bid results" construction heavy equipment',
    '"equipment rental" "new location" OR "expanding" construction',
    '"project approved" construction commercial residential',
  ];

  async scrape(): Promise<RawLeadData[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      console.warn(
        "[GoogleDorkingAdapter] SERPER_API_KEY not set — skipping Google dorking scrape"
      );
      return [];
    }

    const results: RawLeadData[] = [];
    const totalQueries = this.queries.length;

    // Rotate through queries using day-of-year as offset
    const dayOfYear = getDayOfYear(new Date());
    const startIndex = dayOfYear % totalQueries;

    // Determine how many queries to run (capped by budget and total available)
    const queriesToRun = Math.min(
      GoogleDorkingAdapter.DAILY_QUERY_BUDGET,
      totalQueries
    );

    for (let i = 0; i < queriesToRun; i++) {
      const queryIndex = (startIndex + i) % totalQueries;
      const query = this.queries[queryIndex];

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query, num: 20 }),
        });

        if (!response.ok) {
          console.warn(
            `[GoogleDorkingAdapter] Serper API error for query "${query.slice(0, 50)}...": ${response.status}`
          );
          continue;
        }

        const data = await response.json();
        const organic = data.organic ?? [];

        for (const result of organic) {
          const location = extractLocation(result.snippet ?? "");

          results.push({
            title: result.title,
            description: result.snippet,
            sourceUrl: result.link,
            externalId: result.link,
            sourceType: "deep-web" as const,
            postedDate: result.date ? new Date(result.date) : undefined,
            city: location.city,
            state: location.state,
          });
        }

        // Brief delay between Serper API calls to be respectful
        if (i < queriesToRun - 1) {
          await delay(100);
        }
      } catch (error) {
        console.warn(
          `[GoogleDorkingAdapter] Error for query "${query.slice(0, 50)}...":`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return results;
  }
}

/** Get the day of the year (1-366) for query rotation */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/** Promise-based delay */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
