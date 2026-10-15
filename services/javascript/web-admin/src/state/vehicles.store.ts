import { create } from 'zustand';
import {
  fetchVehicles,
  deleteVehicle,
  type Vehicle,
} from '../api/vehicles.api';

interface VehiclesState {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: [],
  loading: false,
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

  remove: async (id) => {
    try {
      await deleteVehicle(id);
      set((state) => ({
        vehicles: state.vehicles.filter((v) => v.id !== id),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete vehicle';
      set({ error: message });
    }
  },
}));
