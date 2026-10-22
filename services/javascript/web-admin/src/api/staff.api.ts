import { apiClient } from './client';
import { Shift } from '@ecotransit/contracts';

export async function getStaffRoster(): Promise<Shift[]> {
  const response = await apiClient.get<Shift[]>('/staff/roster');
  return response.data;
}

export async function reassignShift(
  shiftId: string,
  assignedVehicleId: string,
  assignedRouteId: string
): Promise<Shift> {
  const response = await apiClient.put<Shift>(`/staff/shifts/${shiftId}/reassign`, {
    assignedVehicleId,
    assignedRouteId,
  });
  return response.data;
}
