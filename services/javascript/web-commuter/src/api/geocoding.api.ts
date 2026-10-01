export interface LocationResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * OpenStreetMap Nominatim Geocoding API restricted to India (countrycodes=in)
 * Supports city/town searches (e.g. Udaipur, Dehradun, Indore, Patna, Mysuru)
 * and direct coordinate pairs (e.g. "24.5854, 73.7125").
 */
export async function searchLocation(query: string): Promise<LocationResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  // 1. Direct coordinate check (lat, lon)
  const coordMatch = trimmed.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[3]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return [
        {
          displayName: `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          latitude: lat,
          longitude: lon,
        },
      ];
    }
  }

  // 2. Nominatim Geocoding with country restriction to India
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(trimmed)}` +
    `&format=jsonv2` +
    `&limit=5` +
    `&countrycodes=in` +
    `&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'EcoTransit-MetroPortal-App/1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Location search failed');
  }

  const data = await response.json();

  return data.map((item: { display_name: string; lat: string; lon: string }) => ({
    displayName: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}
