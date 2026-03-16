import type { ScraperAdapter, RawLeadData } from "./base-adapter";

/** FEMA Disaster Declaration record shape */
interface FemaDeclaration {
  disasterNumber: number;
  declarationDate: string;
  state: string;
  designatedArea: string;
  incidentType: string;
  declarationType: string;
  title: string;
}

/** FEMA API response shape */
interface FemaResponse {
  DisasterDeclarations: FemaDeclaration[];
}

/**
 * Incident types relevant to blue-collar industries (roofing, heavy equipment, etc.).
 * These disaster types create demand for construction, restoration, and repair services.
 */
const RELEVANT_INCIDENT_TYPES = [
  "Fire",
  "Flood",
  "Hurricane",
  "Severe Storm",
  "Tornado",
  "Earthquake",
];

/**
 * FEMA Disaster Declarations adapter.
 *
 * Fetches recent disaster declarations from the FEMA Open API,
 * filtering for incident types that create demand for roofing,
 * heavy equipment, and other blue-collar services.
 *
 * Declarations are state-level (no lat/lng) -- the pipeline's
 * geocoding step handles coordinate resolution from state.
 */
export class FemaDisasterAdapter implements ScraperAdapter {
  readonly sourceId = "fema-disaster-declarations";
  readonly sourceName = "FEMA Disaster Declarations";
  readonly sourceType = "disaster" as const;

  async scrape(): Promise<RawLeadData[]> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

      // Build incident type filter
      const incidentFilter = RELEVANT_INCIDENT_TYPES.map(
        (t) => `incidentType eq '${t}'`
      ).join(" or ");

      const params = new URLSearchParams({
        $filter: `declarationDate ge '${dateStr}' and (${incidentFilter})`,
        $select:
          "disasterNumber,declarationDate,state,designatedArea,incidentType,declarationType,title",
        $orderby: "declarationDate desc",
        $top: "1000",
      });

      const url = `https://www.fema.gov/api/open/v2/DisasterDeclarations?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `[fema-disaster] API returned ${response.status} ${response.statusText}`
        );
        return [];
      }

      const data: FemaResponse = await response.json();

      if (
        !data.DisasterDeclarations ||
        data.DisasterDeclarations.length === 0
      ) {
        return [];
      }

      const results: RawLeadData[] = [];

      for (const decl of data.DisasterDeclarations) {
        const lead: RawLeadData = {
          externalId: String(decl.disasterNumber),
          title: decl.title,
          description: `${decl.incidentType} - ${decl.designatedArea} (${decl.declarationType})`,
          sourceType: "disaster",
          state: decl.state,
          postedDate: new Date(decl.declarationDate),
          sourceUrl: `https://www.fema.gov/disaster/${decl.disasterNumber}`,
        };

        results.push(lead);
      }

      return results;
    } catch (error) {
      console.warn(
        "[fema-disaster] Fetch failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
}
