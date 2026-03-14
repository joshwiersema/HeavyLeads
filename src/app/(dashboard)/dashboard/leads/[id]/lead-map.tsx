"use client";

import { MapPin } from "lucide-react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
} from "@vis.gl/react-google-maps";

interface LeadMapProps {
  lat: number;
  lng: number;
  title: string;
}

export function LeadMap({ lat, lng, title }: LeadMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground/70">
            Map unavailable — configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={14}
        mapId="lead-detail-map"
        className="h-[300px] w-full rounded-lg"
      >
        <AdvancedMarker position={{ lat, lng }} title={title}>
          <Pin
            background="#1e40af"
            glyphColor="#ffffff"
            borderColor="#1e3a8a"
          />
        </AdvancedMarker>
      </Map>
    </APIProvider>
  );
}
