import { z } from 'zod';

export const DirectJourneyQuerySchema = z
  .object({
    originStopId: z.string().trim().min(1),
    destinationStopId: z.string().trim().min(1),
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
  radiusM: z.coerce.number().positive().default(800),
});

export type JourneyByCoordsQuery = z.infer<typeof JourneyByCoordsQuerySchema>;
