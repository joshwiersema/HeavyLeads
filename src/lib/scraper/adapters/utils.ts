/**
 * Shared utility functions for scraper adapters.
 *
 * extractLocation: Extracts city/state from text using pattern matching
 * isConstructionRelevant: Filters content by construction-related keywords
 */

/** US state abbreviations for validation */
const STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

/** Full state name -> abbreviation mapping */
const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

/**
 * Extract city and state from text using pattern matching.
 *
 * Patterns matched:
 * 1. "in City, ST" where ST is a 2-letter state code
 * 2. "in City, State Name" where State Name is a full state name
 * 3. "City, ST" at word boundaries
 */
export function extractLocation(text: string): { city?: string; state?: string } {
  if (!text) return {};

  // Pattern 1: "in City, ST" where ST is 2-letter state code
  const pattern1 = /\bin\s+([A-Z][a-zA-Z\s]+?),\s*([A-Z]{2})\b/;
  const match1 = text.match(pattern1);
  if (match1 && STATE_ABBREVIATIONS.has(match1[2])) {
    return { city: match1[1].trim(), state: match1[2] };
  }

  // Pattern 2: "in City, State Name"
  const pattern2 = /\bin\s+([A-Z][a-zA-Z\s]+?),\s*([A-Za-z\s]+?)(?:\.|,|\s{2}|\s+\w|$)/;
  const match2 = text.match(pattern2);
  if (match2) {
    const stateAbbr = STATE_NAMES[match2[2].trim().toLowerCase()];
    if (stateAbbr) {
      return { city: match2[1].trim(), state: stateAbbr };
    }
  }

  // Pattern 3: "City, ST" at word boundaries (no "in" prefix)
  const pattern3 = /\b([A-Z][a-zA-Z\s]+?),\s*([A-Z]{2})\b/;
  const match3 = text.match(pattern3);
  if (match3 && STATE_ABBREVIATIONS.has(match3[2])) {
    return { city: match3[1].trim(), state: match3[2] };
  }

  return {};
}

/** Construction-relevant keywords for filtering news and search results */
const CONSTRUCTION_KEYWORDS = [
  "construction",
  "building",
  "project",
  "groundbreaking",
  "equipment",
  "excavat",
  "crane",
  "contractor",
  "infrastructure",
  "demolition",
  "renovation",
  "commercial",
  "residential",
  "industrial",
  "highway",
  "bridge",
  "utility",
];

/**
 * Determine if content is relevant to the construction industry.
 * Returns true if title or description contains any construction keyword.
 */
export function isConstructionRelevant(
  title?: string,
  description?: string
): boolean {
  const text = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  return CONSTRUCTION_KEYWORDS.some((keyword) => text.includes(keyword));
}
