import {
  sql,
  getTableColumns,
  and,
  isNotNull,
  eq,
  desc,
  asc,
  ilike,
  gte,
  lte,
  or,
  inArray,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { leadSources } from "@/lib/db/schema/lead-sources";
import { leadStatuses } from "@/lib/db/schema/lead-statuses";
import { bookmarks } from "@/lib/db/schema/bookmarks";
import { inferEquipmentNeeds } from "./equipment-inference";
import { getFreshnessBadge } from "./types";
import { mapTimeline } from "./timeline";
import type { EnrichedLead, InferredEquipment, ScoredLead } from "./types";
import { organization } from "@/lib/db/schema/auth";
import { organizationProfiles } from "@/lib/db/schema/organization-profiles";
import { scoreLeadForOrg } from "@/lib/scoring/engine";
import type {
  OrgScoringContext,
  LeadScoringInput,
} from "@/lib/scoring/types";
import type { Industry } from "@/lib/onboarding/types";

// -- Column helpers --

/**
 * All lead columns EXCEPT `location` (PostGIS geometry).
 * The `location` column is write-only (used for spatial indexing); selecting
 * it is wasteful and breaks environments where PostGIS isn't enabled.
 */
function leadColumns() {
  const allCols = getTableColumns(leads);
  // Exclude `location` (PostGIS geometry) -- it's write-only for spatial indexing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { location, ...cols } = allCols ?? {};
  return cols;
}

// -- Pure helper (exported for testability) --

const EARTH_RADIUS_MILES = 3959;

/**
 * Computes the great-circle distance in miles between two points
 * using the Haversine formula.
 *
 * This pure TypeScript implementation is used for:
 * - Testing without a database
 * - Computing distance for single-lead lookups (getLeadById)
 *
 * The same formula is embedded as SQL for the filtered feed query.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  // Clamp to avoid floating-point domain errors in acos
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));

  return EARTH_RADIUS_MILES * c;
}

// -- Equipment filtering (exported for testability) --

/**
 * Filters enriched leads by equipment type overlap.
 * If no filter is provided or the filter is empty, all leads pass through.
 */
export function filterByEquipment(
  enrichedLeads: EnrichedLead[],
  equipmentFilter: string[] | undefined
): EnrichedLead[] {
  if (!equipmentFilter || equipmentFilter.length === 0) {
    return enrichedLeads;
  }

  return enrichedLeads.filter((lead) =>
    lead.inferredEquipment.some((eq) => equipmentFilter.includes(eq.type))
  );
}

// -- Query parameters --

export interface GetFilteredLeadsParams {
  hqLat: number;
  hqLng: number;
  serviceRadiusMiles: number;
  dealerEquipment: string[];
  radiusMiles?: number;
  equipmentFilter?: string[];
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minProjectSize?: number;
  maxProjectSize?: number;
  userId?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
}

/** Filter params subset used by buildFilterConditions and applyInMemoryFilters */
export interface FilterParams {
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minProjectSize?: number;
  maxProjectSize?: number;
}

/**
 * Builds an array of Drizzle SQL conditions from the optional filter params.
 * Returns an empty array when no filters are active.
 *
 * Exported for testability -- the main getFilteredLeads function calls this
 * internally and spreads the conditions into its WHERE clause.
 */
export function buildFilterConditions(params: FilterParams): SQL[] {
  const conditions: SQL[] = [];

  if (params.keyword) {
    const pattern = `%${params.keyword}%`;
    conditions.push(
      or(
        ilike(leads.title, pattern),
        ilike(leads.description, pattern),
        ilike(leads.address, pattern),
        ilike(leads.applicantName, pattern),
        ilike(leads.contractorName, pattern)
      )!
    );
  }

  if (params.dateFrom) {
    conditions.push(gte(leads.scrapedAt, params.dateFrom));
  }

  if (params.dateTo) {
    conditions.push(lte(leads.scrapedAt, params.dateTo));
  }

  if (params.minProjectSize != null) {
    conditions.push(gte(leads.estimatedValue, params.minProjectSize));
  }

  if (params.maxProjectSize != null) {
    conditions.push(lte(leads.estimatedValue, params.maxProjectSize));
  }

  return conditions;
}

/**
 * In-memory filter that mirrors the SQL filter logic.
 * Used for post-query filtering and unit testing without a database.
 *
 * Applies keyword (case-insensitive match across title, description,
 * address, applicantName, contractorName), date range on scrapedAt,
 * and project size range on estimatedValue.
 */
export function applyInMemoryFilters(
  enrichedLeads: EnrichedLead[],
  params: FilterParams
): EnrichedLead[] {
  return enrichedLeads.filter((lead) => {
    // Keyword filter -- case-insensitive match across multiple fields
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      const matchFields = [
        lead.title,
        lead.description,
        lead.address,
        lead.applicantName,
        lead.contractorName,
      ];
      const matches = matchFields.some(
        (field) => field != null && field.toLowerCase().includes(kw)
      );
      if (!matches) return false;
    }

    // Date range filters on scrapedAt
    if (params.dateFrom && lead.scrapedAt < params.dateFrom) {
      return false;
    }
    if (params.dateTo && lead.scrapedAt > params.dateTo) {
      return false;
    }

    // Project size filters on estimatedValue
    if (
      params.minProjectSize != null &&
      (lead.estimatedValue == null ||
        lead.estimatedValue < params.minProjectSize)
    ) {
      return false;
    }
    if (
      params.maxProjectSize != null &&
      (lead.estimatedValue == null ||
        lead.estimatedValue > params.maxProjectSize)
    ) {
      return false;
    }

    return true;
  });
}

