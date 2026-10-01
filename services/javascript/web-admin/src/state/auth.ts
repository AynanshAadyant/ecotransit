import { create } from 'zustand';

/**
 * Spec §3.4:
 * Admin Service verifies tokens; it does NOT issue them.
 * web-admin does not implement its own login/JWT issuance flow.
 */
export interface AdminAuthState {
  isAuthenticated: boolean;
  adminUser: { id: string; name: string; role: string } | null;
  checkingAuth: boolean;
  setAuthenticated: (user: { id: string; name: string; role: string } | null) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  isAuthenticated: true, // Defaults to authenticated via HTTP-only cookie
  adminUser: { id: 'ADM-01', name: 'Network Controller', role: 'FLEET_SUPERVISOR' },
  checkingAuth: false,
  setAuthenticated: (adminUser) => set({ isAuthenticated: !!adminUser, adminUser }),
  logout: () => set({ isAuthenticated: false, adminUser: null }),
}));
