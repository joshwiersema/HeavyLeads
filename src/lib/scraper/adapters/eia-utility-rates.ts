import type { ScraperAdapter, RawLeadData } from "./base-adapter";
import { getEiaQueue } from "../api-rate-limiter";

/** EIA API v2 response shape */
interface EiaResponse {
  response: {
    data: EiaDataRecord[];
  };
}

interface EiaDataRecord {
  period: string;
  stateDescription: string;
  stateId: string;
  sectorName: string;
  price: number;
}

/**
 * State capitals for mapping EIA state-level data to a city.
 * Used to populate the `city` field in RawLeadData.
 */
const STATE_CAPITALS: Record<string, string> = {
  AL: "Montgomery", AK: "Juneau", AZ: "Phoenix", AR: "Little Rock",
  CA: "Sacramento", CO: "Denver", CT: "Hartford", DE: "Dover",
  FL: "Tallahassee", GA: "Atlanta", HI: "Honolulu", ID: "Boise",
  IL: "Springfield", IN: "Indianapolis", IA: "Des Moines", KS: "Topeka",
  KY: "Frankfort", LA: "Baton Rouge", ME: "Augusta", MD: "Annapolis",
  MA: "Boston", MI: "Lansing", MN: "Saint Paul", MS: "Jackson",
  MO: "Jefferson City", MT: "Helena", NE: "Lincoln", NV: "Carson City",
  NH: "Concord", NJ: "Trenton", NM: "Santa Fe", NY: "Albany",
  NC: "Raleigh", ND: "Bismarck", OH: "Columbus", OK: "Oklahoma City",
  OR: "Salem", PA: "Harrisburg", RI: "Providence", SC: "Columbia",
  SD: "Pierre", TN: "Nashville", TX: "Austin", UT: "Salt Lake City",
  VT: "Montpelier", VA: "Richmond", WA: "Olympia", WV: "Charleston",
  WI: "Madison", WY: "Cheyenne", DC: "Washington",
};

/**
 * EIA Utility Rate adapter.
 *
 * Fetches state-level residential electricity rates from the EIA Open Data
 * API v2. This data provides solar ROI context: higher utility rates make
 * solar installations more attractive to homeowners.
 *
 * Requires EIA_API_KEY environment variable. Gracefully returns [] when
 * the key is not set (same pattern as SAM.gov adapter).
 *
 * API docs: https://www.eia.gov/opendata/
 */
export class EiaUtilityRateAdapter implements ScraperAdapter {
  readonly sourceId = "eia-utility-rates";
  readonly sourceName = "EIA Residential Electricity Rates";
  readonly sourceType = "news" as const;

  private readonly endpoint =
    "https://api.eia.gov/v2/electricity/retail-sales/data/";

  async scrape(): Promise<RawLeadData[]> {
    const apiKey = process.env.EIA_API_KEY?.trim();
    if (!apiKey) {
      console.warn(
        "[EiaUtilityRateAdapter] EIA_API_KEY not set — skipping EIA scrape"
      );
      return [];
    }

    const queue = await getEiaQueue();

    try {
      return (await queue.add(async () => {
        const url = new URL(this.endpoint);
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("frequency", "annual");
        url.searchParams.set("data[0]", "price");
        url.searchParams.set("facets[sectorid][]", "RES");
        url.searchParams.set("sort[0][column]", "period");
        url.searchParams.set("sort[0][direction]", "desc");
        url.searchParams.set("length", "100");

        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.warn(
            `[EiaUtilityRateAdapter] API error: ${response.status} ${response.statusText}`
          );
          return [];
        }

        const data: EiaResponse = await response.json();
        const records = data.response?.data ?? [];

        return records.map((record): RawLeadData => ({
          title: `${record.stateDescription} Residential Electricity Rate: ${record.price} cents/kWh`,
          description: `${record.stateDescription} residential electricity price is ${record.price} cents/kWh (${record.period}). Higher rates increase solar ROI for homeowners considering installation.`,
          state: record.stateId,
          city: STATE_CAPITALS[record.stateId],
          sourceType: "news" as const,
          sourceUrl: `https://www.eia.gov/electricity/monthly/epm_table_5_6_a.html`,
          postedDate: new Date(`${record.period}-01-01`),
        }));
      })) as RawLeadData[];
    } catch (error) {
      console.warn(
        "[EiaUtilityRateAdapter] Fetch failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
}
