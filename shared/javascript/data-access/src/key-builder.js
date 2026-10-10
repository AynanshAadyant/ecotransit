/**
 * Shared Redis key builders used across TypeScript and Python services.
 * Keep key formats identical across both runtimes.
 */
export function vehicleLiveKey(vehicleId) {
    return `live:pos:${vehicleId}`;
}
export function vehicleGeoKey() {
    return 'live:geo:vehicles';
}
export function routeLiveKey(routeId) {
    return `live:route:${routeId}`;
}
export function staffSessionKey(sessionId) {
    return `staff:session:${sessionId}`;
}
export function staticRouteCacheKey(routeId) {
    return `cache:route:${routeId}`;
}
export function staticStopCacheKey(stopId) {
    return `cache:stop:${stopId}`;
}
export function routeSegmentsCacheKey(routeId) {
    return `cache:segments:${routeId}`;
}
//# sourceMappingURL=key-builder.js.map