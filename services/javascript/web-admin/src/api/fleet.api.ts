import { apiClient } from './client';
import { Vehicle, RouteGeometry, Stop } from '@ecotransit/contracts';

export interface RouteHealth {
  routeId: string;
  routeName: string;
  activeVehicles: number;
  onTimePerformance: number; // percentage 0 - 100
  averageHeadwayMinutes: number;
  status: 'NORMAL' | 'DEGRADED' | 'DISRUPTED';
}

export async function getFleetSnapshot(): Promise<Vehicle[]> {
  const response = await apiClient.get<Vehicle[]>('/fleet/live');
  return response.data;
}

export async function getRouteHealth(): Promise<RouteHealth[]> {
  const response = await apiClient.get<RouteHealth[]>('/fleet/routes/health');
  return response.data;
}

export async function getAdminRoutes(): Promise<RouteGeometry[]> {
  const response = await apiClient.get<RouteGeometry[]>('/network/routes');
  return response.data;
}

export async function getAdminStops(): Promise<Stop[]> {
  const response = await apiClient.get<Stop[]>('/network/stops');
  return response.data;
}
