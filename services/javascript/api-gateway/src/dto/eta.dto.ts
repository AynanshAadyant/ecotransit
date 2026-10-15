import { z } from 'zod';

export const GetVehicleEtaSchema = z.object({
  vehicleId: z.string().trim().min(1),
  targetStopId: z.string().trim().min(1, 'Target stop ID query param (stopId) is required'),
});

export type GetVehicleEtaDTO = z.infer<typeof GetVehicleEtaSchema>;
