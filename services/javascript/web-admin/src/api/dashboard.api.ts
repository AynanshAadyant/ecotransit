import client from './client';

export interface DashboardIncidentItem {
  id: number;
  type: string;
  description: string;
  severity?: string;
  status?: string;
  vehicleNumber?: string;
  vehicle_number?: string;
  routeName?: string;
  route_name?: string;
  createdAt: string;
  created_at?: string;
}

export interface DashboardData {
  totalVehicles: number;
  activeVehicles?: number;
  inactiveVehicles?: number;
  activeRoutes?: number;
  activeTrips?: number;
  totalStaff: number;
  openIncidents: number;
  offlineDevices?: number;
  recentIncidents: DashboardIncidentItem[];
  fleetStatus?: {
    active: number;
    maintenance: number;
    offline: number;
  };
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await client.get('/admin/dashboard');
  const payload = data.data ?? data;

  // Normalize fleetStatus if backend returns activeVehicles / inactiveVehicles
  if (!payload.fleetStatus && payload.totalVehicles !== undefined) {
    const active = payload.activeVehicles ?? 0;
    const offline = payload.offlineDevices ?? (payload.inactiveVehicles ?? 0);
    const maintenance = Math.max(0, payload.totalVehicles - (active + offline));
    payload.fleetStatus = { active, maintenance, offline };
  }

  return payload;
}
