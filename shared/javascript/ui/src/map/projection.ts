/**
 * Geo to Canvas projection helper for vector transit canvas.
 * Centred around Delhi / transit network bounds.
 */
export function projectGeoToCanvas(
  lat: number,
  lon: number,
  centerLat = 28.6139,
  centerLon = 77.2090,
  scale = 26000,
  offsetX = 600,
  offsetY = 450
): { x: number; y: number } {
  const x = (lon - centerLon) * scale + offsetX;
  const y = -(lat - centerLat) * scale * 1.15 + offsetY;
  return { x, y };
}
