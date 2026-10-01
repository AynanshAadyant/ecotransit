import { apiClient } from './client';
import { Shift } from '@ecotransit/contracts';

export async function getCurrentShift(): Promise<Shift | null> {
  const response = await apiClient.get<Shift>('/shifts/current');
  return response.data;
}

export async function confirmShift(shiftId: string, idempotencyKey: string): Promise<Shift> {
  const response = await apiClient.post<Shift>(
    `/shifts/${shiftId}/confirm`,
    {},
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  );
  return response.data;
}

export async function toggleFallbackPosition(
  vehicleId: string,
  enabled: boolean,
  idempotencyKey: string
): Promise<{ success: boolean; fallbackActive: boolean }> {
  const response = await apiClient.post(
    `/telemetry/fallback`,
    { vehicleId, enabled },
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  );
  return response.data;
}
