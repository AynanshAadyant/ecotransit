import client from './client';

export interface Vehicle {
  id: number;
  vehicle_number?: string;
  vehicleNumber?: string;
  registration_number?: string;
  registrationNumber?: string;
  type?: string;
  vehicleType?: string;
  capacity?: number;
  status: string;
  route_id?: number | null;
  routeId?: number | null;
  gps_device_id?: string | null;
  deviceId?: string | null;
  routeName?: string;
  routeCode?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface CreateVehiclePayload {
  vehicleNumber: string;
  registrationNumber: string;
  vehicleType?: string;
  capacity?: number;
  routeId?: number | null;
  deviceId?: string | null;
  status?: string;
}

export async function fetchVehicles(filters?: { status?: string; routeId?: number }): Promise<Vehicle[]> {
  const { data } = await client.get('/admin/vehicles', { params: filters });
  return data.data ?? data;
}

export async function fetchVehicle(id: number): Promise<Vehicle> {
  const { data } = await client.get(`/admin/vehicles/${id}`);
  return data.data ?? data;
}

export async function createVehicle(payload: CreateVehiclePayload): Promise<Vehicle> {
  const { data } = await client.post('/admin/vehicles', payload);
  return data.data ?? data;
}

export async function updateVehicle(id: number, payload: Partial<CreateVehiclePayload>): Promise<Vehicle> {
  const { data } = await client.patch(`/admin/vehicles/${id}`, payload);
  return data.data ?? data;
}

export async function deleteVehicle(id: number): Promise<void> {
  await client.delete(`/admin/vehicles/${id}`);
}
