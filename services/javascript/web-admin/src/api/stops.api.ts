import client from './client';

export interface Stop {
  id: number;
  name: string;
  stop_code: string;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStopPayload {
  name: string;
  stop_code: string;
  latitude: number;
  longitude: number;
}

export async function fetchStops(): Promise<Stop[]> {
  const { data } = await client.get('/admin/stops');
  return data.data ?? data;
}

export async function fetchStop(id: number): Promise<Stop> {
  const { data } = await client.get(`/admin/stops/${id}`);
  return data.data ?? data;
}

export async function createStop(payload: CreateStopPayload): Promise<Stop> {
  const { data } = await client.post('/admin/stops', payload);
  return data.data ?? data;
}

export async function updateStop(id: number, payload: Partial<CreateStopPayload>): Promise<Stop> {
  const { data } = await client.patch(`/admin/stops/${id}`, payload);
  return data.data ?? data;
}

export async function deleteStop(id: number): Promise<void> {
  await client.delete(`/admin/stops/${id}`);
}
