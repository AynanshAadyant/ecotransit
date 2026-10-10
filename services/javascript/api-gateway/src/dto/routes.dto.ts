import { z } from 'zod';

export const RouteIdParamSchema = z.object({
  routeId: z.string().trim().min(1),
});

export type RouteIdParam = z.infer<typeof RouteIdParamSchema>;
