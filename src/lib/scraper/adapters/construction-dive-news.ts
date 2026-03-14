import Parser from "rss-parser";
import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { extractLocation, isConstructionRelevant } from "./utils";

/**
 * Construction Dive RSS feed adapter.
 *
 * Parses Construction Dive's news RSS feed for construction-relevant
 * articles and extracts location data from text.
 *
 * Feed URL: https://www.constructiondive.com/feeds/news/
 */
export class ConstructionDiveNewsAdapter implements ScraperAdapter {
  readonly sourceId = "construction-dive-news";
  readonly sourceName = "Construction Dive";
  readonly sourceType = "news" as const;

  private readonly feedUrls = [
    "https://www.constructiondive.com/feeds/news/",
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
          `[ConstructionDiveNewsAdapter] Error parsing feed ${feedUrl}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return results;
  }
}
