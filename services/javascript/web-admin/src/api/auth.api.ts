import client from './client';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: 'ADMIN' | 'STAFF' | string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: User }> {
  const { data } = await client.post('/auth/login', { email, password });
  return data.data ?? data;
}

export async function getMeApi(): Promise<User> {
  const { data } = await client.get('/auth/me');
  return data.data ?? data;
}
