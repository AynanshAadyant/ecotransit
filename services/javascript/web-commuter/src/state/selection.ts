import { create } from 'zustand';

/**
 * Spec §2.2:
 * selection state: { selectedVehicle: string | null; selectedRoute: string | null; selectedStop: string | null }
 */
export interface SelectionState {
  selectedVehicle: string | null;
  selectedRoute: string | null;
  selectedStop: string | null;
  setSelectedVehicle: (vehicleId: string | null) => void;
  setSelectedRoute: (routeId: string | null) => void;
  setSelectedStop: (stopId: string | null) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedVehicle: null,
  selectedRoute: null,
  selectedStop: null,
  setSelectedVehicle: (selectedVehicle) => set({ selectedVehicle }),
  setSelectedRoute: (selectedRoute) => set({ selectedRoute }),
  setSelectedStop: (selectedStop) => set({ selectedStop }),
  clearSelection: () => set({ selectedVehicle: null, selectedRoute: null, selectedStop: null }),
}));
