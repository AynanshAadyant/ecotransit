import { create } from 'zustand';
import {
  fetchRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  setRouteStops,
  type Route,
  type CreateRoutePayload,
} from '../api/routes.api';

interface RoutesState {
  routes: Route[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  add: (payload: CreateRoutePayload) => Promise<Route>;
  edit: (id: number, payload: Partial<CreateRoutePayload>) => Promise<Route>;
  remove: (id: number) => Promise<void>;
  assignStops: (routeId: number, stops: Array<{ stopId: number; stopOrder: number }>) => Promise<void>;
}

export const useRoutesStore = create<RoutesState>((set) => ({
  routes: [],
  loading: false,
  actionLoading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const routes = await fetchRoutes();
      set({ routes, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load routes';
      set({ error: message, loading: false });
    }
  },

  add: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createRoute(payload);
      set((state) => ({
        routes: [...state.routes, created],
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create route';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  edit: async (id, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateRoute(id, payload);
      set((state) => ({
        routes: state.routes.map((r) => (r.id === id ? { ...r, ...updated } : r)),
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update route';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  remove: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await deleteRoute(id);
      set((state) => ({
        routes: state.routes.filter((r) => r.id !== id),
        actionLoading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete route';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  assignStops: async (routeId, stops) => {
    set({ actionLoading: true, error: null });
    try {
      await setRouteStops(routeId, stops);
      set((state) => ({
        routes: state.routes.map((r) => (r.id === routeId ? { ...r, stops } : r)),
        actionLoading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign stops to route';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },
}));