export interface GetLeadByIdParams {
  hqLat?: number;
  hqLng?: number;
  serviceRadiusMiles?: number;
  dealerEquipment?: string[];
}

// -- Shared enrichment helper --

/**
 * Enriches a raw lead row with computed intelligence fields: distance, score,
 * freshness, inferred equipment, and timeline.
 *
 * Extracted from getLeadById so it can be reused by getLeadById,
 * getFilteredLeadsWithCount, and getLeadsByIds without duplicating logic.
 */
export function enrichLead(
  row: Record<string, unknown>,
  params?: GetLeadByIdParams,
  orgContext?: OrgScoringContext
): EnrichedLead {
  const inferred = inferEquipmentNeeds(
    row.projectType as string | null,
    row.description as string | null
  );

  // Compute distance if HQ coordinates and lead coordinates are available
  let distance: number | null = null;
  if (
    params?.hqLat != null &&
    params?.hqLng != null &&
    row.lat != null &&
    row.lng != null
  ) {
    distance = haversineDistance(
      params.hqLat,
      params.hqLng,
      row.lat as number,
      row.lng as number
    );
  }

  let score = 0;
  if (orgContext && distance != null) {
    const leadInput = toLeadScoringInput(row);
    const result = scoreLeadForOrg(leadInput, orgContext, distance);
    score = result.total;
  } else if (params?.dealerEquipment && params?.serviceRadiusMiles && distance != null) {
    // Backward-compatible fallback: simple distance-only score
    // This path is used by legacy code paths that don't have org context
    score = distance <= (params.serviceRadiusMiles ?? 50) ? 50 : 10;
  }

  return {
    ...row,
    distance,
    inferredEquipment: inferred,
    score,
    freshness: getFreshnessBadge(row.scrapedAt as Date),
    timeline: mapTimeline(
      row.projectType as string | null,
      row.description as string | null
    ),
  } as EnrichedLead;
}

// -- Main feed query --

/**
 * Fetch more rows than requested so that in-memory scoring and equipment
 * filtering don't accidentally exclude high-score leads that were scraped
 * slightly earlier. The final result is sliced to the caller's limit.
 */
const FETCH_MULTIPLIER = 4;

/**
 * Fetches leads within a geographic radius from dealer HQ, enriches each
 * with inferred equipment, score, freshness, and timeline, optionally
 * filters by equipment type, and returns sorted by score DESC.
 */
