import client from './client';

export interface DashboardData {
  totalVehicles: number;
  activeRoutes: number;
  totalStaff: number;
  openIncidents: number;
  recentIncidents: { id: number; type: string; description: string; vehicleNumber: string; routeName: string; createdAt: string }[];
  fleetStatus: { active: number; maintenance: number; offline: number };
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await client.get('/admin/dashboard');
  return data.data ?? data;
}
