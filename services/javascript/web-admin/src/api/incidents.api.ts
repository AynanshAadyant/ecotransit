import client from './client';

export interface Incident {
  id: number;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'reported' | 'under_investigation' | 'resolved' | 'dismissed' | string;
  latitude?: number | null;
  longitude?: number | null;
  vehicleId?: number | null;
  vehicle_id?: number | null;
  routeId?: number | null;
  route_id?: number | null;
  reportedBy?: number;
  reported_by?: number;
  reportedByName?: string;
  reportedByEmail?: string;
  vehicleNumber?: string;
  routeName?: string;
  routeCode?: string;
  adminNotes?: string | null;
  admin_notes?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface UpdateIncidentPayload {
  status?: string;
  adminNotes?: string;
  severity?: string;
  description?: string;
}

export async function fetchIncidents(filters?: {
  status?: string;
  severity?: string;
  type?: string;
  vehicleId?: number;
}): Promise<Incident[]> {
  const { data } = await client.get('/admin/incidents', { params: filters });
  return data.data ?? data;
}

export async function updateIncident(id: number, payload: UpdateIncidentPayload): Promise<Incident> {
  const { data } = await client.patch(`/admin/incidents/${id}`, payload);
  return data.data ?? data;
}
