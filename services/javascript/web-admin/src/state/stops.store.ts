import { create } from 'zustand';
import {
  fetchStops,
  createStop,
  updateStop,
  deleteStop,
  type Stop,
  type CreateStopPayload,
} from '../api/stops.api';

interface StopsState {
  stops: Stop[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  add: (payload: CreateStopPayload) => Promise<Stop>;
  edit: (id: number, payload: Partial<CreateStopPayload>) => Promise<Stop>;
  remove: (id: number) => Promise<void>;
}

export const useStopsStore = create<StopsState>((set) => ({
  stops: [],
  loading: false,
  actionLoading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const stops = await fetchStops();
      set({ stops, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load stops';
      set({ error: message, loading: false });
    }
  },

  add: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createStop(payload);
      set((state) => ({
        stops: [...state.stops, created],
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create transit stop';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  edit: async (id, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateStop(id, payload);
      set((state) => ({
        stops: state.stops.map((s) => (s.id === id ? { ...s, ...updated } : s)),
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update stop';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  remove: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await deleteStop(id);
      set((state) => ({
        stops: state.stops.filter((s) => s.id !== id),
        actionLoading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete stop';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },
}));
