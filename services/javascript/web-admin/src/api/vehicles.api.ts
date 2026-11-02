import client from './client';

export interface Vehicle {
  id: number;
  vehicle_number: string;
  registration_number: string;
  type: string;
  capacity: number;
  status: string;
  route_id: number | null;
  gps_device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVehiclePayload {
  vehicle_number: string;
  registration_number: string;
  type?: string;
  capacity?: number;
  route_id?: number;
  gps_device_id?: string;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data } = await client.get('/admin/vehicles');
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
