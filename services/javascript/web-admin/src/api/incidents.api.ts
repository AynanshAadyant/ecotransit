import { apiClient } from './client';
import { Incident } from '@ecotransit/contracts';

/**
 * Spec §3.3 / §9 / §10.3:
 * Incident queue guarded state transitions:
 * OPEN -> ACKNOWLEDGED -> RESOLVED
 */

export async function getIncidents(): Promise<Incident[]> {
  const response = await apiClient.get<Incident[]>('/incidents');
  return response.data;
}

export async function acknowledgeIncident(incidentId: string): Promise<Incident> {
  const response = await apiClient.post<Incident>(`/incidents/${incidentId}/acknowledge`);
  return response.data;
}

export async function resolveIncident(incidentId: string, resolutionNotes: string): Promise<Incident> {
  const response = await apiClient.post<Incident>(`/incidents/${incidentId}/resolve`, {
    resolutionNotes,
  });
  return response.data;
}
