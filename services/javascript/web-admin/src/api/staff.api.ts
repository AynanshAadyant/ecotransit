import client from './client';

export interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

export async function fetchStaff(): Promise<Staff[]> {
  const { data } = await client.get('/admin/staff');
  return data.data ?? data;
}

export async function fetchStaffMember(id: number): Promise<Staff> {
  const { data } = await client.get(`/admin/staff/${id}`);
  return data.data ?? data;
}

export async function createStaff(payload: CreateStaffPayload): Promise<Staff> {
  const { data } = await client.post('/admin/staff', payload);
  return data.data ?? data;
}

export async function updateStaff(id: number, payload: Partial<CreateStaffPayload>): Promise<Staff> {
  const { data } = await client.patch(`/admin/staff/${id}`, payload);
  return data.data ?? data;
}

export async function deleteStaff(id: number): Promise<void> {
  await client.delete(`/admin/staff/${id}`);
}
