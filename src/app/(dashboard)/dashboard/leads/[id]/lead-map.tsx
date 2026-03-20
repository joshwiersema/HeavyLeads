"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LeadMapProps {
  lat: number;
  lng: number;
  title: string;
  hqLat?: number;
  hqLng?: number;
  serviceRadiusMiles?: number;
}

const MILES_TO_METERS = 1609.34;

// Custom marker icons (Leaflet default icons break with bundlers)
const leadIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const hqIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;

    const bounds = L.latLngBounds(
      [leadLat, leadLng],
      [hqLat, hqLng]
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, leadLat, leadLng, hqLat, hqLng]);

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
  const hasHq = hqLat != null && hqLng != null;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={hasHq ? 10 : 14}
      className="h-[300px] w-full rounded-lg"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Lead marker (red) */}
      <Marker position={[lat, lng]} icon={leadIcon}>
        <Popup>{title}</Popup>
      </Marker>

      {/* HQ marker (blue) -- only if HQ coords provided */}
      {hasHq && (
        <Marker position={[hqLat!, hqLng!]} icon={hqIcon}>
          <Popup>Your HQ</Popup>
        </Marker>
      )}

      {/* Service radius circle overlay */}
      {hasHq && serviceRadiusMiles != null && (
        <Circle
          center={[hqLat!, hqLng!]}
          radius={serviceRadiusMiles * MILES_TO_METERS}
          pathOptions={{
            fillColor: "#1e40af",
            fillOpacity: 0.08,
            color: "#1e40af",
            weight: 1.5,
          }}
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
    </MapContainer>
  );
}
