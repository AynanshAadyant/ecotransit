import client from './client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: User }> {
  const { data } = await client.post('/auth/login', { email, password });
  return data.data ?? data;
}
