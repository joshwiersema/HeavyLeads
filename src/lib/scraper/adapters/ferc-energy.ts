import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getFercQueue } from "../api-rate-limiter";
import { extractLocation } from "./utils";

/**
 * Construction-related keywords for filtering FERC filings.
 * Only filings containing these terms are relevant to construction leads.
 */
const CONSTRUCTION_KEYWORDS = [
  "construction",
  "pipeline",
  "power plant",
  "transmission",
  "substation",
  "facility",
  "infrastructure",
  "lng",
  "solar",
  "wind",
  "hydroelectric",
  "generation",
  "terminal",
  "compressor station",
];

/**
 * FERC Energy Infrastructure Filings adapter.
 *
 * Fetches recent energy infrastructure filings from the FERC eLibrary
 * RSS feed, filtering for construction-related terms (pipeline,
 * power plant, transmission, substation, etc.).
 *
 * No authentication required -- FERC eLibrary is public.
 * Uses RSS feed for structured data. Falls back to XML search
 * endpoint if RSS fails.
 *
 * API docs: https://elibrary.ferc.gov/eLibrary/
 */
export class FercEnergyAdapter implements ScraperAdapter {
  readonly sourceId = "ferc-energy";
  readonly sourceName = "FERC Energy Infrastructure Filings";
  readonly sourceType = "energy" as const;

  /** FERC eLibrary RSS feed for recent issuances */
  private readonly rssEndpoint =
    "https://elibrary.ferc.gov/eLibrary/filelist?docket_number=&accession_number=&category=issuance&resultFormat=rss";

  /** Fallback: FERC eLibrary XML search */
  private readonly xmlEndpoint =
    "https://elibrary.ferc.gov/eLibrary/search?docket_number=&category=issuance&resultFormat=xml";

  async scrape(): Promise<RawLeadData[]> {
    try {
      const queue = await getFercQueue();

      // Try RSS feed first
      let items = await queue.add(() => this.fetchRss(this.rssEndpoint));

      // Fallback to XML search if RSS returned nothing
      if (!items || items.length === 0) {
        items = await queue.add(() => this.fetchRss(this.xmlEndpoint));
      }

      if (!items || items.length === 0) {
        return [];
      }

      // Filter for construction-relevant filings
      const constructionItems = items.filter((item) =>
        this.isConstructionRelated(item.title, item.description)
      );

      const results: RawLeadData[] = [];

      for (const item of constructionItems) {
        const location = extractLocation(
          `${item.title} ${item.description}`
        );

        // Extract docket number from link or generate stable ID
        const externalId = this.extractDocketNumber(item.link) ??
          `ferc-${this.simpleHash(item.link || item.title)}`;

        results.push({
          externalId,
          title: item.title.slice(0, 200),
          description: this.stripHtml(item.description).slice(0, 500),
          postedDate: item.pubDate ? new Date(item.pubDate) : undefined,
          sourceUrl: item.link || undefined,
          sourceType: "energy" as const,
          city: location.city,
          state: location.state,
        });
      }

      return results;
    } catch (error) {
      console.warn(
        "[FercEnergyAdapter] Scrape failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Fetch and parse RSS/XML response from FERC eLibrary.
   * Uses regex-based XML parsing (no external dependencies).
   */
  private async fetchRss(
    url: string
  ): Promise<
    { title: string; link: string; description: string; pubDate: string }[]
  > {
    const response = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "GroundPulse/1.0 (construction lead aggregator)",
      },
    });

    if (!response.ok) {
      console.warn(
        `[FercEnergyAdapter] FERC eLibrary returned ${response.status} ${response.statusText}`
      );
      return [];
    }

    const xml = await response.text();

    if (!xml || xml.length === 0) {
      return [];
    }

    // Parse RSS <item> elements using regex
    const items: {
      title: string;
      link: string;
      description: string;
      pubDate: string;
    }[] = [];

    const itemRegex =
      /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const title = this.extractXmlTag(itemXml, "title");
      const link = this.extractXmlTag(itemXml, "link");
      const description = this.extractXmlTag(itemXml, "description");
      const pubDate = this.extractXmlTag(itemXml, "pubDate");

      if (title) {
        items.push({
          title,
          link: link || "",
          description: description || "",
          pubDate: pubDate || "",
        });
      }
    }

    return items;
  }

  /**
   * Extract text content from an XML tag.
   * Handles CDATA sections and basic entity decoding.
   */
  private extractXmlTag(xml: string, tag: string): string {
    const regex = new RegExp(
      `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/${tag}>`,
      "i"
    );
    const match = xml.match(regex);
    if (!match) return "";
    const content = match[1] ?? match[2] ?? "";
    return content
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Check if filing title/description contains construction-related keywords.
   */
  private isConstructionRelated(title: string, description: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    return CONSTRUCTION_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  /**
   * Extract docket number from FERC eLibrary URL.
   * Docket numbers follow patterns like "CP21-94" or "ER22-1234".
   */
  private extractDocketNumber(url: string): string | null {
    if (!url) return null;
    const match = url.match(/([A-Z]{2}\d{2}-\d+)/);
    return match ? `ferc-${match[1]}` : null;
  }

  /** Strip HTML tags from a string. */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * Simple string hash for generating stable external IDs.
   * Not cryptographic -- just for deduplication.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(36);
  }
}
