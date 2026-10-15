import { create } from 'zustand';
import {
  fetchIncidents,
  type Incident,
} from '../api/incidents.api';

interface IncidentsState {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const incidents = await fetchIncidents();
      set({ incidents, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load incidents';
      set({ error: message, loading: false });
    }
  },
}));
