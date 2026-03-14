import Parser from "rss-parser";
import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { extractLocation, isConstructionRelevant } from "./utils";

/**
 * Engineering News-Record (ENR) RSS feed adapter.
 *
 * Parses ENR RSS feeds for construction industry news, filtering for
 * construction-relevant articles and extracting location data from text.
 *
 * Feed URLs:
 * - https://www.enr.com/rss/1 (Main ENR feed)
 * - https://www.enr.com/rss/11 (Texas & Louisiana)
 * - https://www.enr.com/rss/9 (Southeast)
 */
export class EnrNewsAdapter implements ScraperAdapter {
  readonly sourceId = "enr-news";
  readonly sourceName = "Engineering News-Record";
  readonly sourceType = "news" as const;

  private readonly feedUrls = [
    "https://www.enr.com/rss/1",
    "https://www.enr.com/rss/11",
    "https://www.enr.com/rss/9",
  ];

  async scrape(): Promise<RawLeadData[]> {
    const parser = new Parser({
      headers: {
        Accept: "application/rss+xml, application/xml",
      },
    });
    const results: RawLeadData[] = [];

    for (const feedUrl of this.feedUrls) {
      try {
        const feed = await parser.parseURL(feedUrl);

        for (const item of feed.items) {
          if (!isConstructionRelevant(item.title, item.contentSnippet)) {
            continue;
          }

          const location = extractLocation(
            `${item.title ?? ""} ${item.contentSnippet ?? ""}`
          );

          results.push({
            title: item.title,
            description: item.contentSnippet,
            sourceUrl: item.link,
            externalId: item.link,
            sourceType: "news" as const,
            postedDate: item.pubDate
              ? new Date(item.pubDate)
              : undefined,
            city: location.city,
            state: location.state,
          });
        }
      } catch (error) {
        console.warn(
          `[EnrNewsAdapter] Error parsing feed ${feedUrl}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return results;
  }
}
