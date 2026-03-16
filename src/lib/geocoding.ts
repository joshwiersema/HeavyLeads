/**
 * Server-side geocoding utility using Google Maps Geocoding API.
 * IMPORTANT: This must only be called from server actions/components.
 * The API key is never exposed to the client.
 */

interface GeocodingResult {
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "[geocoding] GOOGLE_MAPS_API_KEY not set. Returning null coordinates. " +
        "Set GOOGLE_MAPS_API_KEY in .env.local for production geocoding."
    );
    return { lat: null, lng: null, formattedAddress: address };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Unable to geocode address. Please check the address and try again."
    );
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(
      "Unable to geocode address. Please check the address and try again."
    );
  }

  const result = data.results[0];

  if (!result.geometry?.location) {
    throw new Error(
      "Geocoding returned no coordinates. Please check the address and try again."
    );
  }

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}
