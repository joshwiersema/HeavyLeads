"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { WizardState, WizardAction } from "@/lib/onboarding/types";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Default center (geographic center of the contiguous US)
// ---------------------------------------------------------------------------

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;
const MILES_TO_METERS = 1609.34;

// ---------------------------------------------------------------------------
// Circle overlay -- uses Maps library for google.maps.Circle
// ---------------------------------------------------------------------------

function RadiusCircle({
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
        fillOpacity: 0.1,
        strokeColor: "#1e40af",
        strokeWeight: 2,
        clickable: false,
      });
    }

    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
    // Intentionally depend only on map/mapsLib for creation; updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapsLib]);

  // Update circle position and radius when props change
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setCenter({ lat, lng });
    circleRef.current.setRadius(radiusMiles * MILES_TO_METERS);
  }, [lat, lng, radiusMiles]);

  return null;
}

// ---------------------------------------------------------------------------
// Interactive map content (rendered inside APIProvider)
// ---------------------------------------------------------------------------

function InteractiveMap({ state, dispatch }: WizardStepProps) {
  const hasCoords =
    state.serviceAreaLat !== null && state.serviceAreaLng !== null;

  const center = hasCoords
    ? { lat: state.serviceAreaLat!, lng: state.serviceAreaLng! }
    : DEFAULT_CENTER;

  return (
    <div className="space-y-4">
      <div className="h-[300px] w-full overflow-hidden rounded-lg border">
        <Map
          mapId="onboarding-service-area"
          defaultCenter={center}
          defaultZoom={hasCoords ? 8 : DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full"
        >
          {hasCoords && (
            <>
              <AdvancedMarker
                position={center}
                draggable
                onDragEnd={(e) => {
                  const pos = e.latLng;
                  if (!pos) return;
                  dispatch({
                    type: "SET_FIELDS",
                    fields: {
                      serviceAreaLat: pos.lat(),
                      serviceAreaLng: pos.lng(),
                    },
                  });
                }}
              />
              <RadiusCircle
                lat={state.serviceAreaLat!}
                lng={state.serviceAreaLng!}
                radiusMiles={state.serviceRadiusMiles}
              />
            </>
          )}
        </Map>
      </div>

      {!hasCoords && (
        <p className="text-sm text-muted-foreground">
          Your address will be geocoded when you complete onboarding.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback when no API key is present
// ---------------------------------------------------------------------------

function MapFallback() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
      <MapPin className="mb-2 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        Map unavailable &mdash; configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radius slider (shared between map and fallback paths)
// ---------------------------------------------------------------------------

function RadiusSlider({ state, dispatch }: WizardStepProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="radiusSlider">Service Radius</Label>
        <span className="text-sm font-medium text-primary">
          {state.serviceRadiusMiles} miles
        </span>
      </div>
      <input
        id="radiusSlider"
        type="range"
        min={10}
        max={500}
        step={5}
        value={state.serviceRadiusMiles}
        onChange={(e) =>
          dispatch({
            type: "SET_FIELD",
            field: "serviceRadiusMiles",
            value: Number(e.target.value),
          })
        }
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>10 mi</span>
        <span>500 mi</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Area step -- main export
// ---------------------------------------------------------------------------

export function ServiceArea({ state, dispatch }: WizardStepProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Service Area</h2>
        <p className="text-sm text-muted-foreground">
          Set the geographic area where you serve customers
        </p>
      </div>

      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <InteractiveMap state={state} dispatch={dispatch} />
        </APIProvider>
      ) : (
        <MapFallback />
      )}

      <RadiusSlider state={state} dispatch={dispatch} />
    </div>
  );
}
