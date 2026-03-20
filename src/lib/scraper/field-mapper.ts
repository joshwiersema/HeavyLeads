/**
 * Heuristic field mapper for Socrata open data portals.
 *
 * Maps arbitrary column names from Socrata datasets to canonical lead fields
 * using alias-based heuristics. This eliminates the need for per-city
 * TypeScript adapter files -- new portals can be scraped by simply storing
 * the inferred mapping in the data_portals table.
 *
 * Usage:
 *   const columns = ["permit_number", "issue_date", "permit_location", ...];
 *   const { mapping, confidence, unmapped } = inferFieldMapping(columns);
 *   // mapping: { permitNumber: "permit_number", permitDate: "issue_date", ... }
 *   // confidence: 0.78 (7 of 9 canonical fields mapped)
 *   // unmapped: ["some_other_column"]
 */

/**
 * Canonical field mapping shape matching SocrataConfig.fieldMap.
 * All fields are optional since not every dataset has every column.
 */
export interface FieldMapping {
  permitNumber?: string;
  description?: string;
  address?: string;
  projectType?: string;
  estimatedValue?: string;
  applicantName?: string;
  permitDate?: string;
  latitude?: string;
  longitude?: string;
}

/**
 * Known aliases for each canonical field, all lowercased.
 *
 * Order matters within each array: first match wins, so more specific
 * aliases (e.g., "permit_number") come before generic ones (e.g., "record_id").
 */
export const FIELD_ALIASES: Record<keyof FieldMapping, readonly string[]> = {
  permitNumber: [
    "permit_number",
    "permit_no",
    "permit_num",
    "permitnumber",
    "permit_id",
    "permit_nbr",
    "record_number",
    "record_id",
    "application_number",
    "case_number",
    "case_id",
  ],
  description: [
    "description",
    "work_description",
    "scope_of_work",
    "project_description",
    "permit_description",
    "comments",
    "work_desc",
  ],
  address: [
    "address",
    "location",
    "permit_location",
    "street_address",
    "site_address",
    "project_address",
    "original_address",
    "full_address",
    "property_address",
    "loc",
  ],
  projectType: [
    "permit_type",
    "permit_type_desc",
    "work_type",
    "type",
    "permit_class",
    "permit_category",
    "work_class",
    "construction_type",
    "project_type",
  ],
  estimatedValue: [
    "valuation",
    "project_valuation",
    "estimated_cost",
    "value",
    "total_valuation",
    "estimated_value",
    "job_value",
    "construction_value",
    "total_value",
    "cost",
  ],
  applicantName: [
    "applicant_name",
    "applicant_full_name",
    "applicant",
    "contractor",
    "contractor_name",
    "owner_name",
    "owner",
    "contact_name",
  ],
  permitDate: [
    "issue_date",
    "issued_date",
    "permit_date",
    "date_issued",
    "date_filed",
    "issueddate",
    "filing_date",
    "approval_date",
    "created_date",
  ],
  latitude: ["latitude", "lat", "y", "y_coord", "y_coordinate"],
  longitude: ["longitude", "lng", "lon", "x", "x_coord", "x_coordinate"],
} as const;

/** Total number of canonical fields used for confidence calculation */
const CANONICAL_FIELD_COUNT = 9;

/**
 * Priority order for canonical fields when resolving ambiguous column matches.
 * Identity and required fields are processed first to ensure they get priority
 * over optional fields when a column name could match multiple canonical fields.
 */
const FIELD_PRIORITY: (keyof FieldMapping)[] = [
  "permitNumber",
  "address",
  "permitDate",
  "description",
  "projectType",
  "latitude",
  "longitude",
  "estimatedValue",
  "applicantName",
];

/**
 * Infer a field mapping from a list of Socrata dataset column names.
 *
 * @param columns - Array of column names from the dataset metadata
 * @returns Object with mapping, confidence score (0-1), and unmapped column names
 */
export function inferFieldMapping(columns: string[]): {
  mapping: FieldMapping;
  confidence: number;
  unmapped: string[];
} {
  if (columns.length === 0) {
    return { mapping: {}, confidence: 0, unmapped: [] };
  }

  const mapping: FieldMapping = {};
  const matchedColumns = new Set<string>();

  // Lowercase all input columns for matching, but preserve original names
  const lowerToOriginal = new Map<string, string>();
  for (const col of columns) {
    lowerToOriginal.set(col.toLowerCase(), col);
  }

  // Process fields in priority order
  for (const canonicalField of FIELD_PRIORITY) {
    const aliases = FIELD_ALIASES[canonicalField];

    for (const alias of aliases) {
      const original = lowerToOriginal.get(alias);
      if (original && !matchedColumns.has(original)) {
        mapping[canonicalField] = original;
        matchedColumns.add(original);
        break;
      }
    }
  }

  // Count mapped fields
  const mappedCount = Object.keys(mapping).length;

  // Determine unmapped columns
  const unmapped = columns.filter((col) => !matchedColumns.has(col));

  // Confidence = mapped canonical fields / total canonical fields
  const confidence =
    Math.round((mappedCount / CANONICAL_FIELD_COUNT) * 100) / 100;

  return { mapping, confidence, unmapped };
}
