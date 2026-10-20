import { z } from 'zod';

// ============================================================================
// Geographic & Spatial Schemas
// ============================================================================

export const CoordinateSchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lon: z.coerce.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

export type CoordinateDTO = z.infer<typeof CoordinateSchema>;

// ============================================================================
// Stops Request DTO Schemas
// ============================================================================

export const NearbyStopsQuerySchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lon: z.coerce.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
  radius: z.coerce.number().positive('Radius must be positive').max(50000, 'Radius cannot exceed 50,000m').default(1000),
  limit: z.coerce.number().positive('Limit must be positive').max(500, 'Limit cannot exceed 500').optional().default(150),
});

export type NearbyStopsQuery = z.infer<typeof NearbyStopsQuerySchema>;

export const SearchStopsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty').max(100, 'Search query cannot exceed 100 characters'),
  limit: z.coerce.number().positive('Limit must be positive').max(100, 'Limit cannot exceed 100').optional().default(20),
});

export type SearchStopsQuery = z.infer<typeof SearchStopsQuerySchema>;

export const StopIdParamSchema = z.object({
  stopId: z.string().trim().min(1, 'Stop ID cannot be empty').max(64, 'Stop ID cannot exceed 64 characters'),
});

export type StopIdParam = z.infer<typeof StopIdParamSchema>;

// ============================================================================
// Routes & Journey Request DTO Schemas
// ============================================================================

export const RouteIdParamSchema = z.object({
  routeId: z.string().trim().min(1, 'Route ID cannot be empty').max(64, 'Route ID cannot exceed 64 characters'),
});

export type RouteIdParam = z.infer<typeof RouteIdParamSchema>;

export const DirectJourneyQuerySchema = z
  .object({
    originStopId: z.string().trim().min(1, 'Origin stop ID cannot be empty').max(64),
    destinationStopId: z.string().trim().min(1, 'Destination stop ID cannot be empty').max(64),
    radiusM: z.coerce.number().positive().max(5000).default(800).optional(),
  })
  .refine((data) => data.originStopId !== data.destinationStopId, {
    message: 'Origin and destination stops must be distinct',
    path: ['destinationStopId'],
  });

export type DirectJourneyQuery = z.infer<typeof DirectJourneyQuerySchema>;

export const JourneyByCoordsQuerySchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLon: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLon: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().positive().max(20000).default(800),
});

export type JourneyByCoordsQuery = z.infer<typeof JourneyByCoordsQuerySchema>;

// ============================================================================
// Vehicles & ETA Request DTO Schemas
// ============================================================================

export const VehicleIdParamSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Vehicle ID cannot be empty').max(64),
});

export type VehicleIdParam = z.infer<typeof VehicleIdParamSchema>;

export const GetVehicleEtaSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Vehicle ID cannot be empty').max(64),
  targetStopId: z.string().trim().min(1, 'Target stop ID query param (stopId) is required').max(64),
});

export type GetVehicleEtaDTO = z.infer<typeof GetVehicleEtaSchema>;

// ============================================================================
// Telemetry & Entity Payload Validation Schemas
// ============================================================================

export const VehiclePositionSchema = z.object({
  vehicleId: z.string().min(1),
  routeId: z.string().default(''),
  tripId: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bearing: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.number().int().positive(),
  nearestStopSequence: z.number().optional(),
  isSpeedSuspect: z.boolean().optional(),
  raw: z.unknown().optional(),
});

export const TelemetryBatchFrameSchema = z.object({
  timestamp: z.number(),
  frameType: z.enum(['full', 'delta']),
  vehicles: z.array(VehiclePositionSchema),
});

export type TelemetryBatchFrameDTO = z.infer<typeof TelemetryBatchFrameSchema>;

// ============================================================================
// Domain Entity Response Schemas (Zero-Trust Ingress Validation)
// ============================================================================

export const StopSchema = z.object({
  stopId: z.string().min(1),
  stopName: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  clusterId: z.string().optional(),
  routeIds: z.array(z.string()).optional(),
});

export const RouteSummarySchema = z.object({
  routeId: z.string().min(1),
  routeShortName: z.string(),
  routeLongName: z.string(),
  routeType: z.number().optional(),
});

export const DirectJourneyResultSchema = z.object({
  route: RouteSummarySchema,
  originStop: StopSchema,
  destinationStop: StopSchema,
  originSequence: z.number(),
  destinationSequence: z.number(),
  stopsBetween: z.number(),
});

export const EtaResultSchema = z.object({
  etaSeconds: z.number(),
  varianceTotal: z.number(),
  weakestCellSupport: z.number(),
});

export type EtaResultDTO = z.infer<typeof EtaResultSchema>;
