import { z } from 'zod';

export const VehicleIdParamSchema = z.object({
  vehicleId: z.string().trim().min(1),
});

export type VehicleIdParam = z.infer<typeof VehicleIdParamSchema>;