export async function getFilteredLeads(
  params: GetFilteredLeadsParams
): Promise<EnrichedLead[]> {
  const {
    hqLat,
    hqLng,
    serviceRadiusMiles,
    dealerEquipment,
    radiusMiles = serviceRadiusMiles,
    equipmentFilter,
    keyword,
    dateFrom,
    dateTo,
    minProjectSize,
    maxProjectSize,
    userId,
    organizationId,
    limit = 50,
    offset = 0,
  } = params;

  // Build org scoring context if organizationId is available
  const orgContext = organizationId ? await buildOrgScoringContext(organizationId) : null;

  // PostGIS distance expression (meters -> miles) using the GiST-indexed location column
  const distanceExpr = sql<number>`
    ST_Distance(
      ${leads.location}::geography,
      ST_SetSRID(ST_MakePoint(${hqLng}, ${hqLat}), 4326)::geography
    ) / 1609.344
  `.mapWith(Number);

  // Build filter conditions from optional params
  const filterConditions = buildFilterConditions({
    keyword,
    dateFrom,
    dateTo,
    minProjectSize,
    maxProjectSize,
  });

  // Build select fields -- add status and bookmark info when user context available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectFields: Record<string, any> = {
    ...leadColumns(),
    distance: distanceExpr,
  };

  if (userId && organizationId) {
    selectFields.status = sql<string>`COALESCE(${leadStatuses.status}, 'new')`.as("status");
    selectFields.isBookmarked = sql<boolean>`${bookmarks.id} IS NOT NULL`.as("is_bookmarked");
  }

  // Build query with optional LEFT JOINs
  let query = db
    .select(selectFields)
    .from(leads)
    .$dynamic();

  if (userId && organizationId) {
    query = query
      .leftJoin(
        leadStatuses,
        and(
          eq(leadStatuses.leadId, leads.id),
          eq(leadStatuses.userId, userId),
          eq(leadStatuses.organizationId, organizationId)
        )
      )
      .leftJoin(
        bookmarks,
        and(
          eq(bookmarks.leadId, leads.id),
          eq(bookmarks.userId, userId),
          eq(bookmarks.organizationId, organizationId)
        )
      );
  }

  // Use ST_DWithin for spatial index-backed distance filtering
  // Fetch more rows than the caller requested so scoring and equipment
  // filtering can select the best results, not just the most recent.
  const fetchLimit = limit * FETCH_MULTIPLIER;

  const rows = await query
    .where(
      and(
        isNotNull(leads.location),
        sql`ST_DWithin(
          ${leads.location}::geography,
          ST_SetSRID(ST_MakePoint(${hqLng}, ${hqLat}), 4326)::geography,
          ${radiusMiles * 1609.344}
        )`,
        ...filterConditions
      )
    )
    .orderBy(desc(leads.scrapedAt))
    .limit(fetchLimit)
    .offset(offset);

  // Enrich each lead with intelligence
  let enriched: EnrichedLead[] = (rows as Record<string, unknown>[]).map((row) => {
    const inferred = inferEquipmentNeeds(
      row.projectType as string | null,
      row.description as string | null
    );

    return {
      ...row,
      inferredEquipment: inferred,
      score: orgContext
        ? scoreLeadForOrg(toLeadScoringInput(row as Record<string, unknown>), orgContext, row.distance as number | null).total
        : 0,
      freshness: getFreshnessBadge(row.scrapedAt as Date),
      timeline: mapTimeline(
        row.projectType as string | null,
        row.description as string | null
      ),
      status: row.status as string | undefined,
      isBookmarked: row.isBookmarked as boolean | undefined,
    } as EnrichedLead;
  });

  // Post-query equipment filter
  enriched = filterByEquipment(enriched, equipmentFilter);

  // Sort by score DESC with deterministic tiebreakers
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const valueDiff = (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
    if (valueDiff !== 0) return valueDiff;
    const dateDiff = b.scrapedAt.getTime() - a.scrapedAt.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Slice to the caller's requested limit (we over-fetched with FETCH_MULTIPLIER)
  return enriched.slice(0, limit);
}

