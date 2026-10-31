import { create } from 'zustand';
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  type Vehicle,
  type CreateVehiclePayload,
} from '../api/vehicles.api';

interface VehiclesState {
  vehicles: Vehicle[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  add: (payload: CreateVehiclePayload) => Promise<Vehicle>;
  edit: (id: number, payload: Partial<CreateVehiclePayload>) => Promise<Vehicle>;
  remove: (id: number) => Promise<void>;
}

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: [],
  loading: false,
  actionLoading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const vehicles = await fetchVehicles();
      set({ vehicles, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load vehicles';
      set({ error: message, loading: false });
    }
  },

  add: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createVehicle(payload);
      set((state) => ({
        vehicles: [...state.vehicles, created],
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create vehicle';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  edit: async (id, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateVehicle(id, payload);
      set((state) => ({
        vehicles: state.vehicles.map((v) => (v.id === id ? { ...v, ...updated } : v)),
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update vehicle';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  remove: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await deleteVehicle(id);
      set((state) => ({
        vehicles: state.vehicles.filter((v) => v.id !== id),
        actionLoading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete vehicle';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },
}));
