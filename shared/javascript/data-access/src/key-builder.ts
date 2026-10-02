/**
 * Shared Redis key builders used across TypeScript and Python services.
 * Keep key formats identical across both runtimes.
 */

export function vehicleLiveKey(vehicleId: string): string {
  return `live:pos:${vehicleId}`;
}

export function vehicleGeoKey(): string {
  return 'live:geo:vehicles';
}

export function routeLiveKey(routeId: string): string {
  return `live:route:${routeId}`;
}

export function staffSessionKey(sessionId: string): string {
  return `staff:session:${sessionId}`;
}

export function staticRouteCacheKey(routeId: string): string {
  return `cache:route:${routeId}`;
}

export function staticStopCacheKey(stopId: string): string {
  return `cache:stop:${stopId}`;
}

export function routeSegmentsCacheKey(routeId: string): string {
  return `cache:segments:${routeId}`;
}
