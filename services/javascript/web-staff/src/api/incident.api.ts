import { apiClient } from './client';
import { Incident, IncidentSeverity } from '@ecotransit/contracts';

export interface IncidentDraft {
  idempotencyKey: string;
  vehicleId?: string;
  routeId?: string;
  severity: IncidentSeverity;
  description: string;
  createdAt: number;
}

/**
 * Spec §4.2 & §8:
 * Attaches Idempotency-Key header to incident submissions.
 */
export async function submitIncidentReport(
  draft: IncidentDraft
): Promise<Incident> {
  const response = await apiClient.post<Incident>(
    '/incidents',
    {
      vehicleId: draft.vehicleId,
      routeId: draft.routeId,
      severity: draft.severity,
      description: draft.description,
    },
    {
      headers: {
        'Idempotency-Key': draft.idempotencyKey,
      },
    }
  );
  return response.data;
}
