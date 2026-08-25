// Delivery radius check — geocodes a typed address via Mapbox (same account
// already used for the globe's landmark fly-in) and measures real distance
// from the restaurant.
//
// The restaurant location / delivery radius / closed-postcode blocklist are
// admin-editable now (see supabase/schema.sql's `app_settings` table,
// fetched into StoreContext). These two constants are only the fallback
// used if that fetch hasn't resolved yet or fails.

export const DEFAULT_RESTAURANT = {
  name: 'Freising, Germany',
  lat: 48.4028,
  long: 11.7489,
};

export const DEFAULT_DELIVERY_RADIUS_KM = 10;

export interface GeocodeResult {
  lat: number;
  long: number;
  placeName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token || !address.trim()) return null;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?access_token=${token}&limit=1&language=de`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return null;
    const [long, lat] = feature.center;
    return { lat, long, placeName: feature.place_name };
  } catch {
    return null;
  }
}

// Haversine distance in kilometers.
export function distanceKm(lat1: number, long1: number, lat2: number, long2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLong = ((long2 - long1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLong / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// German postcodes are 5 digits — same extraction used to check a geocoded
// address against the closed-postcode blocklist, and reused for the
// admin's order-location analytics.
export function extractPostcode(placeName: string): string | null {
  const match = placeName.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

// Points forming a geodesic circle of `radiusKm` around (lat, long) — an
// equirectangular approximation (longitude scaled by cos(latitude)) that's
// accurate enough for city-scale delivery radii, used to draw a real
// circle on a map instead of a fixed pixel radius that would be wrong at
// different zoom levels or latitudes. Returns [long, lat] pairs (GeoJSON
// coordinate order), closed (first point repeated at the end).
export function circlePolygon(lat: number, long: number, radiusKm: number, points = 64): [number, number][] {
  const coords: [number, number][] = [];
  const distX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distY = radiusKm / 110.574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([long + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  coords.push(coords[0]);
  return coords;
}
