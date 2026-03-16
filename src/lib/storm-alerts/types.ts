export interface StormAlert {
  id: string;
  title: string | null;
  description: string | null;
  severity: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  expiresAt: Date | null;
  sourceUrl: string | null;
}

export interface StormEmailPayload {
  userName: string;
  alerts: StormAlert[];
  dashboardUrl: string;
}

export interface SubscriberInfo {
  orgId: string;
  orgName: string;
  userId: string;
  userName: string;
  email: string;
  hqLat: number;
  hqLng: number;
  serviceRadiusMiles: number;
}
