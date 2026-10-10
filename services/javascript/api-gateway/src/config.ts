import { loadConfig, z } from '@ecotransit/core-utils';

export const ApiGatewayConfigSchema = z.object({
  PORT_API_GATEWAY: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('*'),
  BROADCAST_INTERVAL_MS: z.coerce.number().default(5000),
  DEFAULT_ROUTE_SPEED_MS: z.coerce.number().default(8.33), // ~30 km/h default transit speed
  MIN_SAMPLE_COUNT_ML_THRESHOLD: z.coerce.number().default(30),

  // Bounding box for Delhi NCR queries
  DELHI_BBOX_MIN_LAT: z.coerce.number().default(28.30),
  DELHI_BBOX_MAX_LAT: z.coerce.number().default(28.95),
  DELHI_BBOX_MIN_LON: z.coerce.number().default(76.80),
  DELHI_BBOX_MAX_LON: z.coerce.number().default(77.55),
});

export type ApiGatewayConfig = z.output<typeof ApiGatewayConfigSchema>;

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): ApiGatewayConfig {
  return loadConfig(ApiGatewayConfigSchema, env) as ApiGatewayConfig;
}
