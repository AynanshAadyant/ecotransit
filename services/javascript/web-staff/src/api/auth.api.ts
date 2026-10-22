import { apiClient } from './client';

export interface StaffUser {
  staffId: string;
  name: string;
  role: string;
}

/**
 * Spec §3 & §4.3:
 * Staff Service is the sole token issuer.
 * Session cookie is HTTP-only; frontend does NOT store JWT tokens in localStorage.
 */
export async function loginStaff(staffId: string, pin: string): Promise<StaffUser> {
  const response = await apiClient.post<StaffUser>('/auth/login', { staffId, pin });
  return response.data;
}

export async function logoutStaff(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getStaffSession(): Promise<StaffUser | null> {
  try {
    const response = await apiClient.get<StaffUser>('/auth/me');
    return response.data;
  } catch {
    return null;
  }
}
