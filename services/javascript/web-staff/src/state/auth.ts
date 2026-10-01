import { create } from 'zustand';
import { StaffUser } from '../api/auth.api';

/**
 * Spec §4.3:
 * Cookie-backed session state.
 * No localStorage token storing.
 */
export interface StaffAuthState {
  isAuthenticated: boolean;
  user: StaffUser | null;
  loading: boolean;
  error: string | null;
  setUser: (user: StaffUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useStaffAuthStore = create<StaffAuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user, isAuthenticated: !!user, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  logout: () => set({ isAuthenticated: false, user: null }),
}));
