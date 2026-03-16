import { CloudSun, Home, DollarSign, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WeatherData {
  summary: string;
  alerts: string[];
  temperature?: number;
  conditions?: string;
}

interface PropertyData {
  type?: string;
  yearBuilt?: number;
  sqft?: number;
  owner?: string;
  zoning?: string;
}

interface IncentiveData {
  name: string;
  amount: string;
  deadline?: string;
  url?: string;
}

export interface EnrichmentCardsProps {
  weather: WeatherData | null;
  property: PropertyData | null;
  incentives: IncentiveData[] | null;
}

export function EnrichmentCards({
  weather,
  property,
  incentives,
}: EnrichmentCardsProps) {
  const hasAny =
    weather !== null ||
    property !== null ||
    (incentives !== null && incentives.length > 0);

  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      {weather && <WeatherCard data={weather} />}
      {property && <PropertyCard data={property} />}
      {incentives && incentives.length > 0 && (
        <IncentivesCard data={incentives} />
      )}
    </div>
  );
}

function WeatherCard({ data }: { data: WeatherData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudSun className="h-4 w-4" />
          Weather Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{data.summary}</p>
        {data.temperature != null && (
          <p className="text-sm text-muted-foreground">
            {data.temperature}&deg;F
            {data.conditions ? ` - ${data.conditions}` : ""}
          </p>
        )}
        {data.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.alerts.map((alert, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                {alert}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertyCard({ data }: { data: PropertyData }) {
  const entries: [string, string][] = [];
  if (data.type) entries.push(["Property Type", data.type]);
  if (data.yearBuilt) entries.push(["Year Built", String(data.yearBuilt)]);
  if (data.sqft)
    entries.push(["Square Footage", data.sqft.toLocaleString()]);
  if (data.owner) entries.push(["Owner", data.owner]);
  if (data.zoning) entries.push(["Zoning", data.zoning]);

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="h-4 w-4" />
          Property Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {entries.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function IncentivesCard({ data }: { data: IncentiveData[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Incentive Programs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((incentive, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{incentive.name}</span>
                <span className="text-green-600 font-medium">
                  {incentive.amount}
                </span>
              </div>
              {incentive.deadline && (
                <p className="text-xs text-muted-foreground">
                  Deadline: {incentive.deadline}
                </p>
              )}
              {incentive.url && (
                <a
                  href={incentive.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Learn more
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
