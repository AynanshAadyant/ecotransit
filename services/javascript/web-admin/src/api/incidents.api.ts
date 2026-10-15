import client from './client';

export interface Incident {
  id: number;
  type: string;
  description: string;
  vehicle_id: number;
  route_id: number;
  status: string;
  reported_by: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateIncidentPayload {
  status: string;
  resolution?: string;
}

export async function fetchIncidents(): Promise<Incident[]> {
  const { data } = await client.get('/admin/incidents');
  return data.data ?? data;
}

export async function updateIncident(id: number, payload: UpdateIncidentPayload): Promise<Incident> {
  const { data } = await client.patch(`/admin/incidents/${id}`, payload);
  return data.data ?? data;
}
