import { create } from 'zustand';
import { fetchDashboard as fetchDashboardApi, type DashboardData } from '../api/dashboard.api';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchDashboardApi();
      set({ data, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      set({ error: message, loading: false });
    }
  },
}));
