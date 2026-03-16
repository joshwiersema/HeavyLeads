import Link from "next/link";
import { sql, ne, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema/leads";
import { Badge } from "@/components/ui/badge";

interface SimilarLeadsProps {
  leadId: string;
  lat: number;
  lng: number;
  orgId: string;
}

const SIMILAR_RADIUS_MILES = 25;
const SIMILAR_LIMIT = 5;

export async function SimilarLeads({
  leadId,
  lat,
  lng,
}: SimilarLeadsProps) {
  // Haversine distance expression to find nearby leads
  const distanceExpr = sql<number>`
    3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${lat}))
        * cos(radians(${leads.lat}))
        * cos(radians(${leads.lng}) - radians(${lng}))
        + sin(radians(${lat}))
        * sin(radians(${leads.lat}))
      ))
    )
  `.mapWith(Number);

  const nearbyLeads = await db
    .select({
      id: leads.id,
      title: leads.title,
      address: leads.address,
      projectType: leads.projectType,
      distance: distanceExpr,
    })
    .from(leads)
    .where(
      and(
        ne(leads.id, leadId),
        isNotNull(leads.lat),
        isNotNull(leads.lng),
        sql`3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${lat}))
            * cos(radians(${leads.lat}))
            * cos(radians(${leads.lng}) - radians(${lng}))
            + sin(radians(${lat}))
            * sin(radians(${leads.lat}))
          ))
        ) <= ${SIMILAR_RADIUS_MILES}`
      )
    )
    .orderBy(sql`${leads.scrapedAt} DESC`)
    .limit(SIMILAR_LIMIT);

  if (nearbyLeads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No similar leads in this area
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {nearbyLeads.map((lead) => (
        <Link
          key={lead.id}
          href={`/dashboard/leads/${lead.id}`}
          className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {lead.title ?? lead.address ?? "Unknown"}
              </p>
              {lead.distance != null && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(lead.distance)} mi away
                </p>
              )}
            </div>
            {lead.projectType && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {lead.projectType}
              </Badge>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