// -- Paginated feed query --

export interface GetFilteredLeadsWithCountParams extends GetFilteredLeadsParams {
  page: number;
  pageSize: number;
}

/**
 * Fetches leads within a geographic radius, enriches, filters, scores, and
 * returns a paginated slice with total count metadata.
 *
 * Unlike getFilteredLeads (which uses FETCH_MULTIPLIER and SQL-level LIMIT),
 * this function fetches ALL within-radius leads so the total count is accurate
 * for pagination. The Haversine WHERE clause already limits results to a
 * reasonable set (typically <5000 for any realistic radius).
 *
 * Returns: { leads, totalCount, page, totalPages }
 */
export async function getFilteredLeadsWithCount(
  params: GetFilteredLeadsWithCountParams
): Promise<{
  leads: EnrichedLead[];
  totalCount: number;
  page: number;
  totalPages: number;
}> {
  const {
    hqLat,
    hqLng,
    serviceRadiusMiles,
    dealerEquipment,
    radiusMiles = serviceRadiusMiles,
    equipmentFilter,
    keyword,
    dateFrom,
    dateTo,
    minProjectSize,
    maxProjectSize,
    userId,
    organizationId,
    page,
    pageSize,
  } = params;

  // Build org scoring context if organizationId is available
  const orgContext = organizationId ? await buildOrgScoringContext(organizationId) : null;

  // Spatial WHERE condition using ST_DWithin (leverages GiST index)
  const spatialCondition = sql`ST_DWithin(
    ${leads.location}::geography,
    ST_SetSRID(ST_MakePoint(${hqLng}, ${hqLat}), 4326)::geography,
    ${radiusMiles * 1609.344}
  )`;

  // Build filter conditions from optional params
  const filterConditions = buildFilterConditions({
    keyword,
    dateFrom,
    dateTo,
    minProjectSize,
    maxProjectSize,
  });

  // All WHERE conditions for both COUNT and data queries
  const allConditions = [
    isNotNull(leads.location),
    spatialCondition,
    ...filterConditions,
  ];

  // 1. Run a separate COUNT query first for accurate pagination
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(leads)
    .where(and(...allConditions));

  // PostGIS distance expression (meters -> miles) using the GiST-indexed location column
  const distanceExpr = sql<number>`
    ST_Distance(
      ${leads.location}::geography,
      ST_SetSRID(ST_MakePoint(${hqLng}, ${hqLat}), 4326)::geography
    ) / 1609.344
  `.mapWith(Number);

  // Build select fields -- add status and bookmark info when user context available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectFields: Record<string, any> = {
    ...leadColumns(),
    distance: distanceExpr,
  };

  if (userId && organizationId) {
    selectFields.status = sql<string>`COALESCE(${leadStatuses.status}, 'new')`.as("status");
    selectFields.isBookmarked = sql<boolean>`${bookmarks.id} IS NOT NULL`.as("is_bookmarked");
  }

  // Build query with optional LEFT JOINs
  let query = db
    .select(selectFields)
    .from(leads)
    .$dynamic();

  if (userId && organizationId) {
    query = query
      .leftJoin(
        leadStatuses,
        and(
          eq(leadStatuses.leadId, leads.id),
          eq(leadStatuses.userId, userId),
          eq(leadStatuses.organizationId, organizationId)
        )
      )
      .leftJoin(
        bookmarks,
        and(
          eq(bookmarks.leadId, leads.id),
          eq(bookmarks.userId, userId),
          eq(bookmarks.organizationId, organizationId)
        )
      );
  }

  // 2. Fetch only the requested page using SQL LIMIT/OFFSET
  const rows = await query
    .where(and(...allConditions))
    .orderBy(desc(leads.scrapedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Enrich each lead with intelligence (only pageSize rows now, not all)
  let enriched: EnrichedLead[] = (rows as Record<string, unknown>[]).map(
    (row) => {
      const inferred = inferEquipmentNeeds(
        row.projectType as string | null,
        row.description as string | null
      );

      return {
        ...row,
        inferredEquipment: inferred,
        score: orgContext
          ? scoreLeadForOrg(toLeadScoringInput(row as Record<string, unknown>), orgContext, row.distance as number | null).total
          : 0,
        freshness: getFreshnessBadge(row.scrapedAt as Date),
        timeline: mapTimeline(
          row.projectType as string | null,
          row.description as string | null
        ),
        status: row.status as string | undefined,
        isBookmarked: row.isBookmarked as boolean | undefined,
      } as EnrichedLead;
    }
  );

  // Post-query equipment filter (applied to the page)
  enriched = filterByEquipment(enriched, equipmentFilter);

  // Compute pagination from COUNT result
  const totalPages = Math.ceil(totalCount / pageSize);

  return { leads: enriched, totalCount, page, totalPages };
}

// -- Single lead query --

/**
 * Fetches a single lead by ID and enriches it with intelligence data.
 * Returns null if the lead is not found.
 *
 * If HQ coordinates and dealer equipment are provided, computes distance
 * and score. Otherwise, distance defaults to null and score to 0.
 */
export async function getLeadById(
  id: string,
  params?: GetLeadByIdParams
): Promise<EnrichedLead | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  return enrichLead(rows[0] as Record<string, unknown>, params);
}

