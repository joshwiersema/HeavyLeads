"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

export interface LeadMapProps {
  lat: number;
  lng: number;
  title: string;
  hqLat?: number;
  hqLng?: number;
  serviceRadiusMiles?: number;
}

const MILES_TO_METERS = 1609.34;

/**
 * Circle overlay for service radius -- uses the same pattern established
 * in Phase 14 (onboarding service-area step).
 */
function ServiceRadiusCircle({
  lat,
  lng,
  radiusMiles,
}: {
  lat: number;
  lng: number;
  radiusMiles: number;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!circleRef.current) {
      circleRef.current = new mapsLib.Circle({
        map,
        center: { lat, lng },
        radius: radiusMiles * MILES_TO_METERS,
        fillColor: "#1e40af",
        fillOpacity: 0.08,
        strokeColor: "#1e40af",
        strokeWeight: 1.5,
        clickable: false,
      });
    }

    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapsLib]);

  // Update circle when props change
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setCenter({ lat, lng });
    circleRef.current.setRadius(radiusMiles * MILES_TO_METERS);
  }, [lat, lng, radiusMiles]);

  return null;
}

/**
 * Fits the map bounds to include both the lead marker and HQ marker.
 */
function BoundsFitter({
  leadLat,
  leadLng,
  hqLat,
  hqLng,
}: {
  leadLat: number;
  leadLng: number;
  hqLat: number;
  hqLng: number;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("core");

  useEffect(() => {
    if (!map || !mapsLib) return;

    const bounds = new mapsLib.LatLngBounds();
    bounds.extend({ lat: leadLat, lng: leadLng });
    bounds.extend({ lat: hqLat, lng: hqLng });
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [map, mapsLib, leadLat, leadLng, hqLat, hqLng]);

  return null;
}

export function LeadMap({
  lat,
  lng,
  title,
  hqLat,
  hqLng,
  serviceRadiusMiles,
}: LeadMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground/70">
            Map unavailable -- configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </p>
        </div>
      </div>
    );
  }

  const hasHq = hqLat != null && hqLng != null;

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={hasHq ? 10 : 14}
        mapId="lead-detail-map"
        className="h-[300px] w-full rounded-lg"
      >
        {/* Lead marker (red) */}
        <AdvancedMarker position={{ lat, lng }} title={title}>
          <Pin
            background="#dc2626"
            glyphColor="#ffffff"
            borderColor="#b91c1c"
          />
        </AdvancedMarker>

        {/* HQ marker (blue) -- only if HQ coords provided */}
        {hasHq && (
          <AdvancedMarker
            position={{ lat: hqLat!, lng: hqLng! }}
            title="Your HQ"
          >
            <Pin
              background="#1e40af"
              glyphColor="#ffffff"
              borderColor="#1e3a8a"
            />
          </AdvancedMarker>
        )}

        {/* Service radius circle overlay */}
        {hasHq && serviceRadiusMiles != null && (
          <ServiceRadiusCircle
            lat={hqLat!}
            lng={hqLng!}
            radiusMiles={serviceRadiusMiles}
          />
        )}

        {/* Fit bounds to show both markers */}
        {hasHq && (
          <BoundsFitter
            leadLat={lat}
            leadLng={lng}
            hqLat={hqLat!}
            hqLng={hqLng!}
          />
        )}
      </Map>
    </APIProvider>
  );
}
