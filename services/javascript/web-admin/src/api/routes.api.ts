import client from './client';

export interface RouteStopItem {
  stopId: number;
  stopOrder: number;
  name?: string;
}

export interface Route {
  id: number;
  name: string;
  routeCode?: string;
  route_code?: string;
  description?: string | null;
  origin?: string | null;
  destination?: string | null;
  distanceKm?: number;
  distance_km?: number;
  status: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  stops?: RouteStopItem[];
}

export interface CreateRoutePayload {
  name: string;
  routeCode: string;
  description?: string;
  origin?: string;
  destination?: string;
  distanceKm?: number;
  status?: string;
  stops?: Array<{ stopId: number; stopOrder: number }>;
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

export async function setRouteStops(routeId: number, stops: Array<{ stopId: number; stopOrder: number }>): Promise<void> {
  await client.post(`/admin/routes/${routeId}/stops`, { stops });
}