// -- Batch lead query --

/**
 * Fetches multiple leads by ID in a single database round-trip and enriches
 * each with intelligence data. Used by the bookmarks page to replace N+1
 * individual getLeadById calls.
 *
 * Returns only found leads -- missing IDs are silently filtered out.
 * Returns empty array (without issuing SQL) when given an empty ID list.
 */
export async function getLeadsByIds(
  ids: string[],
  params?: GetLeadByIdParams
): Promise<EnrichedLead[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.id, ids));

  return (rows as Record<string, unknown>[]).map((row) =>
    enrichLead(row, params)
  );
}

// -- Lead sources query --

/** Shape of a lead source record from the lead_sources table */
export interface LeadSource {
  id: string;
  leadId: string;
  sourceId: string;
  sourceType: string;
  externalId: string | null;
  sourceUrl: string | null;
  title: string | null;
  discoveredAt: Date;
}

/**
 * Fetch all source references for a given lead, ordered by discovery date ascending.
 * Returns an empty array if the lead has no source entries.
 */
export async function getLeadSources(leadId: string): Promise<LeadSource[]> {
  const rows = await db
    .select()
    .from(leadSources)
    .where(eq(leadSources.leadId, leadId))
    .orderBy(asc(leadSources.discoveredAt));

  return rows;
}

// ---------------------------------------------------------------------------
// Cursor-based lead feed with per-org scoring (Phase 15)
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  /** Lead ID -- fetch leads after this ID */
  cursor?: string;
  /** Number of leads to return (default 20) */
  limit?: number;
}

export interface GetLeadFeedParams extends CursorPaginationParams {
  orgId: string;
  userId: string;
  // Filters
  sourceTypes?: string[];
  maxDistanceMiles?: number;
  minValue?: number;
  maxValue?: number;
  projectTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  matchingSpecializationsOnly?: boolean;
  sortBy?: "score" | "distance" | "value" | "date";
  keyword?: string;
}

