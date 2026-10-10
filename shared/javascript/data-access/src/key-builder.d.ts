/**
 * Shared Redis key builders used across TypeScript and Python services.
 * Keep key formats identical across both runtimes.
 */
export declare function vehicleLiveKey(vehicleId: string): string;
export declare function vehicleGeoKey(): string;
export declare function routeLiveKey(routeId: string): string;
export declare function staffSessionKey(sessionId: string): string;
export declare function staticRouteCacheKey(routeId: string): string;
export declare function staticStopCacheKey(stopId: string): string;
export declare function routeSegmentsCacheKey(routeId: string): string;
//# sourceMappingURL=key-builder.d.ts.map