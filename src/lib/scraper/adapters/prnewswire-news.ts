import Parser from "rss-parser";
import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { extractLocation, isConstructionRelevant } from "./utils";

/**
 * PR Newswire Construction news RSS feed adapter.
 *
 * Parses PR Newswire's construction/building RSS feed for press releases
 * about construction projects, groundbreakings, and contractor activity.
 *
 * Feed URL: https://www.prnewswire.com/rss/construction-building-news.rss
 */
export class PrNewswireNewsAdapter implements ScraperAdapter {
  readonly sourceId = "prnewswire-news";
  readonly sourceName = "PR Newswire Construction";
  readonly sourceType = "news" as const;

  private readonly feedUrls = [
    "https://www.prnewswire.com/rss/construction-building-news.rss",
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
          `[PrNewswireNewsAdapter] Error parsing feed ${feedUrl}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    return results;
  }
}