export interface LeadFeedResult {
  leads: ScoredLead[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Internal batch size -- fetch more than requested so sorting works well */
const CURSOR_BATCH_SIZE = 50;

/**
 * Builds an OrgScoringContext from the organization and profile tables.
 * Returns null if the org or profile is not found.
 */
async function buildOrgScoringContext(
  orgId: string
): Promise<OrgScoringContext | null> {
  // Fetch org for industry
  const orgRows = await db
    .select({ industry: organization.industry })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (orgRows.length === 0) return null;

  // Fetch profile for scoring parameters
  const profileRows = await db
    .select()
    .from(organizationProfiles)
    .where(eq(organizationProfiles.organizationId, orgId))
    .limit(1);

  if (profileRows.length === 0) return null;

  const profile = profileRows[0];
  const industry = (orgRows[0].industry ?? "heavy_equipment") as Industry;

  return {
    industry,
    hqLat: profile.hqLat ?? 0,
    hqLng: profile.hqLng ?? 0,
    serviceRadiusMiles: profile.serviceRadiusMiles ?? 50,
    specializations: profile.specializations ?? [],
    preferredLeadTypes: profile.serviceTypes ?? [],
    targetProjectValueMin: profile.targetProjectValueMin,
    targetProjectValueMax: profile.targetProjectValueMax,
  };
}

/**
 * Converts a raw lead row into the LeadScoringInput shape expected by the
 * scoring engine.
 */
function toLeadScoringInput(row: Record<string, unknown>): LeadScoringInput {
  return {
    lat: row.lat as number | null,
    lng: row.lng as number | null,
    projectType: row.projectType as string | null,
    sourceType: row.sourceType as string,
    applicableIndustries: (row.applicableIndustries as string[]) ?? [],
    estimatedValue: row.estimatedValue as number | null,
    valueTier: row.valueTier as string | null,
    severity: row.severity as string | null,
    deadline: row.deadline as Date | null,
    scrapedAt: row.scrapedAt as Date,
  };
}

/**
 * Fetches leads using cursor-based pagination, scores each against the
 * subscriber's org context, and returns sorted results with a cursor for
 * the next page.
 *
 * This replaces the offset-based pagination for the main lead feed. The old
 * getFilteredLeads and getFilteredLeadsWithCount functions remain for backward
 * compatibility with bookmarks, digests, etc.
 */
export async function getFilteredLeadsCursor(
  params: GetLeadFeedParams
): Promise<LeadFeedResult> {
  const {
    orgId,
    userId,
    cursor,
    limit = 20,
    sourceTypes,
    maxDistanceMiles,
    minValue,
    maxValue,
    projectTypes,
    dateFrom,
    dateTo,
    matchingSpecializationsOnly,
    sortBy = "score",
    keyword,
  } = params;

  // 1. Build org scoring context
  const orgContext = await buildOrgScoringContext(orgId);
  if (!orgContext) {
    return { leads: [], nextCursor: null, hasMore: false };
  }

  const effectiveRadius = maxDistanceMiles ?? orgContext.serviceRadiusMiles * 1.5;

  // 2. Build PostGIS distance expression (meters -> miles)
  const distanceExpr = sql<number>`
    ST_Distance(
      ${leads.location}::geography,
      ST_SetSRID(ST_MakePoint(${orgContext.hqLng}, ${orgContext.hqLat}), 4326)::geography
    ) / 1609.344
  `.mapWith(Number);

  // 3. Build WHERE conditions using ST_DWithin for spatial index utilization
  const conditions: SQL[] = [
    isNotNull(leads.location),
    sql`ST_DWithin(
      ${leads.location}::geography,
      ST_SetSRID(ST_MakePoint(${orgContext.hqLng}, ${orgContext.hqLat}), 4326)::geography,
      ${effectiveRadius * 1609.344}
    )`,
  ];

  // Cursor: fetch leads with ID > cursor for stable ordering
  if (cursor) {
    conditions.push(sql`${leads.id} > ${cursor}`);
  }

  // Source type filter
  if (sourceTypes && sourceTypes.length > 0) {
    conditions.push(inArray(leads.sourceType, sourceTypes));
  }

  // Value range filter
  if (minValue != null) {
    conditions.push(gte(leads.estimatedValue, minValue));
  }
  if (maxValue != null) {
    conditions.push(lte(leads.estimatedValue, maxValue));
  }

  // Project type filter
  if (projectTypes && projectTypes.length > 0) {
    conditions.push(inArray(leads.projectType, projectTypes));
  }

  // Date range filter
  if (dateFrom) {
    conditions.push(gte(leads.scrapedAt, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(leads.scrapedAt, dateTo));
  }

  // Matching specializations only: filter where applicableIndustries overlaps with org industry
  if (matchingSpecializationsOnly) {
    conditions.push(
      sql`${leads.applicableIndustries} && ARRAY[${orgContext.industry}]::text[]`
    );
  }

  // Keyword filter
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(
        ilike(leads.title, pattern),
        ilike(leads.description, pattern),
        ilike(leads.address, pattern)
      )!
    );
  }

  // 4. Build select fields with optional status and bookmark
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectFields: Record<string, any> = {
    ...leadColumns(),
    distance: distanceExpr,
  };

  selectFields.status = sql<string>`COALESCE(${leadStatuses.status}, 'new')`.as(
    "lead_status"
  );
  selectFields.isBookmarked = sql<boolean>`${bookmarks.id} IS NOT NULL`.as(
    "is_bookmarked"
  );

  // 5. Execute query
  const rows = await db
    .select(selectFields)
    .from(leads)
    .leftJoin(
      leadStatuses,
      and(
        eq(leadStatuses.leadId, leads.id),
        eq(leadStatuses.userId, userId),
        eq(leadStatuses.organizationId, orgId)
      )
    )
    .leftJoin(
      bookmarks,
      and(
        eq(bookmarks.leadId, leads.id),
        eq(bookmarks.userId, userId),
        eq(bookmarks.organizationId, orgId)
      )
    )
    .where(and(...conditions))
    .orderBy(asc(leads.id))
    .limit(CURSOR_BATCH_SIZE);

  // 6. Score each lead
  const scored: ScoredLead[] = (rows as Record<string, unknown>[]).map(
    (row) => {
      const leadInput = toLeadScoringInput(row);
      const distanceMiles =
        row.distance != null ? (row.distance as number) : null;
      const scoring = scoreLeadForOrg(leadInput, orgContext, distanceMiles);

      return {
        ...row,
        distance: distanceMiles,
        scoring,
        freshness: getFreshnessBadge(row.scrapedAt as Date),
        status: row.status as string | undefined,
        isBookmarked: row.isBookmarked as boolean | undefined,
      } as ScoredLead;
    }
  );

  // 7. Sort by requested dimension with deterministic tiebreakers
  scored.sort((a, b) => {
    let primary: number;
    switch (sortBy) {
      case "distance":
        primary = (a.distance ?? Infinity) - (b.distance ?? Infinity);
        break;
      case "value":
        primary = (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
        break;
      case "date":
        primary = b.scrapedAt.getTime() - a.scrapedAt.getTime();
        break;
      case "score":
      default:
        primary = b.scoring.total - a.scoring.total;
        break;
    }
    if (primary !== 0) return primary;
    // Tiebreakers: estimated value desc, scrapedAt desc, id asc (deterministic)
    const valueDiff = (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
    if (valueDiff !== 0) return valueDiff;
    const dateDiff = b.scrapedAt.getTime() - a.scrapedAt.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // 8. Take the first `limit` leads
  const result = scored.slice(0, limit);
  const hasMore = rows.length === CURSOR_BATCH_SIZE;
  const nextCursor =
    hasMore && result.length > 0 ? result[result.length - 1].id : null;

  return { leads: result, nextCursor, hasMore };
}

// ---------------------------------------------------------------------------
// Single scored lead query (Phase 15)
// ---------------------------------------------------------------------------

/**
 * Fetches a single lead by ID and scores it against the subscriber's org context.
 * Returns null if the lead or org profile is not found.
 *
 * Used by the lead detail page to show per-org scoring breakdown.
 */
export async function getLeadByIdScored(
  id: string,
  orgId: string
): Promise<ScoredLead | null> {
  const orgContext = await buildOrgScoringContext(orgId);
  if (!orgContext) return null;

  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;

  // Compute distance
  let distanceMiles: number | null = null;
  if (row.lat != null && row.lng != null) {
    distanceMiles = haversineDistance(
      orgContext.hqLat,
      orgContext.hqLng,
      row.lat as number,
      row.lng as number
    );
  }

  const leadInput = toLeadScoringInput(row);
  const scoring = scoreLeadForOrg(leadInput, orgContext, distanceMiles);

  return {
    ...row,
    distance: distanceMiles,
    scoring,
    freshness: getFreshnessBadge(row.scrapedAt as Date),
  } as ScoredLead;
}
