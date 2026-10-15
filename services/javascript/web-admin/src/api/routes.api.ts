import client from './client';

export interface Route {
  id: number;
  name: string;
  route_code: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRoutePayload {
  name: string;
  route_code: string;
}

export async function fetchRoutes(): Promise<Route[]> {
  const { data } = await client.get('/admin/routes');
  return data.data ?? data;
}

export async function fetchRoute(id: number): Promise<Route> {
  const { data } = await client.get(`/admin/routes/${id}`);
  return data.data ?? data;
}

export async function createRoute(payload: CreateRoutePayload): Promise<Route> {
  const { data } = await client.post('/admin/routes', payload);
  return data.data ?? data;
}

export async function updateRoute(id: number, payload: Partial<CreateRoutePayload>): Promise<Route> {
  const { data } = await client.patch(`/admin/routes/${id}`, payload);
  return data.data ?? data;
}

export async function deleteRoute(id: number): Promise<void> {
  await client.delete(`/admin/routes/${id}`);
}

export async function setRouteStops(routeId: number, stopIds: number[]): Promise<void> {
  await client.post(`/admin/routes/${routeId}/stops`, { stop_ids: stopIds });
}
