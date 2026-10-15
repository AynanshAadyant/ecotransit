import { z } from 'zod';

export const NearbyStopsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().default(1000),
});

export type NearbyStopsQuery = z.infer<typeof NearbyStopsQuerySchema>;

export const SearchStopsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty'),
  limit: z.coerce.number().positive().optional().default(20),
});

export type SearchStopsQuery = z.infer<typeof SearchStopsQuerySchema>;

export const StopIdParamSchema = z.object({
  stopId: z.string().trim().min(1),
});

export type StopIdParam = z.infer<typeof StopIdParamSchema>;
